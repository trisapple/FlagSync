import { Link } from "react-router-dom";
import LogoutButton from "../auth/LogoutButton";
import { getDashboardPath } from "../../utils/roleRoutes";
import "./DashboardLayout.css";

function DashboardSidebar({ role, activePage = "dashboard" }) {
  const dashboardPath = getDashboardPath(role) ?? "/user/dashboard";
  const isOrganiser = dashboardPath === "/organiser/dashboard";
  const isAdministrator = dashboardPath === "/admin/dashboard";
  const isUser = dashboardPath === "/user/dashboard";

  return (
    <aside className="dashboard-sidebar">
      <Link className="dashboard-brand" to="/">
        <span className="dashboard-brand-mark" aria-hidden="true">
          F
        </span>
        <span>FlagSync</span>
      </Link>

      <div className="dashboard-role">
        <span>{role}</span>
        <strong>Workspace</strong>
      </div>

      <nav className="dashboard-nav" aria-label={`${role} workspace`}>
        <Link
          className={`dashboard-nav-link ${
            activePage === "dashboard" ? "active" : ""
          }`}
          to={dashboardPath}
        >
          Overview
        </Link>
        <Link
          className={`dashboard-nav-link ${
            activePage === "events" ? "active" : ""
          }`}
          to="/events"
        >
          Events
        </Link>
        {isUser && (
          <Link
            className={`dashboard-nav-link ${
              activePage === "registered-events" ? "active" : ""
            }`}
            to="/events/registered"
          >
            Registered events
          </Link>
        )}
        {isOrganiser && (
          <Link
            className={`dashboard-nav-link ${
              activePage === "manage-events" ? "active" : ""
            }`}
            to="/organiser/events/manage"
          >
            Manage events
          </Link>
        )}
        {isAdministrator && (
          <>
            <Link
              className={`dashboard-nav-link ${
                activePage === "admin-users" ? "active" : ""
              }`}
              to="/admin/users"
            >
              Users
            </Link>
            <Link
              className={`dashboard-nav-link ${
                activePage === "audit-logs" ? "active" : ""
              }`}
              to="/admin/audit-logs"
            >
              Audit logs
            </Link>
          </>
        )}
        <Link
          className={`dashboard-nav-link ${
            activePage === "profile" ? "active" : ""
          }`}
          to="/profile"
        >
          Profile
        </Link>
      </nav>

      <div className="dashboard-sidebar-footer">
        <Link className="dashboard-home-link" to="/">
          Back to home
        </Link>
        <LogoutButton className="dashboard-logout-button" />
      </div>
    </aside>
  );
}

export default DashboardSidebar;
