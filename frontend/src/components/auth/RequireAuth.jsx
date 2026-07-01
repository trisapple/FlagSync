import { Navigate, useLocation } from "react-router-dom";
import { useSessionUser } from "../../hooks/useSessionUser";
import { getDashboardPath } from "../../utils/roleRoutes";

function canonicalRole(role) {
  if (!role) return null;
  const name = typeof role === "string" ? role : (role.role_name ?? role.name);
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  if (normalized === "admin" || normalized === "administrator") {
    return "administrator";
  }
  if (normalized === "organizer" || normalized === "organiser") {
    return "organiser";
  }
  if (normalized === "participant" || normalized === "user") {
    return "user";
  }
  return normalized;
}

function RequireAuth({ children, allowedRoles }) {
  const sessionUser = useSessionUser();
  const location = useLocation();

  if (!sessionUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ returnTo: location.pathname }}
      />
    );
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const role = canonicalRole(sessionUser.role);
    const allowed = allowedRoles.some((r) => canonicalRole(r) === role);
    if (!allowed) {
      const fallback = getDashboardPath(sessionUser.role) ?? "/403";
      return <Navigate to={fallback === location.pathname ? "/403" : fallback} replace />;
    }
  }

  return children;
}

export default RequireAuth;
