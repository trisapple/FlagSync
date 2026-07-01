import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import {
  createEventChallenge,
  deleteChallenge,
  listChallengeFiles,
  listEventChallenges,
} from "../../services/challengeService";
import { getEvent } from "../../services/eventService";
import {
  deleteResource,
  uploadResource,
} from "../../services/resourceService";
import { clearSessionUser } from "../../utils/authSession";
import "./ManageEventsPage.css";

const initialForm = { title: "", description: "", flag: "", points: 100 };

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ChallengeFilesEditor({ eventId, challengeId, onError }) {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const fetchFiles = async () => {
    try {
      const data = await listChallengeFiles(challengeId);
      setFiles(data);
    } catch (error) {
      onError?.(error.message || "Unable to load files.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadResource(eventId, file, challengeId);
      fetchFiles();
    } catch (error) {
      onError?.(error.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(resourceId, name) {
    if (!window.confirm(`Delete file "${name}"?`)) return;
    try {
      await deleteResource(resourceId);
      fetchFiles();
    } catch (error) {
      onError?.(error.message || "Delete failed.");
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b" }}>
        Attached files ({files.length})
      </p>
      {isLoading ? (
        <p style={{ margin: 0, fontSize: 13 }}>Loading files...</p>
      ) : files.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
          No files attached yet.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {files.map((file) => (
            <li
              key={file.resource_id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 12px",
                background: "#f8fafc",
                borderRadius: 6,
                marginBottom: 4,
                fontSize: 13,
              }}
            >
              <span>
                {file.file_name}{" "}
                <span style={{ color: "#94a3b8" }}>
                  ({formatBytes(file.file_size)})
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleDelete(file.resource_id, file.file_name)}
                style={{
                  padding: "4px 10px",
                  border: "1px solid #cbd5e1",
                  background: "white",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <label
        style={{
          display: "inline-block",
          marginTop: 8,
          padding: "6px 12px",
          background: "#eef2ff",
          color: "#4338ca",
          borderRadius: 6,
          cursor: isUploading ? "wait" : "pointer",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {isUploading ? "Uploading..." : "+ Add file"}
        <input
          type="file"
          onChange={handleUpload}
          disabled={isUploading}
          style={{ display: "none" }}
        />
      </label>
    </div>
  );
}

function EventChallengesPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [event, setEvent] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eventData, challengeData] = await Promise.all([
        getEvent(eventId),
        listEventChallenges(eventId),
      ]);
      setEvent(eventData);
      setChallenges(challengeData);
    } catch (error) {
      if (/authentication required/i.test(error.message)) {
        clearSessionUser();
        navigate("/login", {
          replace: true,
          state: { returnTo: location.pathname },
        });
        return;
      }
      setFeedback({
        type: "error",
        text: error.message || "Unable to load challenges.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [eventId, navigate, location.pathname]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFeedback({ type: "", text: "" });
    setIsSubmitting(true);
    try {
      const created = await createEventChallenge(eventId, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        flag: form.flag,
        points: Number(form.points),
      });

      let uploadFailures = 0;
      for (const file of selectedFiles) {
        try {
          await uploadResource(eventId, file, created.challenge_id);
        } catch {
          uploadFailures += 1;
        }
      }

      setForm(initialForm);
      setSelectedFiles([]);
      const fileInput = document.getElementById("challenge_files");
      if (fileInput) fileInput.value = "";
      setFeedback({
        type: uploadFailures ? "error" : "success",
        text: uploadFailures
          ? `Challenge created but ${uploadFailures} file(s) failed to upload.`
          : "Challenge created.",
      });
      fetchAll();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to create challenge.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(challengeId, title) {
    if (!window.confirm(`Delete challenge "${title}"?`)) return;
    try {
      await deleteChallenge(challengeId);
      setFeedback({ type: "success", text: "Challenge deleted." });
      fetchAll();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to delete challenge.",
      });
    }
  }

  return (
    <div className="dashboard-shell">
      <DashboardSidebar activePage="manage-events" />

      <main className="dashboard-main manage-events-main">
        <header className="manage-events-header">
          <div>
            <p className="dashboard-eyebrow">Organiser workspace</p>
            <h1>Challenges</h1>
            <p>
              {event
                ? `Manage flags for "${event.event_name}".`
                : "Loading..."}
            </p>
          </div>
          <Link
            to="/organiser/events/manage"
            className="public-button public-button-secondary"
          >
            Back to events
          </Link>
        </header>

        {feedback.text && (
          <p
            className={`login-status login-status-${feedback.type}`}
            role={feedback.type === "error" ? "alert" : "status"}
          >
            {feedback.text}
          </p>
        )}

        <section
          className="manage-events-panel"
          style={{ padding: "28px 32px" }}
        >
          <h2 style={{ marginTop: 0 }}>Add a new challenge</h2>
          <form className="login-form" onSubmit={handleCreate}>
            <div className="login-field">
              <label htmlFor="title">Title</label>
              <input
                id="title"
                name="title"
                type="text"
                minLength={2}
                maxLength={255}
                value={form.title}
                onChange={handleChange}
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                rows={4}
                maxLength={5000}
                value={form.description}
                onChange={handleChange}
              />
            </div>
            <div className="register-password-grid">
              <div className="login-field">
                <label htmlFor="flag">Flag (secret)</label>
                <input
                  id="flag"
                  name="flag"
                  type="text"
                  value={form.flag}
                  onChange={handleChange}
                  placeholder="flag{example}"
                  required
                />
                <small style={{ color: "#64748b" }}>
                  Stored as SHA-256 hash. Case-sensitive on submit.
                </small>
              </div>
              <div className="login-field">
                <label htmlFor="points">Points</label>
                <input
                  id="points"
                  name="points"
                  type="number"
                  min={1}
                  max={10000}
                  value={form.points}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="login-field">
              <label htmlFor="challenge_files">
                Attach files (optional)
              </label>
              <input
                id="challenge_files"
                type="file"
                multiple
                onChange={(event) =>
                  setSelectedFiles(Array.from(event.target.files ?? []))
                }
              />
              <small style={{ color: "#64748b" }}>
                PDF, PNG, JPEG, GIF, ZIP, or plain text. 50 MB per file.
              </small>
              {selectedFiles.length > 0 && (
                <p style={{ fontSize: 13, margin: "8px 0 0" }}>
                  {selectedFiles.length} file
                  {selectedFiles.length === 1 ? "" : "s"} selected
                </p>
              )}
            </div>
            <button
              className="public-button public-button-primary login-submit"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create challenge"}
            </button>
          </form>
        </section>

        <section
          className="manage-events-panel"
          style={{ padding: "28px 32px" }}
        >
          <h2 style={{ marginTop: 0 }}>
            Existing challenges ({challenges.length})
          </h2>
          {isLoading ? (
            <p>Loading...</p>
          ) : challenges.length === 0 ? (
            <p style={{ color: "#64748b" }}>No challenges yet.</p>
          ) : (
            <div className="manage-events-list">
              {challenges.map((challenge) => (
                <article
                  className="manage-event-row"
                  key={challenge.challenge_id}
                >
                  <div className="manage-event-primary">
                    <h2>{challenge.title}</h2>
                    <p style={{ whiteSpace: "pre-wrap" }}>
                      {challenge.description}
                    </p>
                    <p style={{ marginTop: 8 }}>
                      <strong>{challenge.points} points</strong>
                      {!challenge.is_active && (
                        <span
                          style={{
                            marginLeft: 8,
                            padding: "2px 8px",
                            background: "#fef3c7",
                            color: "#92400e",
                            borderRadius: 999,
                            fontSize: 12,
                          }}
                        >
                          Inactive
                        </span>
                      )}
                    </p>
                    <ChallengeFilesEditor
                      eventId={eventId}
                      challengeId={challenge.challenge_id}
                      onError={(text) =>
                        setFeedback({ type: "error", text })
                      }
                    />
                  </div>
                  <div className="manage-event-actions">
                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(challenge.challenge_id, challenge.title)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default EventChallengesPage;
