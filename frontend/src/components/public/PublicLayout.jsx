import { Link } from "react-router-dom";
import LogoutButton from "../auth/LogoutButton";
import { useSessionUser } from "../../hooks/useSessionUser";
import { getDashboardPath } from "../../utils/roleRoutes";
import "./PublicLayout.css";

function PublicLayout({
  children,
  actionTo = "/login",
  actionLabel = "Sign in",
  showNavigation = true,
}) {
  const sessionUser = useSessionUser();
  const dashboardPath = getDashboardPath(sessionUser?.role);
  const canRegisterForEvents = dashboardPath === "/user/dashboard";
  const useDashboardAction = actionTo === "/login" && dashboardPath;
  const resolvedActionTo = useDashboardAction ? dashboardPath : actionTo;
  const resolvedActionLabel = useDashboardAction ? "Dashboard" : actionLabel;

  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="public-container public-header-inner">
          <Link className="public-brand" to="/" aria-label="FlagSync home">
            <span className="public-brand-mark" aria-hidden="true">
              F
            </span>
            <span>FlagSync</span>
          </Link>

          {showNavigation && (
            <nav className="public-nav" aria-label="Main navigation">
              <Link to="/events">Events</Link>
              {canRegisterForEvents && (
                <Link to="/events/registered">Registered events</Link>
              )}
              {dashboardPath && <Link to="/profile">Profile</Link>}
              <a href="/#features">Features</a>
              <a href="/#how-it-works">How it works</a>
            </nav>
          )}

          <div className="public-header-actions">
            <Link
              className={`public-header-action ${
                useDashboardAction ? "public-header-dashboard-action" : ""
              }`}
              to={resolvedActionTo}
            >
              {resolvedActionLabel}
            </Link>
            {sessionUser && (
              <LogoutButton className="public-header-logout" />
            )}
          </div>
        </div>
      </header>

      {children}

      <footer className="public-footer">
        <div className="public-container public-footer-inner">
          <Link className="public-brand public-brand-small" to="/">
            <span className="public-brand-mark" aria-hidden="true">
              F
            </span>
            <span>FlagSync</span>
          </Link>
          <p>One place for every competition.</p>
          <span>CTFs · Hackathons · Teams</span>
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;
