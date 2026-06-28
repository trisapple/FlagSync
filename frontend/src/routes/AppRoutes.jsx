import { Route, Routes } from "react-router-dom";
import HomePage from "../pages/public/HomePage";
import LoginPage from "../pages/public/LoginPage";
import RegisterPage from "../pages/public/RegisterPage";
import EventsPage from "../pages/public/EventsPage";
import EventDetailsPage from "../pages/public/EventDetailsPage";
import NotFoundPage from "../pages/errors/NotFoundPage";
import AdminDashboardPage from "../pages/administrator/AdminDashboardPage";
import AdminUsersPage from "../pages/administrator/AdminUsersPage";
import AuditLogsPage from "../pages/administrator/AuditLogsPage";
import OrganiserDashboardPage from "../pages/organiser/OrganiserDashboardPage";
import ManageEventsPage from "../pages/organiser/ManageEventsPage";
import UserDashboardPage from "../pages/user/UserDashboardPage";
import RegisteredEventsPage from "../pages/user/RegisteredEventsPage";
import AccountProfilePage from "../pages/account/ProfilePage";
import ForbiddenPage from "../pages/errors/ForbiddenPage";
import { DASHBOARD_PATHS } from "../utils/roleRoutes";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/events/registered" element={<RegisteredEventsPage />} />
      <Route path="/events/:eventId" element={<EventDetailsPage />} />
      <Route path="/organiser/events/manage" element={<ManageEventsPage />} />
      <Route path="/profile" element={<AccountProfilePage />} />
      <Route path="/admin/users" element={<AdminUsersPage />} />
      <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route
        path={DASHBOARD_PATHS.administrator}
        element={<AdminDashboardPage />}
      />
      <Route
        path={DASHBOARD_PATHS.organiser}
        element={<OrganiserDashboardPage />}
      />
      <Route path={DASHBOARD_PATHS.user} element={<UserDashboardPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
