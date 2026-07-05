import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import { getEvent, updateEvent } from "../../services/eventService";
import { clearSessionUser } from "../../utils/authSession";
import "./ManageEventsPage.css";

function toLocalInputValue(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function toIso(localValue) {
  if (!localValue) return null;
  return new Date(localValue).toISOString();
}

function EditEventPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  const fetchEvent = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getEvent(eventId);
      setForm({
        event_name: data.event_name ?? "",
        description: data.description ?? "",
        event_type: data.event_type,
        event_format: data.event_format,
        location: data.location ?? "",
        start_date: toLocalInputValue(data.start_date),
        end_date: toLocalInputValue(data.end_date),
        registration_deadline: toLocalInputValue(data.registration_deadline),
        capacity: data.capacity ?? "",
        team_mode: data.team_mode,
        max_team_size: data.max_team_size,
        leaderboard_visible: data.leaderboard_visible,
        status: data.status,
      });
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
        text: error.message || "Unable to load event.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [eventId, navigate, location.pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvent();
  }, [fetchEvent]);

  function handleChange(event) {
    const { name, type, checked, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ type: "", text: "" });
    setIsSubmitting(true);

    const payload = {
      event_name: form.event_name.trim(),
      description: form.description.trim() || null,
      event_type: form.event_type,
      event_format: form.event_format,
      location: form.location.trim(),
      start_date: toIso(form.start_date),
      end_date: toIso(form.end_date),
      registration_deadline: toIso(form.registration_deadline),
      capacity: form.capacity ? Number(form.capacity) : null,
      team_mode: form.team_mode,
      max_team_size: Number(form.max_team_size) || 1,
      leaderboard_visible: form.leaderboard_visible,
      status: form.status,
    };

    try {
      await updateEvent(eventId, payload);
      navigate("/organiser/events/manage", {
        replace: true,
        state: { type: "success", message: "Event updated." },
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to update event.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !form) {
    return (
      <div className="dashboard-shell">
        <DashboardSidebar role="Organiser" activePage="manage-events" />
        <main className="dashboard-main manage-events-main">
          <p>Loading event...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <DashboardSidebar role="Organiser" activePage="manage-events" />

      <main className="dashboard-main manage-events-main">
        <header className="manage-events-header">
          <div>
            <p className="dashboard-eyebrow">Organiser workspace</p>
            <h1>Edit event</h1>
            <p>Update the details below and save.</p>
          </div>
        </header>

        <section className="manage-events-panel create-event-panel">
          <div className="create-event-panel-heading">
            <h2>Event details</h2>
            <p>Fields marked with an asterisk are required.</p>
          </div>

          <form className="create-event-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="event_name">Event name *</label>
              <input
                id="event_name"
                name="event_name"
                type="text"
                minLength={2}
                maxLength={255}
                value={form.event_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                rows={4}
                maxLength={5000}
                value={form.description}
                onChange={handleChange}
              />
            </div>

            <div className="create-event-field-grid">
              <div className="login-field">
                <label htmlFor="event_type">Type *</label>
                <select
                  id="event_type"
                  name="event_type"
                  value={form.event_type}
                  onChange={handleChange}
                  required
                >
                  <option value="ctf">CTF</option>
                  <option value="hackathon">Hackathon</option>
                </select>
              </div>
              <div className="login-field">
                <label htmlFor="event_format">Format *</label>
                <select
                  id="event_format"
                  name="event_format"
                  value={form.event_format}
                  onChange={handleChange}
                  required
                >
                  <option value="online">Online</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="in_person">In person</option>
                </select>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="location">Location *</label>
              <input
                id="location"
                name="location"
                type="text"
                maxLength={255}
                value={form.location}
                onChange={handleChange}
                required
              />
            </div>

            <div className="create-event-field-grid">
              <div className="login-field">
                <label htmlFor="start_date">Start date &amp; time *</label>
                <input
                  id="start_date"
                  name="start_date"
                  type="datetime-local"
                  value={form.start_date}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="login-field">
                <label htmlFor="end_date">End date &amp; time *</label>
                <input
                  id="end_date"
                  name="end_date"
                  type="datetime-local"
                  value={form.end_date}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="registration_deadline">Registration deadline *</label>
              <input
                id="registration_deadline"
                name="registration_deadline"
                type="datetime-local"
                value={form.registration_deadline}
                onChange={handleChange}
                required
              />
            </div>

            <div className="create-event-field-grid">
              <div className="login-field">
                <label htmlFor="capacity">Capacity (optional)</label>
                <input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min={1}
                  value={form.capacity ?? ""}
                  onChange={handleChange}
                />
              </div>
              <div className="login-field">
                <label htmlFor="max_team_size">Max team size *</label>
                <input
                  id="max_team_size"
                  name="max_team_size"
                  type="number"
                  min={1}
                  value={form.max_team_size}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="status">Status *</label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                required
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="create-event-options">
              <label className="create-event-option">
                <input
                  type="checkbox"
                  name="team_mode"
                  checked={form.team_mode}
                  onChange={handleChange}
                />
                <span>
                  <strong>Team mode</strong>
                  <small>Allow participants to compete in teams.</small>
                </span>
              </label>

              <label className="create-event-option">
                <input
                  type="checkbox"
                  name="leaderboard_visible"
                  checked={form.leaderboard_visible}
                  onChange={handleChange}
                />
                <span>
                  <strong>Visible leaderboard</strong>
                  <small>Show rankings to event participants.</small>
                </span>
              </label>
            </div>

            {feedback.text && (
              <p
                className={`login-status login-status-${feedback.type}`}
                role={feedback.type === "error" ? "alert" : "status"}
              >
                {feedback.text}
              </p>
            )}

            <div className="create-event-actions">
              <button
                className="create-event-secondary-button"
                type="button"
                onClick={() => navigate("/organiser/events/manage")}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="create-event-primary-button"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default EditEventPage;
