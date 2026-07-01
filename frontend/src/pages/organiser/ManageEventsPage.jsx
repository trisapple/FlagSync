import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import { useSessionUser } from "../../hooks/useSessionUser";
import { deleteEvent, listMyEvents } from "../../services/eventService";
import { clearSessionUser } from "../../utils/authSession";
import {
  formatEventDate,
  formatEventFormat,
  formatEventType,
  getTeamLabel,
} from "../../utils/eventPresentation";
import { getDashboardPath } from "../../utils/roleRoutes";
import "./ManageEventsPage.css";

function getRoleName(role) {
  return typeof role === "string" ? role : (role?.role_name ?? role?.name ?? "");
}

function ManageEventsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionUser = useSessionUser();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState(() =>
    location.state?.message
      ? {
          type: location.state.type ?? "success",
          text: location.state.message,
        }
      : { type: "", text: "" },
  );

  const roleName = getRoleName(sessionUser?.role);
  const dashboardPath = getDashboardPath(roleName);
  const isOrganiser = dashboardPath === "/organiser/dashboard";

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listMyEvents();
      setEvents(data);
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
        text: error.message || "Unable to load events.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (!sessionUser || !isOrganiser) return;
    fetchEvents();
  }, [fetchEvents, sessionUser, isOrganiser]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      const matchesQuery =
        !normalizedQuery ||
        event.event_name.toLowerCase().includes(normalizedQuery);
      const matchesStatus =
        statusFilter === "all" || event.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [events, query, statusFilter]);

  if (!sessionUser) {
    return (
      <Navigate
        to="/login"
        state={{ returnTo: location.pathname }}
        replace
      />
    );
  }

  if (!isOrganiser) {
    return <Navigate to={dashboardPath ?? "/"} replace />;
  }

  const publishedCount = events.filter(
    (event) => event.status === "published",
  ).length;
  const draftCount = events.filter((event) => event.status === "draft").length;

  async function handleDelete(eventId, eventName) {
    if (
      !window.confirm(
        `Delete "${eventName}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await deleteEvent(eventId);
      setFeedback({
        type: "success",
        text: `Event "${eventName}" deleted.`,
      });
      fetchEvents();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to delete event.",
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
            <h1>Manage events</h1>
            <p>Review the events owned by your organiser account.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/organiser/events/new")}
          >
            Create event
          </button>
        </header>

        {feedback.text && (
          <p
            className={`login-status login-status-${feedback.type}`}
            role={feedback.type === "error" ? "alert" : "status"}
          >
            {feedback.text}
          </p>
        )}

        <section className="manage-events-stats" aria-label="Event totals">
          <article>
            <span>Total events</span>
            <strong>{events.length}</strong>
          </article>
          <article>
            <span>Published</span>
            <strong>{publishedCount}</strong>
          </article>
          <article>
            <span>Drafts</span>
            <strong>{draftCount}</strong>
          </article>
        </section>

        <section className="manage-events-panel">
          <div className="manage-events-toolbar">
            <div>
              <label htmlFor="manage-event-search">Search your events</label>
              <input
                id="manage-event-search"
                type="search"
                placeholder="Search by event name"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="manage-event-status">Status</label>
              <select
                id="manage-event-status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="manage-events-empty">
              <h2>Loading...</h2>
            </div>
          ) : filteredEvents.length > 0 ? (
            <div className="manage-events-list">
              {filteredEvents.map((event) => (
                <article className="manage-event-row" key={event.event_id}>
                  <div className="manage-event-primary">
                    <div className="manage-event-labels">
                      <span>{formatEventType(event.event_type)}</span>
                      <span className={`manage-event-status-${event.status}`}>
                        {event.status}
                      </span>
                    </div>
                    <h2>{event.event_name}</h2>
                    <p>{event.description}</p>
                  </div>

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
                    <div>
                      <dt>Status</dt>
                      <dd>{event.status}</dd>
                    </div>
                  </dl>

                  <div className="manage-event-actions">
                    <Link to={`/events/${event.event_id}`}>View details</Link>
                    <Link to={`/organiser/events/${event.event_id}/edit`}>
                      Edit
                    </Link>
                    <Link
                      to={`/organiser/events/${event.event_id}/participants`}
                    >
                      Participants
                    </Link>
                    <Link
                      to={`/organiser/events/${event.event_id}/announcements`}
                    >
                      Announcements
                    </Link>
                    <Link
                      to={`/organiser/events/${event.event_id}/challenges`}
                    >
                      Challenges
                    </Link>
                    <Link
                      to={`/organiser/events/${event.event_id}/analytics`}
                    >
                      Analytics
                    </Link>
                    <Link
                      to={`/organiser/events/${event.event_id}/resources`}
                    >
                      Resources
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(event.event_id, event.event_name)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="manage-events-empty">
              <h2>No events found</h2>
              <p>
                {events.length === 0
                  ? "Click \"Create event\" to add your first event."
                  : "Try a different search or status filter."}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default ManageEventsPage;
