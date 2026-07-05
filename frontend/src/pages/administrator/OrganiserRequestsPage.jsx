import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import {
  approveOrganiserRequest,
  listOrganiserRequestsForAdmin,
  rejectOrganiserRequest,
} from "../../services/organiserRequestService";
import { getSessionUser } from "../../utils/authSession";
import { getDashboardPath } from "../../utils/roleRoutes";
import "./AdminUsersPage.css";
import "./OrganiserRequestsPage.css";

const STATUS_FILTERS = ["all", "pending", "approved", "rejected"];

function getRoleName(role) {
  return typeof role === "string" ? role : (role?.role_name ?? role?.name ?? "");
}

function formatDate(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function OrganiserRequestsPage() {
  const location = useLocation();
  const sessionUser = getSessionUser();
  const roleName = getRoleName(sessionUser?.role);
  const dashboardPath = getDashboardPath(roleName);
  const isAdministrator = dashboardPath === "/admin/dashboard";

  const [statusFilter, setStatusFilter] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [applyingId, setApplyingId] = useState(null);

  useEffect(() => {
    if (!isAdministrator) return undefined;

    let isCurrent = true;

    async function loadRequests() {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await listOrganiserRequestsForAdmin(
          statusFilter === "all" ? null : statusFilter,
        );
        if (!isCurrent) return;
        setRequests(Array.isArray(response) ? response : []);
      } catch (error) {
        if (!isCurrent) return;
        setLoadError(error.message || "Unable to load organiser requests.");
        setRequests([]);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadRequests();
    return () => {
      isCurrent = false;
    };
  }, [isAdministrator, statusFilter]);

  if (!sessionUser) {
    return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  }

  if (!isAdministrator) {
    return <Navigate to={dashboardPath ?? "/"} replace />;
  }

  async function handleDecision(request, decision) {
    setApplyingId(request.request_id);
    setFeedback(null);

    try {
      const updated =
        decision === "approve"
          ? await approveOrganiserRequest(request.request_id)
          : await rejectOrganiserRequest(request.request_id);

      setRequests((current) =>
        current
          .map((existing) =>
            existing.request_id === request.request_id
              ? { ...existing, ...updated }
              : existing,
          )
          .filter((existing) =>
            statusFilter === "all" ? true : existing.status === statusFilter,
          ),
      );

      setFeedback({
        type: "success",
        text:
          decision === "approve"
            ? `${request.applicant_display_name} is now an organiser.`
            : `Request from ${request.applicant_display_name} was rejected.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to update the request.",
      });
    } finally {
      setApplyingId(null);
    }
  }

  const pendingCount = requests.filter(
    (request) => request.status === "pending",
  ).length;

  return (
    <div className="dashboard-shell">
      <DashboardSidebar activePage="organiser-requests" />

      <main className="dashboard-main admin-users-main">
        <header className="admin-users-header">
          <div>
            <p className="dashboard-eyebrow">Account administration</p>
            <h1>Organiser requests</h1>
            <p>Review and approve users who want to become organisers.</p>
          </div>
          <div className="admin-users-total">
            <span>{statusFilter === "all" ? "Pending" : "In view"}</span>
            <strong>
              {statusFilter === "all" ? pendingCount : requests.length}
            </strong>
          </div>
        </header>

        {feedback && (
          <div className={`admin-users-feedback admin-users-${feedback.type}`}>
            <span>{feedback.text}</span>
            <button type="button" onClick={() => setFeedback(null)}>
              Dismiss
            </button>
          </div>
        )}

        {loadError && (
          <div className="admin-users-feedback admin-users-error">
            <span>{loadError}</span>
          </div>
        )}

        <section className="admin-users-panel">
          <div className="admin-users-filters organiser-requests-filters">
            <div>
              <label htmlFor="organiser-status-filter">Status</label>
              <select
                id="organiser-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="admin-users-state">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="admin-users-state">No matching requests.</div>
          ) : (
            <ul className="organiser-request-list">
              {requests.map((request) => (
                <li
                  className="organiser-request-item"
                  key={request.request_id}
                >
                  <div className="organiser-request-header">
                    <div className="admin-user-identity">
                      <span aria-hidden="true">
                        {request.applicant_display_name
                          ?.charAt(0)
                          .toUpperCase() || "U"}
                      </span>
                      <span>
                        <strong>{request.applicant_display_name}</strong>
                        <small>{request.applicant_email}</small>
                      </span>
                    </div>
                    <span
                      className={`organiser-request-status organiser-request-status-${request.status}`}
                    >
                      {request.status}
                    </span>
                  </div>

                  <dl className="organiser-request-details">
                    <div>
                      <dt>Submitted</dt>
                      <dd>{formatDate(request.created_at)}</dd>
                    </div>
                    {request.decided_at && (
                      <div>
                        <dt>Decided</dt>
                        <dd>{formatDate(request.decided_at)}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="organiser-request-reason">
                    <span>Reason</span>
                    <p>
                      {request.reason?.trim()
                        ? request.reason
                        : "No reason provided."}
                    </p>
                  </div>

                  {request.status === "pending" && (
                    <div className="organiser-request-actions">
                      <button
                        type="button"
                        className="organiser-request-reject"
                        disabled={applyingId === request.request_id}
                        onClick={() => handleDecision(request, "reject")}
                      >
                        {applyingId === request.request_id
                          ? "Working..."
                          : "Reject"}
                      </button>
                      <button
                        type="button"
                        className="organiser-request-approve"
                        disabled={applyingId === request.request_id}
                        onClick={() => handleDecision(request, "approve")}
                      >
                        {applyingId === request.request_id
                          ? "Working..."
                          : "Approve"}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default OrganiserRequestsPage;
