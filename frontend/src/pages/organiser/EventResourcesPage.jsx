import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import { getEvent } from "../../services/eventService";
import {
  deleteResource,
  getResourceDownloadUrl,
  listEventResources,
  uploadResource,
} from "../../services/resourceService";
import { clearSessionUser } from "../../utils/authSession";
import "./ManageEventsPage.css";

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function EventResourcesPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [event, setEvent] = useState(null);
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eventData, resourceData] = await Promise.all([
        getEvent(eventId),
        listEventResources(eventId),
      ]);
      setEvent(eventData);
      setResources(resourceData);
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
        text: error.message || "Unable to load resources.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [eventId, navigate, location.pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll]);

  async function handleUpload(formEvent) {
    formEvent.preventDefault();
    if (!selectedFile) {
      setFeedback({ type: "error", text: "Choose a file first." });
      return;
    }
    setFeedback({ type: "", text: "" });
    setIsUploading(true);
    try {
      await uploadResource(eventId, selectedFile);
      setSelectedFile(null);
      const fileInput = document.getElementById("resource-file");
      if (fileInput) fileInput.value = "";
      setFeedback({ type: "success", text: "Resource uploaded." });
      fetchAll();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Upload failed.",
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(resourceId, fileName) {
    try {
      const { signed_url } = await getResourceDownloadUrl(resourceId);
      const link = document.createElement("a");
      link.href = signed_url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to generate download link.",
      });
    }
  }

  async function handleDelete(resourceId, fileName) {
    if (!window.confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    try {
      await deleteResource(resourceId);
      setFeedback({ type: "success", text: "Resource deleted." });
      fetchAll();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to delete resource.",
      });
    }
  }

  return (
    <div className="dashboard-shell">
      <DashboardSidebar role="Organiser" activePage="manage-events" />

      <main className="dashboard-main manage-events-main">
        <header className="manage-events-header">
          <div>
            <p className="dashboard-eyebrow">Organiser workspace</p>
            <h1>Resources</h1>
            <p>
              {event
                ? `Upload files for "${event.event_name}". 50 MB max per file, 500 MB quota per user.`
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

        <section className="manage-events-panel">
          <h2>Upload a new file</h2>
          <form className="login-form" onSubmit={handleUpload}>
            <div className="login-field">
              <label htmlFor="resource-file">File</label>
              <input
                id="resource-file"
                name="file"
                type="file"
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] ?? null)
                }
                required
              />
              <small style={{ color: "#64748b" }}>
                Allowed: PDF, PNG, JPEG, GIF, ZIP, plain text
              </small>
            </div>
            <button
              className="public-button public-button-primary login-submit"
              type="submit"
              disabled={isUploading || !selectedFile}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
          </form>
        </section>

        <section className="manage-events-panel">
          <h2>Existing resources ({resources.length})</h2>
          {isLoading ? (
            <p>Loading...</p>
          ) : resources.length === 0 ? (
            <p>No resources uploaded yet.</p>
          ) : (
            <div className="manage-events-list">
              {resources.map((resource) => (
                <article className="manage-event-row" key={resource.resource_id}>
                  <div className="manage-event-primary">
                    <h2>{resource.file_name}</h2>
                    <p>
                      {resource.mime_type ?? "unknown type"} ·{" "}
                      {formatBytes(resource.file_size)}
                    </p>
                    <p style={{ color: "#64748b", fontSize: 14 }}>
                      Uploaded {new Date(resource.uploaded_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="manage-event-actions">
                    <button
                      type="button"
                      onClick={() =>
                        handleDownload(resource.resource_id, resource.file_name)
                      }
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(resource.resource_id, resource.file_name)
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

export default EventResourcesPage;
