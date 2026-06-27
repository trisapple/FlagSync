import { useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import { availableEvents } from "../../data/previewEvents";
import { getSessionUser } from "../../utils/authSession";
import {
  formatEventDate,
  formatEventFormat,
  formatEventType,
  getRegistrationStatus,
  getTeamLabel,
} from "../../utils/eventPresentation";
import { getDashboardPath } from "../../utils/roleRoutes";
import "./ManageEventsPage.css";

function getRoleName(role) {
  return typeof role === "string" ? role : (role?.role_name ?? role?.name ?? "");
}

function ManageEventsPage() {
  const location = useLocation();
  const sessionUser = getSessionUser();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const roleName = getRoleName(sessionUser?.role);
  const dashboardPath = getDashboardPath(roleName);
  const isOrganiser = dashboardPath === "/organiser/dashboard";

  const ownedEvents = useMemo(() => {
    if (!sessionUser) return [];

    return availableEvents.filter((event) => {
      if (sessionUser.user_id) {
        return event.organiser_id === sessionUser.user_id;
      }

      return (
        sessionUser.display_name &&
        event.organiser_name.toLowerCase() ===
          sessionUser.display_name.trim().toLowerCase()
      );
    });
  }, [sessionUser]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return ownedEvents.filter((event) => {
      const matchesQuery =
        !normalizedQuery ||
        event.event_name.toLowerCase().includes(normalizedQuery);
      const matchesStatus = status === "all" || event.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [ownedEvents, query, status]);

  if (!sessionUser) {
    return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  }

  if (!isOrganiser) {
    return <Navigate to={dashboardPath ?? "/"} replace />;
  }

  const publishedCount = ownedEvents.filter(
    (event) => event.status === "published",
  ).length;
  const draftCount = ownedEvents.filter((event) => event.status === "draft").length;

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
          <button type="button" disabled title="Requires the event creation API">
            Create event
          </button>
        </header>

        <section className="manage-events-stats" aria-label="Event totals">
          <article>
            <span>Total events</span>
            <strong>{ownedEvents.length}</strong>
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
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {filteredEvents.length > 0 ? (
            <div className="manage-events-list">
              {filteredEvents.map((event) => {
                const registrationStatus = getRegistrationStatus(event);
                return (
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
                        <dt>Registration</dt>
                        <dd>{registrationStatus.label}</dd>
                      </div>
                    </dl>

                    <div className="manage-event-actions">
                      <Link to={`/events/${event.event_id}`}>View details</Link>
                      <button type="button" disabled title="Requires the event update API">
                        Edit event
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="manage-events-empty">
              <h2>No events found</h2>
              <p>
                {ownedEvents.length === 0
                  ? "No preview events belong to this organiser account."
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
