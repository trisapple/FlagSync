import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import { getEventById } from "../../data/previewEvents";
import { getSessionUser } from "../../utils/authSession";
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
import {
  isEventRegistered,
  registerEventForSession,
} from "../../utils/eventRegistrationSession";
import { canRegisterForEvents } from "../../utils/roleRoutes";
import "./EventDetailsPage.css";

function EventDetailsPage() {
  const { eventId } = useParams();
  const location = useLocation();
  const event = getEventById(eventId);
  const sessionUser = getSessionUser();
  const userCanRegister = canRegisterForEvents(sessionUser?.role);
  const [isRegistered, setIsRegistered] = useState(() =>
    isEventRegistered(sessionUser, eventId),
  );

  if (!event) {
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

  function handleRegistration() {
    registerEventForSession(sessionUser, event.event_id);
    setIsRegistered(true);
  }

  const dateBadge = getEventDateBadge(event.start_date);
  const registrationStatus = getRegistrationStatus(event);

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
                  Hosted by {event.organiser_name}
                </p>
                <h1>{event.event_name}</h1>
                <p>{event.description}</p>
              </div>
              <div className="event-detail-date" aria-label={formatEventDate(event)}>
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
                    Complete registration before {formatDeadline(event.registration_deadline)}.
                  </li>
                  <li>Follow the organiser’s rules and code of conduct.</li>
                </ul>
              </article>
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
                  <dd>{event.capacity} participants</dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>{formatEventFormat(event.event_format)}</dd>
                </div>
              </dl>

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
              ) : isRegistered ? (
                <Link
                  className="event-registration-action event-registration-complete"
                  to="/events/registered"
                >
                  Already registered
                </Link>
              ) : (
                <button
                  className="public-button public-button-primary event-registration-action"
                  type="button"
                  onClick={handleRegistration}
                >
                  Register for event
                </button>
              )}

              <p className="event-registration-note">
                {sessionUser && !userCanRegister
                  ? "Administrators and organisers cannot register for events."
                  : "Registration is stored in this browser session for UI preview only."}
              </p>
            </aside>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

export default EventDetailsPage;
