import { Link } from "react-router-dom";
import DashboardSidebar from "./DashboardSidebar";
import "./DashboardLayout.css";

function DashboardLayout({
  role,
  eyebrow,
  title,
  description,
  stats,
  actions,
  activity,
}) {
  return (
    <div className="dashboard-shell">
      <DashboardSidebar role={role} />

      <main className="dashboard-main">
        <header className="dashboard-header" id="overview">
          <div>
            <p className="dashboard-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="dashboard-description">{description}</p>
          </div>
          <Link
            className="dashboard-avatar"
            to="/profile"
            aria-label={`Open ${role} profile`}
          >
            {role.charAt(0)}
          </Link>
        </header>

        <section className="dashboard-stats" aria-label="Dashboard statistics">
          {stats.map((stat) => (
            <article className="dashboard-stat-card" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </article>
          ))}
        </section>

        <section className="dashboard-section" id="actions">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">Get things done</p>
              <h2>Quick actions</h2>
            </div>
          </div>

          <div className="dashboard-action-grid">
            {actions.map((action) => (
              <article className="dashboard-action-card" key={action.title}>
                <span className="dashboard-action-icon" aria-hidden="true">
                  {action.icon}
                </span>
                <div>
                  <h3>{action.title}</h3>
                  <p>{action.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="dashboard-section" id="activity">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">Latest updates</p>
              <h2>Recent activity</h2>
            </div>
          </div>

          <div className="dashboard-activity-list">
            {activity.map((item) => (
              <article className="dashboard-activity-item" key={item.title}>
                <span className="dashboard-activity-dot" aria-hidden="true" />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <time>{item.time}</time>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default DashboardLayout;
