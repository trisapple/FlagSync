import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import { useSessionUser } from "../../hooks/useSessionUser";
import { getPublishedEvent } from "../../services/eventService";
import {
  listMyRegistrations,
  registerForEvent,
  unregisterFromEvent,
} from "../../services/registrationService";
import {
  createTeamForEvent,
  getMyTeamForEvent,
  joinTeamByCode,
} from "../../services/teamService";
import {
  formatDeadline,
  formatEventDate,
  formatEventFormat,
  formatEventTime,
  formatEventType,
  getEventDateBadge,
  getRegistrationStatus,
  getTeamLabel,
} from "../../utils/eventPresentation";
import { canRegisterForEvents } from "../../utils/roleRoutes";
import "./EventDetailsPage.css";

function EventDetailsPage() {
  const { eventId } = useParams();
  const location = useLocation();
  const sessionUser = useSessionUser();
  const userCanRegister = canRegisterForEvents(sessionUser?.role);
  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [registrationStatusForMe, setRegistrationStatusForMe] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [isMutating, setIsMutating] = useState(false);

  const [team, setTeam] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [teamFeedback, setTeamFeedback] = useState({ type: "", text: "" });
  const [isTeamMutating, setIsTeamMutating] = useState(false);

  async function refreshTeam() {
    try {
      const data = await getMyTeamForEvent(eventId);
      setTeam(data);
    } catch {
      setTeam(null);
    }
  }

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const eventData = await getPublishedEvent(eventId);
        if (ignore) return;
        setEvent(eventData);

        if (sessionUser && userCanRegister) {
          try {
            const registrations = await listMyRegistrations();
            if (ignore) return;
            const mine = registrations.find(
              (r) => r.event?.event_id === eventId,
            );
            setRegistrationStatusForMe(mine?.registration_status ?? null);
          } catch {
            /* not fatal */
          }

          if (eventData.team_mode) {
            try {
              const teamData = await getMyTeamForEvent(eventId);
              if (!ignore) setTeam(teamData);
            } catch {
              /* not fatal */
            }
          }
        }
      } catch {
        if (!ignore) setNotFound(true);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [eventId, sessionUser, userCanRegister]);

  async function handleRegister() {
    setFeedback({ type: "", text: "" });
    setIsMutating(true);
    try {
      const result = await registerForEvent(eventId);
      setRegistrationStatusForMe(result.registration_status);
      setFeedback({
        type: "success",
        text:
          result.registration_status === "waitlisted"
            ? "You're on the waitlist — we'll notify you if a spot opens up."
            : "You're registered.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to register.",
      });
    } finally {
      setIsMutating(false);
    }
  }

  async function handleUnregister() {
    if (!window.confirm("Cancel your registration for this event?")) return;
    setFeedback({ type: "", text: "" });
    setIsMutating(true);
    try {
      await unregisterFromEvent(eventId);
      setRegistrationStatusForMe(null);
      setTeam(null);
      setFeedback({ type: "success", text: "Registration cancelled." });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to cancel registration.",
      });
    } finally {
      setIsMutating(false);
    }
  }

  async function handleCreateTeam(formEvent) {
    formEvent.preventDefault();
    setTeamFeedback({ type: "", text: "" });
    setIsTeamMutating(true);
    try {
      const data = await createTeamForEvent(eventId, teamName.trim());
      setTeam(data);
      setTeamName("");
      setRegistrationStatusForMe((prev) => prev ?? "registered");
      setTeamFeedback({
        type: "success",
        text: "Team created. Share the invite code with your teammates.",
      });
    } catch (error) {
      setTeamFeedback({
        type: "error",
        text: error.message || "Unable to create team.",
      });
    } finally {
      setIsTeamMutating(false);
    }
  }

  async function handleJoinTeam(formEvent) {
    formEvent.preventDefault();
    setTeamFeedback({ type: "", text: "" });
    setIsTeamMutating(true);
    try {
      const data = await joinTeamByCode(inviteCodeInput.trim());
      setTeam(data);
      setInviteCodeInput("");
      setRegistrationStatusForMe(
        (prev) => prev ?? "registered",
      );
      setTeamFeedback({
        type: "success",
        text: `Joined team ${data.team_name}.`,
      });
      refreshTeam();
    } catch (error) {
      setTeamFeedback({
        type: "error",
        text: error.message || "Unable to join team.",
      });
    } finally {
      setIsTeamMutating(false);
    }
  }

  if (isLoading) {
    return (
      <PublicLayout>
        <main className="event-detail-not-found">
          <div className="public-container">
            <p className="public-eyebrow">Loading event...</p>
          </div>
        </main>
      </PublicLayout>
    );
  }

  if (notFound || !event) {
    return (
      <PublicLayout>
        <main className="event-detail-not-found">
          <div className="public-container">
            <p className="public-eyebrow">Event not found</p>
            <h1>This event is no longer available.</h1>
            <p>Return to the catalogue to discover other competitions.</p>
            <Link className="public-button public-button-primary" to="/events">
              Browse events
            </Link>
          </div>
        </main>
      </PublicLayout>
    );
  }

  const dateBadge = getEventDateBadge(event.start_date);
  const registrationStatus = getRegistrationStatus(event);
  const isRegistered = registrationStatusForMe === "registered";
  const isWaitlisted = registrationStatusForMe === "waitlisted";
  const canManageTeam = sessionUser && userCanRegister && event.team_mode;
  const canJoinTeamOnly = sessionUser && userCanRegister && event.team_mode;

  return (
    <PublicLayout>
      <main>
        <section className="event-detail-hero">
          <div className="public-container">
            <Link className="event-detail-back" to="/events">
              ← All events
            </Link>
            <div className="event-detail-heading">
              <div>
                <div className="event-detail-labels">
                  <span className="event-type-label">
                    {formatEventType(event.event_type)}
                  </span>
                  <span
                    className={`event-status event-status-${registrationStatus.key}`}
                  >
                    {registrationStatus.label}
                  </span>
                </div>
                <p className="event-detail-organiser">
                  Hosted by {event.organiser_name ?? "an organiser"}
                </p>
                <h1>{event.event_name}</h1>
                <p>{event.description}</p>
              </div>
              <div
                className="event-detail-date"
                aria-label={formatEventDate(event)}
              >
                <span>{dateBadge.month}</span>
                <strong>{dateBadge.day}</strong>
                <small>{dateBadge.year}</small>
              </div>
            </div>
          </div>
        </section>

        <section className="event-detail-content">
          <div className="public-container event-detail-grid">
            <div className="event-detail-main-column">
              <article className="event-detail-card">
                <p className="public-eyebrow">Event overview</p>
                <h2>What to expect</h2>
                <p className="event-detail-copy">{event.description}</p>
              </article>

              <article className="event-detail-card">
                <p className="public-eyebrow">Before you join</p>
                <h2>Participation details</h2>
                <ul className="event-requirement-list">
                  <li>Use an active FlagSync account to register.</li>
                  <li>{getTeamLabel(event)} may register together.</li>
                  <li>
                    Complete registration before{" "}
                    {formatDeadline(event.registration_deadline)}.
                  </li>
                  <li>Follow the organiser's rules and code of conduct.</li>
                </ul>
              </article>

              {event.team_mode && sessionUser && userCanRegister && (
                <article className="event-detail-card">
                  <p className="public-eyebrow">Team registration</p>
                  <h2>
                    {team
                      ? "Your team"
                      : "Create a new team or join with an invite code"}
                  </h2>

                  {teamFeedback.text && (
                    <p
                      className={`login-status login-status-${teamFeedback.type}`}
                      role={teamFeedback.type === "error" ? "alert" : "status"}
                    >
                      {teamFeedback.text}
                    </p>
                  )}

                  {team ? (
                    <div>
                      <p>
                        <strong>{team.team_name}</strong>
                      </p>
                      <p>
                        Invite code:{" "}
                        <code
                          style={{
                            padding: "2px 8px",
                            background: "#eef2ff",
                            borderRadius: 6,
                            fontFamily: "monospace",
                            fontSize: "1.05rem",
                            letterSpacing: 1,
                          }}
                        >
                          {team.invite_code}
                        </code>
                      </p>
                      <p style={{ color: "#64748b", fontSize: 14 }}>
                        Share this code with your teammates so they can join.
                        Up to {event.max_team_size} members total.
                      </p>
                      <h3 style={{ marginTop: 20 }}>
                        Members ({team.members.length}/{event.max_team_size})
                      </h3>
                      <ul style={{ paddingLeft: 20 }}>
                        {team.members.map((member) => (
                          <li key={member.user_id}>
                            {member.display_name}
                            {member.user_id === team.leader_id && " (leader)"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <>
                      {canManageTeam && (
                        <form
                          className="login-form"
                          onSubmit={handleCreateTeam}
                          style={{ marginBottom: 24 }}
                        >
                          <div className="login-field">
                            <label htmlFor="team_name">
                              Create a new team
                            </label>
                            <input
                              id="team_name"
                              type="text"
                              value={teamName}
                              onChange={(event) =>
                                setTeamName(event.target.value)
                              }
                              minLength={2}
                              maxLength={255}
                              placeholder="Team name"
                              required
                            />
                          </div>
                          <button
                            className="public-button public-button-primary"
                            type="submit"
                            disabled={isTeamMutating}
                          >
                            {isTeamMutating ? "Creating..." : "Create team"}
                          </button>
                        </form>
                      )}

                      {canJoinTeamOnly && (
                        <form className="login-form" onSubmit={handleJoinTeam}>
                          <div className="login-field">
                            <label htmlFor="invite_code">
                              Join with an invite code
                            </label>
                            <input
                              id="invite_code"
                              type="text"
                              value={inviteCodeInput}
                              onChange={(event) =>
                                setInviteCodeInput(event.target.value)
                              }
                              placeholder="e.g. a3f9c1b2"
                              required
                            />
                            <small style={{ color: "#64748b" }}>
                              Joining a team will also register you for this
                              event.
                            </small>
                          </div>
                          <button
                            className="public-button public-button-secondary"
                            type="submit"
                            disabled={isTeamMutating}
                          >
                            {isTeamMutating ? "Joining..." : "Join team"}
                          </button>
                        </form>
                      )}

                      {!canManageTeam && !team && (
                        <p style={{ color: "#64748b" }}>
                          Register for the event first, then create or join a
                          team.
                        </p>
                      )}
                    </>
                  )}
                </article>
              )}
            </div>

            <aside className="event-registration-card">
              <h2>Event details</h2>
              <dl>
                <div>
                  <dt>Date</dt>
                  <dd>{formatEventDate(event)}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{formatEventTime(event)}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{event.location}</dd>
                </div>
                <div>
                  <dt>Team size</dt>
                  <dd>{getTeamLabel(event)}</dd>
                </div>
                <div>
                  <dt>Registration deadline</dt>
                  <dd>{formatDeadline(event.registration_deadline)}</dd>
                </div>
                <div>
                  <dt>Capacity</dt>
                  <dd>
                    {event.capacity ? `${event.capacity} participants` : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>{formatEventFormat(event.event_format)}</dd>
                </div>
              </dl>

              {feedback.text && (
                <p
                  className={`login-status login-status-${feedback.type}`}
                  role={feedback.type === "error" ? "alert" : "status"}
                >
                  {feedback.text}
                </p>
              )}

              {registrationStatus.key === "closed" ? (
                <button
                  className="event-registration-action event-registration-closed"
                  type="button"
                  disabled
                >
                  Registration closed
                </button>
              ) : !sessionUser ? (
                <Link
                  className="public-button public-button-primary event-registration-action"
                  to="/login"
                  state={{ returnTo: location.pathname }}
                >
                  Sign in to join
                </Link>
              ) : !userCanRegister ? (
                <button
                  className="event-registration-action event-registration-closed"
                  type="button"
                  disabled
                >
                  User accounts only
                </button>
              ) : isRegistered || isWaitlisted ? (
                <button
                  className="public-button public-button-secondary event-registration-action"
                  type="button"
                  onClick={handleUnregister}
                  disabled={isMutating}
                >
                  {isMutating
                    ? "Cancelling..."
                    : isWaitlisted
                      ? "Leave waitlist"
                      : "Cancel registration"}
                </button>
              ) : (
                <button
                  className="public-button public-button-primary event-registration-action"
                  type="button"
                  onClick={handleRegister}
                  disabled={isMutating}
                >
                  {isMutating ? "Registering..." : "Register for event"}
                </button>
              )}

              {(isRegistered || isWaitlisted) && (
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <Link
                    className="public-button public-button-secondary"
                    to={`/events/${event.event_id}/challenges`}
                  >
                    View challenges
                  </Link>
                  {event.leaderboard_visible && (
                    <Link
                      className="public-button public-button-secondary"
                      to={`/events/${event.event_id}/leaderboard`}
                    >
                      Leaderboard
                    </Link>
                  )}
                </div>
              )}

              <p className="event-registration-note">
                {sessionUser && !userCanRegister
                  ? "Administrators and organisers cannot register for events."
                  : isRegistered
                    ? "You'll receive announcements from the organisers by email."
                    : isWaitlisted
                      ? "You'll be notified if a spot opens up."
                      : "You can cancel anytime before the event starts."}
              </p>
            </aside>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

export default EventDetailsPage;
