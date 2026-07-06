import { Navigate, useLocation } from "react-router-dom";
import { useSessionUser } from "../../hooks/useSessionUser";
import { getDashboardPath } from "../../utils/roleRoutes";

function RequireGuest({ children }) {
  const sessionUser = useSessionUser();
  const location = useLocation();

  if (sessionUser) {
    const dashboardPath = getDashboardPath(sessionUser.role) ?? "/";
    return <Navigate to={dashboardPath} replace state={{ from: location }} />;
  }

  return children;
}

export default RequireGuest;
