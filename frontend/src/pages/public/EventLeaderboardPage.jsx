import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import { getPublishedEvent } from "../../services/eventService";
import { getEventLeaderboard } from "../../services/challengeService";
import "./EventDetailsPage.css";

function EventLeaderboardPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [board, setBoard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [eventData, boardData] = await Promise.all([
          getPublishedEvent(eventId),
          getEventLeaderboard(eventId),
        ]);
        if (ignore) return;
        setEvent(eventData);
        setBoard(boardData);
      } catch (error) {
        if (!ignore) {
          setErrorMessage(
            error.message || "Unable to load leaderboard.",
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [eventId]);

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
                <p className="public-eyebrow">Standings</p>
                <h1>Leaderboard</h1>
                <p>{event ? event.event_name : "Loading..."}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="event-detail-content">
          <div className="public-container">
            {isLoading ? (
              <p>Loading standings...</p>
            ) : errorMessage ? (
              <p className="login-status login-status-error" role="alert">
                {errorMessage}
              </p>
            ) : board?.entries.length === 0 ? (
              <p>No submissions yet. Be the first to solve a challenge.</p>
            ) : (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr 100px 80px",
                    gap: 16,
                    padding: "12px 20px",
                    background: "#f8fafc",
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#475569",
                    fontWeight: 600,
                  }}
                >
                  <span>Rank</span>
                  <span>{board.mode === "team" ? "Team" : "Player"}</span>
                  <span style={{ textAlign: "right" }}>Points</span>
                  <span style={{ textAlign: "right" }}>Solves</span>
                </div>
                {board.entries.map((entry) => (
                  <div
                    key={entry.entrant_id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "60px 1fr 100px 80px",
                      gap: 16,
                      padding: "14px 20px",
                      borderTop: "1px solid #f1f5f9",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color:
                          entry.rank === 1
                            ? "#eab308"
                            : entry.rank === 2
                              ? "#94a3b8"
                              : entry.rank === 3
                                ? "#f97316"
                                : "#0f172a",
                      }}
                    >
                      #{entry.rank}
                    </span>
                    <span>{entry.name}</span>
                    <strong style={{ textAlign: "right" }}>
                      {entry.score}
                    </strong>
                    <span style={{ textAlign: "right", color: "#64748b" }}>
                      {entry.solves}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

export default EventLeaderboardPage;
