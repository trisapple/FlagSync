import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import {
  listChallengeFiles,
  listEventChallenges,
  submitFlag,
} from "../../services/challengeService";
import { getPublishedEvent } from "../../services/eventService";
import { getResourceDownloadUrl } from "../../services/resourceService";
import "./EventDetailsPage.css";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function difficultyMeta(points) {
  if (points <= 100) {
    return { label: "Easy", color: "#059669", bg: "#dcfce7" };
  }
  if (points <= 300) {
    return { label: "Medium", color: "#b45309", bg: "#fef3c7" };
  }
  if (points <= 500) {
    return { label: "Hard", color: "#c2410c", bg: "#ffedd5" };
  }
  return { label: "Insane", color: "#b91c1c", bg: "#fee2e2" };
}

function ChallengeCard({ challenge, onSolved }) {
  const [flag, setFlag] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    let ignore = false;
    listChallengeFiles(challenge.challenge_id)
      .then((data) => {
        if (!ignore) setFiles(data);
      })
      .catch(() => {
        /* no-op */
      });
    return () => {
      ignore = true;
    };
  }, [challenge.challenge_id]);

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
        text: error.message || "Unable to download file.",
      });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ type: "", text: "" });
    setIsSubmitting(true);
    try {
      const result = await submitFlag(challenge.challenge_id, flag);
      setFeedback({
        type: result.is_correct ? "success" : "error",
        text: result.message,
      });
      if (result.is_correct) {
        setFlag("");
        onSolved(challenge.challenge_id);
      }
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to submit flag.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const difficulty = difficultyMeta(challenge.points);
  const solved = challenge.solved_by_me;

  return (
    <article
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        padding: 28,
        borderRadius: 16,
        border: `1px solid ${solved ? "#86efac" : "#e2e8f0"}`,
        background: solved
          ? "linear-gradient(135deg, #f0fdf4 0%, #ffffff 60%)"
          : "#ffffff",
        boxShadow: "0 4px 16px rgb(15 23 42 / 4%)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      {solved && (
        <span
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            display: "grid",
            placeItems: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "#22c55e",
            color: "#ffffff",
            fontSize: 16,
            fontWeight: 900,
          }}
          aria-label="Solved"
        >
          ✓
        </span>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            padding: "4px 10px",
            background: difficulty.bg,
            color: difficulty.color,
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {difficulty.label}
        </span>
        <span
          style={{
            padding: "4px 10px",
            background: "#eef2ff",
            color: "#4338ca",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {challenge.points} pts
        </span>
      </div>

      <h3
        style={{
          margin: 0,
          fontSize: 20,
          color: "#0f172a",
          paddingRight: solved ? 40 : 0,
        }}
      >
        {challenge.title}
      </h3>

      {challenge.description && (
        <p
          style={{
            margin: "10px 0 0",
            color: "#475569",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {challenge.description}
        </p>
      )}

      {files.length > 0 && (
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px dashed #e2e8f0",
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "#64748b",
              fontWeight: 700,
            }}
          >
            Attachments
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {files.map((file) => (
              <button
                key={file.resource_id}
                type="button"
                onClick={() =>
                  handleDownload(file.resource_id, file.file_name)
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  background: "#ffffff",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#334155",
                  fontWeight: 500,
                }}
              >
                <span aria-hidden="true">📎</span>
                <span>{file.file_name}</span>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>
                  {formatBytes(file.file_size)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {solved ? (
          <div
            style={{
              padding: "12px 16px",
              background: "#dcfce7",
              color: "#166534",
              borderRadius: 10,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span aria-hidden="true">🎉</span>
            <span>Solved — {challenge.points} points earned</span>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              type="text"
              value={flag}
              onChange={(event) => setFlag(event.target.value)}
              placeholder="flag{...}"
              required
              style={{
                flex: 1,
                padding: "12px 14px",
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                fontFamily: "monospace",
                fontSize: 14,
                outline: "none",
                background: "#f8fafc",
              }}
            />
            <button
              type="submit"
              disabled={isSubmitting || flag.length === 0}
              style={{
                padding: "12px 20px",
                border: "none",
                borderRadius: 10,
                background: "#6366f1",
                color: "#ffffff",
                fontWeight: 600,
                cursor:
                  isSubmitting || flag.length === 0 ? "not-allowed" : "pointer",
                opacity: isSubmitting || flag.length === 0 ? 0.6 : 1,
              }}
            >
              {isSubmitting ? "Checking..." : "Submit"}
            </button>
          </form>
        )}
      </div>

      {feedback.text && (
        <p
          className={`login-status login-status-${feedback.type}`}
          role={feedback.type === "error" ? "alert" : "status"}
          style={{ marginTop: 12, marginBottom: 0 }}
        >
          {feedback.text}
        </p>
      )}
    </article>
  );
}

function EventChallengesPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eventData, challengeData] = await Promise.all([
        getPublishedEvent(eventId),
        listEventChallenges(eventId),
      ]);
      setEvent(eventData);
      setChallenges(challengeData);
    } catch (error) {
      setErrorMessage(error.message || "Unable to load challenges.");
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function handleSolved(challengeId) {
    setChallenges((prev) =>
      prev.map((c) =>
        c.challenge_id === challengeId ? { ...c, solved_by_me: true } : c,
      ),
    );
  }

  const solvedCount = challenges.filter((c) => c.solved_by_me).length;
  const totalPoints = challenges.reduce((sum, c) => sum + c.points, 0);
  const earnedPoints = challenges
    .filter((c) => c.solved_by_me)
    .reduce((sum, c) => sum + c.points, 0);

  return (
    <PublicLayout>
      <main>
        <section className="event-detail-hero">
          <div className="public-container">
            <Link className="event-detail-back" to={`/events/${eventId}`}>
              ← Back to event
            </Link>
            <div className="event-detail-heading">
              <div>
                <p className="public-eyebrow">Compete</p>
                <h1>Challenges</h1>
                <p>{event ? event.event_name : "Loading..."}</p>
              </div>
              <Link
                className="public-button public-button-secondary"
                to={`/events/${eventId}/leaderboard`}
              >
                View leaderboard
              </Link>
            </div>
          </div>
        </section>

        <section className="event-detail-content">
          <div className="public-container">
            {!isLoading && !errorMessage && challenges.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                  marginBottom: 28,
                }}
              >
                <div
                  style={{
                    padding: 20,
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      color: "#64748b",
                      fontWeight: 600,
                    }}
                  >
                    Solved
                  </p>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 28,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    {solvedCount}
                    <span
                      style={{
                        fontSize: 16,
                        color: "#94a3b8",
                        fontWeight: 500,
                      }}
                    >
                      {" "}
                      / {challenges.length}
                    </span>
                  </p>
                </div>
                <div
                  style={{
                    padding: 20,
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      color: "#64748b",
                      fontWeight: 600,
                    }}
                  >
                    Points earned
                  </p>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 28,
                      fontWeight: 700,
                      color: "#6366f1",
                    }}
                  >
                    {earnedPoints}
                    <span
                      style={{
                        fontSize: 16,
                        color: "#94a3b8",
                        fontWeight: 500,
                      }}
                    >
                      {" "}
                      / {totalPoints}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {isLoading ? (
              <p>Loading challenges...</p>
            ) : errorMessage ? (
              <p className="login-status login-status-error" role="alert">
                {errorMessage}
              </p>
            ) : challenges.length === 0 ? (
              <div
                style={{
                  padding: "60px 20px",
                  textAlign: "center",
                  background: "#ffffff",
                  border: "1px dashed #cbd5e1",
                  borderRadius: 16,
                  color: "#64748b",
                }}
              >
                <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                  No challenges published yet
                </p>
                <p style={{ margin: "8px 0 0" }}>
                  Check back once the event organiser adds some.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(360px, 1fr))",
                  gap: 20,
                }}
              >
                {challenges.map((challenge) => (
                  <ChallengeCard
                    key={challenge.challenge_id}
                    challenge={challenge}
                    onSolved={handleSolved}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

export default EventChallengesPage;
