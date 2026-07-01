import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import PublicLayout from "../../components/public/PublicLayout";
import { listMyRegistrations } from "../../services/registrationService";
import { getSessionUser } from "../../utils/authSession";
import { canRegisterForEvents, getDashboardPath } from "../../utils/roleRoutes";
import {
  formatEventDate,
  formatEventFormat,
  formatEventType,
  getEventDateBadge,
  getRegistrationStatus,
  getTeamLabel,
} from "../../utils/eventPresentation";
import "./RegisteredEventsPage.css";

function getDisplayRole(role) {
  const roleName =
    typeof role === "string" ? role : (role?.role_name ?? role?.name ?? "user");
  return roleName.charAt(0).toUpperCase() + roleName.slice(1);
}

function RegisteredEventList({ registrations }) {
  if (registrations.length === 0) {
    return (
      <div className="registered-events-empty">
        <span aria-hidden="true">F</span>
        <h2>No registered events yet</h2>
        <p>Explore available competitions and register for your first event.</p>
        <Link to="/events">Browse available events</Link>
      </div>
    );
  }

  return (
    <div className="registered-events-grid">
      {registrations.map(({ registration_id, registration_status, event }) => {
        const dateBadge = getEventDateBadge(event.start_date);
        const registrationStatus = getRegistrationStatus(event);

        return (
          <article className="registered-event-card" key={registration_id}>
            <div
              className="registered-event-date"
              aria-label={formatEventDate(event)}
            >
              <span>{dateBadge.month}</span>
              <strong>{dateBadge.day}</strong>
            </div>
            <div className="registered-event-content">
              <div className="registered-event-labels">
                <span>{formatEventType(event.event_type)}</span>
                <span>{registrationStatus.label}</span>
                {registration_status === "waitlisted" && (
                  <span>Waitlisted</span>
                )}
              </div>
              <p>Hosted by {event.organiser_name ?? "an organiser"}</p>
              <h2>{event.event_name}</h2>
              <dl>
                <div>
                  <dt>Date</dt>
                  <dd>{formatEventDate(event)}</dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>{formatEventFormat(event.event_format)}</dd>
                </div>
                <div>
                  <dt>Team</dt>
                  <dd>{getTeamLabel(event)}</dd>
                </div>
              </dl>
              <Link to={`/events/${event.event_id}`}>View event details →</Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RegisteredEventsPage() {
  const sessionUser = getSessionUser();
  const [registrations, setRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!sessionUser || !canRegisterForEvents(sessionUser.role)) {
      setIsLoading(false);
      return;
    }
    let ignore = false;
    listMyRegistrations()
      .then((data) => {
        if (!ignore) setRegistrations(data);
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error.message || "Unable to load your registrations.");
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [sessionUser]);

  if (!sessionUser) {
    return (
      <PublicLayout>
        <main className="registered-events-auth">
          <div>
            <p className="public-eyebrow">Event registrations</p>
            <h1>Sign in to view your registrations.</h1>
            <p>Your registered competitions will appear here.</p>
            <Link className="public-button public-button-primary" to="/login">
              Sign in
            </Link>
          </div>
        </main>
      </PublicLayout>
    );
  }

  if (!canRegisterForEvents(sessionUser.role)) {
    return <Navigate to={getDashboardPath(sessionUser.role) ?? "/403"} replace />;
  }

  const role = getDisplayRole(sessionUser.role);

  return (
    <div className="dashboard-shell">
      <DashboardSidebar role={role} activePage="registered-events" />

      <main className="dashboard-main registered-events-main">
        <header className="registered-events-header">
          <div>
            <p className="dashboard-eyebrow">Your competition schedule</p>
            <h1>Registered events</h1>
            <p>Keep track of every competition you have joined.</p>
          </div>
          <Link to="/events">Explore more events</Link>
        </header>

        <section className="registered-events-summary">
          <span>Registered events</span>
          <strong>{registrations.length}</strong>
          <small>Includes waitlisted entries.</small>
        </section>

        {errorMessage ? (
          <p
            style={{ padding: 40, textAlign: "center", color: "#dc2626" }}
            role="alert"
          >
            {errorMessage}
          </p>
        ) : isLoading ? (
          <p style={{ padding: 40, textAlign: "center" }}>Loading...</p>
        ) : (
          <RegisteredEventList registrations={registrations} />
        )}
      </main>
    </div>
  );
}

export default RegisteredEventsPage;
