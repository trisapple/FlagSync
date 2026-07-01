import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import { getEvent } from "../../services/eventService";
import { listEventParticipants } from "../../services/registrationService";
import { listEventTeams } from "../../services/teamService";
import { clearSessionUser } from "../../utils/authSession";
import "./ManageEventsPage.css";

function EventParticipantsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const [eventData, participantsData, teamsData] = await Promise.all([
          getEvent(eventId),
          listEventParticipants(eventId),
          listEventTeams(eventId).catch(() => []),
        ]);
        if (ignore) return;
        setEvent(eventData);
        setParticipants(participantsData);
        setTeams(teamsData);
      } catch (error) {
        if (ignore) return;
        if (/authentication required/i.test(error.message)) {
          clearSessionUser();
          navigate("/login", {
            replace: true,
            state: { returnTo: location.pathname },
          });
          return;
        }
        setErrorMessage(error.message || "Unable to load participants.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [eventId, navigate, location.pathname]);

  const registered = participants.filter(
    (p) => p.registration_status === "registered",
  );
  const waitlisted = participants.filter(
    (p) => p.registration_status === "waitlisted",
  );

  const userIdsInAnyTeam = new Set(
    teams.flatMap((team) => team.members.map((member) => member.user_id)),
  );
  const soloParticipants = registered.filter(
    (participant) => !userIdsInAnyTeam.has(participant.user_id),
  );

  return (
    <div className="dashboard-shell">
      <DashboardSidebar activePage="manage-events" />

      <main className="dashboard-main manage-events-main">
        <header className="manage-events-header">
          <div>
            <p className="dashboard-eyebrow">Organiser workspace</p>
            <h1>Participants</h1>
            <p>
              {event
                ? `Everyone who has registered for "${event.event_name}".`
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

        {errorMessage && (
          <p className="login-status login-status-error" role="alert">
            {errorMessage}
          </p>
        )}

        <section
          className="manage-events-stats"
          aria-label="Participant totals"
        >
          <article>
            <span>Total participants</span>
            <strong>{participants.length}</strong>
          </article>
          <article>
            <span>Registered</span>
            <strong>{registered.length}</strong>
          </article>
          <article>
            <span>Teams formed</span>
            <strong>{teams.length}</strong>
          </article>
          <article>
            <span>Waitlisted</span>
            <strong>{waitlisted.length}</strong>
          </article>
        </section>

        {teams.length > 0 && (
          <section
            className="manage-events-panel"
            style={{ padding: "28px 32px" }}
          >
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#6366f1",
                    fontWeight: 600,
                  }}
                >
                  Registered teams
                </p>
                <h2 style={{ margin: "4px 0 0", fontSize: 22 }}>
                  Teams ({teams.length})
                </h2>
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: "#64748b",
                }}
              >
                {teams.reduce((sum, t) => sum + t.members.length, 0)} total
                members
              </span>
            </header>
            <div
              style={{
                display: "grid",
                gap: 16,
              }}
            >
              {teams.map((team) => (
                <article
                  key={team.team_id}
                  style={{
                    padding: 24,
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                  }}
                >
                  <header
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 16,
                      paddingBottom: 16,
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          color: "#6366f1",
                          fontWeight: 600,
                        }}
                      >
                        Team name
                      </p>
                      <h3
                        style={{
                          margin: "4px 0 0",
                          fontSize: 22,
                          color: "#0f172a",
                        }}
                      >
                        {team.team_name}
                      </h3>
                    </div>
                    <span
                      style={{
                        padding: "6px 14px",
                        background: "#eef2ff",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#4338ca",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {team.members.length} member
                      {team.members.length === 1 ? "" : "s"}
                    </span>
                  </header>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 16,
                      padding: "16px 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                        }}
                      >
                        Invite code
                      </p>
                      <code
                        style={{
                          display: "inline-block",
                          marginTop: 4,
                          padding: "4px 10px",
                          background: "#f1f5f9",
                          borderRadius: 6,
                          fontFamily: "monospace",
                          fontSize: 14,
                          letterSpacing: 1,
                          color: "#0f172a",
                        }}
                      >
                        {team.invite_code}
                      </code>
                    </div>
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                        }}
                      >
                        Created
                      </p>
                      <p style={{ margin: "4px 0 0", color: "#0f172a" }}>
                        {new Date(team.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div style={{ paddingTop: 16 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        marginBottom: 12,
                      }}
                    >
                      Members
                    </p>
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      {team.members.map((member) => (
                        <li
                          key={member.user_id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 14px",
                            background: "#f8fafc",
                            borderRadius: 8,
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              display: "grid",
                              placeItems: "center",
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: "#6366f1",
                              color: "#ffffff",
                              fontWeight: 700,
                              fontSize: 14,
                            }}
                          >
                            {member.display_name.charAt(0).toUpperCase()}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                margin: 0,
                                fontWeight: 600,
                                color: "#0f172a",
                              }}
                            >
                              {member.display_name}
                            </p>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 13,
                                color: "#64748b",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {member.email}
                            </p>
                          </div>
                          {member.user_id === team.leader_id && (
                            <span
                              style={{
                                padding: "3px 10px",
                                background: "#dcfce7",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#166534",
                              }}
                            >
                              Leader
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section
          className="manage-events-panel"
          style={{ padding: "28px 32px" }}
        >
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "#6366f1",
                  fontWeight: 600,
                }}
              >
                {teams.length > 0 ? "Not in any team" : "Individual signups"}
              </p>
              <h2 style={{ margin: "4px 0 0", fontSize: 22 }}>
                {teams.length > 0 ? "Solo registrations" : "Registered"} (
                {soloParticipants.length})
              </h2>
            </div>
          </header>
          {isLoading ? (
            <p style={{ margin: 0, color: "#64748b" }}>Loading...</p>
          ) : soloParticipants.length === 0 ? (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                background: "#f8fafc",
                borderRadius: 12,
                color: "#64748b",
              }}
            >
              {teams.length > 0
                ? "Everyone registered has joined a team."
                : "No one has registered yet."}
            </div>
          ) : (
            <div className="manage-events-list">
              {soloParticipants.map((participant) => (
                <article
                  className="manage-event-row"
                  key={participant.registration_id}
                >
                  <div className="manage-event-primary">
                    <h2>{participant.display_name}</h2>
                    <p>{participant.email}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Registered</dt>
                      <dd>
                        {new Date(participant.registered_at).toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>

        {waitlisted.length > 0 && (
          <section
            className="manage-events-panel"
            style={{ padding: "28px 32px" }}
          >
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#f59e0b",
                    fontWeight: 600,
                  }}
                >
                  Awaiting a spot
                </p>
                <h2 style={{ margin: "4px 0 0", fontSize: 22 }}>
                  Waitlisted ({waitlisted.length})
                </h2>
              </div>
            </header>
            <div className="manage-events-list">
              {waitlisted.map((participant) => (
                <article
                  className="manage-event-row"
                  key={participant.registration_id}
                >
                  <div className="manage-event-primary">
                    <h2>{participant.display_name}</h2>
                    <p>{participant.email}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Waitlisted since</dt>
                      <dd>
                        {new Date(participant.registered_at).toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default EventParticipantsPage;
