import { Route, Routes } from "react-router-dom";
import RequireGuest from "../components/auth/RequireGuest";
import HomePage from "../pages/public/HomePage";
import LoginPage from "../pages/public/LoginPage";
import LoginOtpPage from "../pages/public/LoginOtpPage";
import RegisterPage from "../pages/public/RegisterPage";
import VerifyEmailPage from "../pages/public/VerifyEmailPage";
import ForgotPasswordPage from "../pages/public/ForgotPasswordPage";
import ResetPasswordPage from "../pages/public/ResetPasswordPage";
import EventsPage from "../pages/public/EventsPage";
import EventDetailsPage from "../pages/public/EventDetailsPage";
import NotFoundPage from "../pages/errors/NotFoundPage";
import AdminDashboardPage from "../pages/administrator/AdminDashboardPage";
import AdminUsersPage from "../pages/administrator/AdminUsersPage";
import AuditLogsPage from "../pages/administrator/AuditLogsPage";
import OrganiserRequestsPage from "../pages/administrator/OrganiserRequestsPage";
import OrganiserDashboardPage from "../pages/organiser/OrganiserDashboardPage";
import ManageEventsPage from "../pages/organiser/ManageEventsPage";
import CreateEventPage from "../pages/organiser/CreateEventPage";
import EditEventPage from "../pages/organiser/EditEventPage";
import EventAnnouncementsPage from "../pages/organiser/EventAnnouncementsPage";
import EventAnalyticsPage from "../pages/organiser/EventAnalyticsPage";
import EventResourcesPage from "../pages/organiser/EventResourcesPage";
import EventParticipantsPage from "../pages/organiser/EventParticipantsPage";
import EventChallengesOrganiserPage from "../pages/organiser/EventChallengesPage";
import EventChallengesPage from "../pages/public/EventChallengesPage";
import EventLeaderboardPage from "../pages/public/EventLeaderboardPage";
import RequireAuth from "../components/auth/RequireAuth";
import UserDashboardPage from "../pages/user/UserDashboardPage";
import RegisteredEventsPage from "../pages/user/RegisteredEventsPage";
import AccountProfilePage from "../pages/account/ProfilePage";
import ForbiddenPage from "../pages/errors/ForbiddenPage";
import { DASHBOARD_PATHS } from "../utils/roleRoutes";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/login"
        element={
          <RequireGuest>
            <LoginPage />
          </RequireGuest>
        }
      />
      <Route
        path="/login/verify-otp"
        element={
          <RequireGuest>
            <LoginOtpPage />
          </RequireGuest>
        }
      />
      <Route
        path="/register"
        element={
          <RequireGuest>
            <RegisterPage />
          </RequireGuest>
        }
      />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/events/registered" element={<RegisteredEventsPage />} />
      <Route path="/events/:eventId" element={<EventDetailsPage />} />
      <Route
        path="/organiser/events/manage"
        element={
          <RequireAuth allowedRoles={["organiser"]}>
            <ManageEventsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/organiser/events/new"
        element={
          <RequireAuth allowedRoles={["organiser"]}>
            <CreateEventPage />
          </RequireAuth>
        }
      />
      <Route
        path="/organiser/events/:eventId/edit"
        element={
          <RequireAuth allowedRoles={["organiser"]}>
            <EditEventPage />
          </RequireAuth>
        }
      />
      <Route
        path="/organiser/events/:eventId/announcements"
        element={
          <RequireAuth allowedRoles={["organiser"]}>
            <EventAnnouncementsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/organiser/events/:eventId/analytics"
        element={
          <RequireAuth allowedRoles={["organiser"]}>
            <EventAnalyticsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/organiser/events/:eventId/participants"
        element={
          <RequireAuth allowedRoles={["organiser"]}>
            <EventParticipantsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/organiser/events/:eventId/challenges"
        element={
          <RequireAuth allowedRoles={["organiser"]}>
            <EventChallengesOrganiserPage />
          </RequireAuth>
        }
      />
      <Route
        path="/events/:eventId/challenges"
        element={<EventChallengesPage />}
      />
      <Route
        path="/events/:eventId/leaderboard"
        element={<EventLeaderboardPage />}
      />
      <Route
        path="/organiser/events/:eventId/resources"
        element={
          <RequireAuth allowedRoles={["organiser"]}>
            <EventResourcesPage />
          </RequireAuth>
        }
      />
      <Route path="/profile" element={<AccountProfilePage />} />
      <Route
        path="/admin/users"
        element={
          <RequireAuth allowedRoles={["administrator"]}>
            <AdminUsersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <RequireAuth allowedRoles={["administrator"]}>
            <AuditLogsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/organiser-requests"
        element={
          <RequireAuth allowedRoles={["administrator"]}>
            <OrganiserRequestsPage />
          </RequireAuth>
        }
      />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route
        path={DASHBOARD_PATHS.administrator}
        element={
          <RequireAuth allowedRoles={["administrator"]}>
            <AdminDashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path={DASHBOARD_PATHS.organiser}
        element={
          <RequireAuth allowedRoles={["organiser"]}>
            <OrganiserDashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path={DASHBOARD_PATHS.user}
        element={
          <RequireAuth allowedRoles={["user"]}>
            <UserDashboardPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
