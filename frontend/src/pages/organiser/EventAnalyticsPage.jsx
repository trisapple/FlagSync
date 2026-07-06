import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import { getEvent, getEventAnalytics } from "../../services/eventService";
import { clearSessionUser } from "../../utils/authSession";
import "./EventAnalyticsPage.css";
import "./OrganiserEventLayout.css";

function EventAnalyticsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [event, setEvent] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const eventData = await getEvent(eventId);
        if (ignore) return;
        setEvent(eventData);
        const analyticsData = await getEventAnalytics(eventId);
        if (ignore) return;
        setAnalytics(analyticsData);
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
        setErrorMessage(
          error.message || "Unable to load analytics for this event.",
        );
      } finally {
        if (!ignore) setIsLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [eventId, navigate, location.pathname]);

  return (
    <div className="dashboard-shell">
      <DashboardSidebar role="Organiser" activePage="manage-events" />

      <main className="dashboard-main manage-events-main">
        <header className="manage-events-header">
          <div>
            <p className="dashboard-eyebrow">Organiser workspace</p>
            <h1>Event analytics</h1>
            <p>
              {event
                ? `Performance summary for "${event.event_name}".`
                : "Loading event..."}
            </p>
          </div>
          <Link
            to="/organiser/events/manage"
            className="public-button public-button-secondary"
          >
            Back to events
          </Link>
        </header>

        {isLoading ? (
          <section className="manage-events-panel analytics-state-panel">
            <p>Loading analytics...</p>
          </section>
        ) : errorMessage ? (
          <section className="manage-events-panel analytics-state-panel">
            <p
              className="login-status login-status-error"
              role="alert"
            >
              {errorMessage}
            </p>
            <p>
              Analytics are only available after the event ends. If you believe
              this is wrong, double-check the event's end date.
            </p>
          </section>
        ) : (
          <section className="manage-events-panel analytics-overview">
            <div className="analytics-overview-heading">
              <h2>Performance overview</h2>
              <p>A snapshot of participation and activity for this event.</p>
            </div>
            <div className="analytics-stats" aria-label="Event totals">
            <article>
              <span>Total registrations</span>
              <strong>{analytics?.total_registrations ?? 0}</strong>
            </article>
            <article>
              <span>Active participants</span>
              <strong>{analytics?.active_participants ?? 0}</strong>
            </article>
            <article>
              <span>Unique entrants</span>
              <strong>{analytics?.teams_formed ?? 0}</strong>
            </article>
            <article>
              <span>Submissions</span>
              <strong>{analytics?.submissions ?? 0}</strong>
            </article>
            <article>
              <span>Resource downloads</span>
              <strong>{analytics?.resource_downloads ?? 0}</strong>
            </article>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default EventAnalyticsPage;
