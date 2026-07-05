import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import { useSessionUser } from "../../hooks/useSessionUser";
import { createEvent } from "../../services/eventService";
import { getDashboardPath } from "../../utils/roleRoutes";
import "./EventForm.css";
import "./OrganiserEventLayout.css";

function getRoleName(role) {
  return typeof role === "string" ? role : (role?.role_name ?? role?.name ?? "");
}

const initialFormData = {
  event_name: "",
  description: "",
  event_type: "ctf",
  event_format: "online",
  location: "",
  start_date: "",
  end_date: "",
  registration_deadline: "",
  capacity: "",
  team_mode: true,
  max_team_size: 1,
  leaderboard_visible: true,
  status: "draft",
};

function CreateEventPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionUser = useSessionUser();
  const [formData, setFormData] = useState(initialFormData);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roleName = getRoleName(sessionUser?.role);
  const dashboardPath = getDashboardPath(roleName);
  const isOrganiser = dashboardPath === "/organiser/dashboard";

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
    const { name, type, checked, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function toIsoOrNull(localDateValue) {
    if (!localDateValue) return null;
    return new Date(localDateValue).toISOString();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ type: "", text: "" });
    setIsSubmitting(true);

    const payload = {
      event_name: formData.event_name.trim(),
      description: formData.description.trim() || null,
      event_type: formData.event_type,
      event_format: formData.event_format,
      location: formData.location.trim(),
      start_date: toIsoOrNull(formData.start_date),
      end_date: toIsoOrNull(formData.end_date),
      registration_deadline: toIsoOrNull(formData.registration_deadline),
      capacity: formData.capacity ? Number(formData.capacity) : null,
      team_mode: formData.team_mode,
      max_team_size: Number(formData.max_team_size) || 1,
      leaderboard_visible: formData.leaderboard_visible,
      status: formData.status,
    };

    try {
      const created = await createEvent(payload);
      navigate("/organiser/events/manage", {
        replace: true,
        state: {
          type: "success",
          message: `Event "${created.event_name}" created.`,
        },
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to create event. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard-shell">
      <DashboardSidebar role="Organiser" activePage="manage-events" />

      <main className="dashboard-main manage-events-main">
        <header className="manage-events-header">
          <div>
            <p className="dashboard-eyebrow">Organiser workspace</p>
            <h1>Create event</h1>
            <p>Fill in the required details below. You can edit them later.</p>
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
                value={formData.event_name}
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
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div className="create-event-field-grid">
              <div className="login-field">
                <label htmlFor="event_type">Type *</label>
                <select
                  id="event_type"
                  name="event_type"
                  value={formData.event_type}
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
                  value={formData.event_format}
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
                value={formData.location}
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
                  value={formData.start_date}
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
                  value={formData.end_date}
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
                value={formData.registration_deadline}
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
                  value={formData.capacity}
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
                  value={formData.max_team_size}
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
                value={formData.status}
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
                  checked={formData.team_mode}
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
                  checked={formData.leaderboard_visible}
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
                {isSubmitting ? "Creating..." : "Create event"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default CreateEventPage;
