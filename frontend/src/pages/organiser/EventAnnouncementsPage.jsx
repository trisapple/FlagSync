import { useCallback, useEffect, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import { useSessionUser } from "../../hooks/useSessionUser";
import {
  createEventAnnouncement,
  deleteAnnouncement,
  listEventAnnouncements,
} from "../../services/announcementService";
import { getEvent } from "../../services/eventService";
import { clearSessionUser } from "../../utils/authSession";
import { getDashboardPath } from "../../utils/roleRoutes";
import "./EventContentPage.css";
import "./EventForm.css";
import "./OrganiserEventLayout.css";

function getRoleName(role) {
  return typeof role === "string" ? role : (role?.role_name ?? role?.name ?? "");
}

function EventAnnouncementsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const sessionUser = useSessionUser();
  const [event, setEvent] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({ title: "", content: "" });
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roleName = getRoleName(sessionUser?.role);
  const dashboardPath = getDashboardPath(roleName);
  const isOrganiser = dashboardPath === "/organiser/dashboard";

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eventData, announcementData] = await Promise.all([
        getEvent(eventId),
        listEventAnnouncements(eventId),
      ]);
      setEvent(eventData);
      setAnnouncements(announcementData);
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
        text: error.message || "Unable to load event announcements.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [eventId, navigate, location.pathname]);

  useEffect(() => {
    if (!sessionUser || !isOrganiser) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll, sessionUser, isOrganiser]);

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

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFeedback({ type: "", text: "" });
    setIsSubmitting(true);
    try {
      await createEventAnnouncement(eventId, {
        title: form.title.trim(),
        content: form.content.trim(),
      });
      setForm({ title: "", content: "" });
      setFeedback({ type: "success", text: "Announcement posted." });
      fetchAll();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to post announcement.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(announcementId) {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      await deleteAnnouncement(announcementId);
      setFeedback({ type: "success", text: "Announcement deleted." });
      fetchAll();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to delete announcement.",
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
            <h1>Announcements</h1>
            <p>
              {event
                ? `Posting to "${event.event_name}". All registered participants will be notified.`
                : "Loading event details..."}
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

        <div className="event-challenges-content">
        <section className="manage-events-panel challenge-panel">
          <div className="challenge-panel-heading">
            <div>
              <h2>Post a new announcement</h2>
              <p>Share an update with everyone registered for this event.</p>
            </div>
          </div>
          <form className="create-event-form" onSubmit={handleCreate}>
            <div className="login-field">
              <label htmlFor="title">Title *</label>
              <input
                id="title"
                name="title"
                type="text"
                minLength={2}
                maxLength={255}
                value={form.title}
                onChange={handleChange}
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="content">Content *</label>
              <textarea
                id="content"
                name="content"
                rows={6}
                maxLength={10000}
                value={form.content}
                onChange={handleChange}
                required
              />
            </div>
            <div className="create-event-actions">
              <button
                className="create-event-primary-button"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Posting..." : "Post announcement"}
              </button>
            </div>
          </form>
        </section>

        <section className="manage-events-panel challenge-panel">
          <div className="challenge-panel-heading">
            <h2>Previous announcements</h2>
            <span>{announcements.length}</span>
          </div>
          {isLoading ? (
            <p className="challenge-empty">Loading...</p>
          ) : announcements.length === 0 ? (
            <p className="challenge-empty">No announcements yet.</p>
          ) : (
            <div className="manage-events-list">
              {announcements.map((announcement) => (
                <article
                  className="challenge-row"
                  key={announcement.announcement_id}
                >
                  <div className="challenge-primary">
                    <h2>{announcement.title}</h2>
                    <p className="challenge-description">
                      {announcement.content}
                    </p>
                    <p className="announcement-posted-at">
                      Posted {new Date(announcement.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="challenge-actions">
                    <button
                      type="button"
                      onClick={() => handleDelete(announcement.announcement_id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        </div>
      </main>
    </div>
  );
}

export default EventAnnouncementsPage;
