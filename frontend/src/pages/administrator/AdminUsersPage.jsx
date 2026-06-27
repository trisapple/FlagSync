import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import { previewUsers } from "../../data/previewUsers";
import {
  getAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "../../services/adminUserService";
import { getSessionUser } from "../../utils/authSession";
import { getDashboardPath } from "../../utils/roleRoutes";
import "./AdminUsersPage.css";

const PAGE_SIZE = 5;
const ALLOWED_ROLES = ["user", "organiser", "administrator"];

function getRoleName(role) {
  return typeof role === "string" ? role : (role?.role_name ?? role?.name ?? "");
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function AdminUsersPage() {
  const location = useLocation();
  const sessionUser = getSessionUser();
  const roleName = getRoleName(sessionUser?.role);
  const dashboardPath = getDashboardPath(roleName);
  const isAdministrator = dashboardPath === "/admin/dashboard";

  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeAdministratorCount, setActiveAdministratorCount] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isPreview, setIsPreview] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationReason, setConfirmationReason] = useState("");
  const [selfConfirmation, setSelfConfirmation] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!isAdministrator) return undefined;

    let isCurrent = true;

    async function loadUsers() {
      setIsLoading(true);

      try {
        const response = await getAdminUsers({
          search: query.trim() || undefined,
          role: roleFilter === "all" ? undefined : roleFilter,
          account_status: statusFilter === "all" ? undefined : statusFilter,
          page,
          page_size: PAGE_SIZE,
        });

        if (!isCurrent) return;
        const items = Array.isArray(response)
          ? response
          : (response.items ?? response.users ?? []);
        setUsers(items);
        setTotalUsers(response.total ?? items.length);
        setActiveAdministratorCount(
          response.active_administrator_count ??
            items.filter(
              (user) =>
                user.role_name === "administrator" &&
                user.account_status === "active",
            ).length,
        );
        setIsPreview(false);
      } catch {
        if (!isCurrent) return;
        const normalizedQuery = query.trim().toLowerCase();
        const filteredUsers = previewUsers.filter((user) => {
          const matchesQuery =
            !normalizedQuery ||
            user.display_name.toLowerCase().includes(normalizedQuery) ||
            user.email.toLowerCase().includes(normalizedQuery);
          const matchesRole =
            roleFilter === "all" || user.role_name === roleFilter;
          const matchesStatus =
            statusFilter === "all" || user.account_status === statusFilter;
          return matchesQuery && matchesRole && matchesStatus;
        });
        const start = (page - 1) * PAGE_SIZE;
        setUsers(filteredUsers.slice(start, start + PAGE_SIZE));
        setTotalUsers(filteredUsers.length);
        setActiveAdministratorCount(
          previewUsers.filter(
            (user) =>
              user.role_name === "administrator" &&
              user.account_status === "active",
          ).length,
        );
        setIsPreview(true);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadUsers();
    return () => {
      isCurrent = false;
    };
  }, [isAdministrator, page, query, roleFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const isSelfAction = confirmation?.user.user_id === sessionUser?.user_id;
  const requiresSelfSafeguard =
    isSelfAction &&
    ((confirmation?.kind === "status" && confirmation.value !== "active") ||
      (confirmation?.kind === "role" &&
        confirmation.value !== "administrator"));

  const selectedUserIsFinalAdministrator = useMemo(() => {
    if (!confirmation) return false;
    const targetIsActiveAdministrator =
      confirmation.user.role_name === "administrator" &&
      confirmation.user.account_status === "active";
    const removesAdministrator =
      (confirmation.kind === "role" &&
        confirmation.value !== "administrator") ||
      (confirmation.kind === "status" && confirmation.value !== "active");
    return (
      targetIsActiveAdministrator &&
      removesAdministrator &&
      activeAdministratorCount <= 1
    );
  }, [activeAdministratorCount, confirmation]);

  if (!sessionUser) {
    return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  }

  if (!isAdministrator) {
    return <Navigate to={dashboardPath ?? "/"} replace />;
  }

  function resetPageAndSet(setter, value) {
    setPage(1);
    setter(value);
  }

  function requestAction(user, kind, value) {
    const isFinalAdministratorAction =
      user.role_name === "administrator" &&
      user.account_status === "active" &&
      activeAdministratorCount <= 1 &&
      ((kind === "role" && value !== "administrator") ||
        (kind === "status" && value !== "active"));

    if (isFinalAdministratorAction) {
      setFeedback({
        type: "error",
        text: "The final active administrator cannot be removed, suspended, or demoted.",
      });
      return;
    }

    setConfirmation({ user, kind, value });
    setConfirmationReason("");
    setSelfConfirmation("");
  }

  function closeConfirmation() {
    if (isApplying) return;
    setConfirmation(null);
    setConfirmationReason("");
    setSelfConfirmation("");
  }

  function updateUserInView(updatedUser) {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.user_id === updatedUser.user_id ? { ...user, ...updatedUser } : user,
      ),
    );
    setSelectedUser((currentUser) =>
      currentUser?.user_id === updatedUser.user_id
        ? { ...currentUser, ...updatedUser }
        : currentUser,
    );
  }

  async function applyConfirmedAction() {
    if (!confirmation || selectedUserIsFinalAdministrator) return;

    if (confirmationReason.trim().length < 5) {
      setFeedback({
        type: "error",
        text: "Enter a short reason so the backend can include it in the audit log.",
      });
      return;
    }

    if (
      requiresSelfSafeguard &&
      selfConfirmation.trim().toLowerCase() !==
        confirmation.user.email.toLowerCase()
    ) {
      setFeedback({
        type: "error",
        text: "Enter your full email address to confirm this action on your own account.",
      });
      return;
    }

    setIsApplying(true);
    setFeedback(null);

    try {
      const response =
        confirmation.kind === "status"
          ? await updateAdminUserStatus(
              confirmation.user.user_id,
              confirmation.value,
              confirmationReason.trim(),
            )
          : await updateAdminUserRole(
              confirmation.user.user_id,
              confirmation.value,
              confirmationReason.trim(),
            );
      const updatedUser = response.user ?? response;
      updateUserInView(updatedUser);
      setFeedback({
        type: "success",
        text:
          response.message ??
          `Account ${confirmation.kind} updated successfully. The backend audit log should contain this change.`,
      });
      setConfirmation(null);
      setConfirmationReason("");
      setSelfConfirmation("");
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "The account change could not be applied.",
      });
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="dashboard-shell">
      <DashboardSidebar role="Administrator" activePage="admin-users" />

      <main className="dashboard-main admin-users-main">
        <header className="admin-users-header">
          <div>
            <p className="dashboard-eyebrow">Account administration</p>
            <h1>Users</h1>
            <p>Review roles, access status, and verification details.</p>
          </div>
          <div className="admin-users-total">
            <span>Total accounts</span>
            <strong>{totalUsers}</strong>
          </div>
        </header>

        {isPreview && (
          <div className="admin-users-preview" role="status">
            Backend unavailable—showing preview accounts. Account actions still
            require the backend and are not applied in the browser.
          </div>
        )}

        {feedback && (
          <div className={`admin-users-feedback admin-users-${feedback.type}`}>
            <span>{feedback.text}</span>
            <button type="button" onClick={() => setFeedback(null)}>
              Dismiss
            </button>
          </div>
        )}

        <section className="admin-users-panel">
          <div className="admin-users-filters">
            <div className="admin-user-search">
              <label htmlFor="admin-user-search">Search users</label>
              <input
                id="admin-user-search"
                type="search"
                placeholder="Name or email"
                value={query}
                onChange={(event) =>
                  resetPageAndSet(setQuery, event.target.value)
                }
              />
            </div>
            <div>
              <label htmlFor="admin-role-filter">Role</label>
              <select
                id="admin-role-filter"
                value={roleFilter}
                onChange={(event) =>
                  resetPageAndSet(setRoleFilter, event.target.value)
                }
              >
                <option value="all">All roles</option>
                {ALLOWED_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="admin-status-filter">Account status</label>
              <select
                id="admin-status-filter"
                value={statusFilter}
                onChange={(event) =>
                  resetPageAndSet(setStatusFilter, event.target.value)
                }
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="admin-users-state">Loading accounts...</div>
          ) : users.length === 0 ? (
            <div className="admin-users-state">No matching accounts found.</div>
          ) : (
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Verified</th>
                    <th>Created</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.user_id}>
                      <td>
                        <button
                          className="admin-user-identity"
                          type="button"
                          onClick={() => setSelectedUser(user)}
                        >
                          <span aria-hidden="true">
                            {user.display_name.charAt(0).toUpperCase()}
                          </span>
                          <span>
                            <strong>{user.display_name}</strong>
                            <small>{user.email}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="admin-user-role">{user.role_name}</span>
                      </td>
                      <td>
                        <span
                          className={`admin-user-status admin-user-status-${user.account_status}`}
                        >
                          {user.account_status}
                        </span>
                      </td>
                      <td>{user.email_verified ? "Verified" : "Not verified"}</td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>
                        <button
                          className="admin-user-view"
                          type="button"
                          onClick={() => setSelectedUser(user)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="admin-users-pagination">
            <span>
              Page {page} of {pageCount}
            </span>
            <div>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((currentPage) => currentPage - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage((currentPage) => currentPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>

      {selectedUser && (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-user-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-modal-title"
          >
            <header>
              <div>
                <p className="dashboard-eyebrow">User details</p>
                <h2 id="admin-user-modal-title">{selectedUser.display_name}</h2>
              </div>
              <button type="button" onClick={() => setSelectedUser(null)}>
                Close
              </button>
            </header>

            <dl className="admin-user-details">
              <div>
                <dt>Email</dt>
                <dd>{selectedUser.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{selectedUser.role_name}</dd>
              </div>
              <div>
                <dt>Account status</dt>
                <dd>{selectedUser.account_status}</dd>
              </div>
              <div>
                <dt>Email verification</dt>
                <dd>
                  {selectedUser.email_verified ? "Verified" : "Not verified"}
                </dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDate(selectedUser.created_at)}</dd>
              </div>
              <div>
                <dt>User ID</dt>
                <dd>{selectedUser.user_id}</dd>
              </div>
            </dl>

            <div className="admin-user-management">
              <section>
                <h3>Account access</h3>
                <div>
                  {selectedUser.account_status === "active" && (
                    <button
                      type="button"
                      onClick={() =>
                        requestAction(selectedUser, "status", "suspended")
                      }
                    >
                      Suspend account
                    </button>
                  )}
                  {selectedUser.account_status === "suspended" && (
                    <button
                      type="button"
                      onClick={() =>
                        requestAction(selectedUser, "status", "active")
                      }
                    >
                      Reactivate account
                    </button>
                  )}
                  {selectedUser.account_status !== "deleted" && (
                    <button
                      className="admin-user-danger"
                      type="button"
                      onClick={() =>
                        requestAction(selectedUser, "status", "deleted")
                      }
                    >
                      Soft-delete account
                    </button>
                  )}
                </div>
              </section>

              <section>
                <h3>Change role</h3>
                <div>
                  {ALLOWED_ROLES.filter(
                    (role) => role !== selectedUser.role_name,
                  ).map((role) => (
                    <button
                      type="button"
                      key={role}
                      disabled={selectedUser.account_status === "deleted"}
                      onClick={() => requestAction(selectedUser, "role", role)}
                    >
                      Make {role}
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <p className="admin-user-security-note">
              Passwords, hashes, session tokens, reset tokens, and audit-log
              editing are intentionally unavailable here.
            </p>
          </section>
        </div>
      )}

      {confirmation && (
        <div className="admin-modal-backdrop admin-confirm-backdrop">
          <section
            className="admin-confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
          >
            <p className="dashboard-eyebrow">Confirmation required</p>
            <h2 id="admin-confirm-title">Confirm account change</h2>
            <p>
              Change <strong>{confirmation.user.display_name}</strong>’s{" "}
              {confirmation.kind} to <strong>{confirmation.value}</strong>?
            </p>

            <label htmlFor="admin-action-reason">
              Reason for audit log
              <textarea
                id="admin-action-reason"
                rows="3"
                maxLength="500"
                placeholder="Explain why this change is required"
                value={confirmationReason}
                onChange={(event) => setConfirmationReason(event.target.value)}
              />
            </label>

            {requiresSelfSafeguard && (
              <label htmlFor="admin-self-confirmation">
                This affects your own administrator account. Enter your full
                email to continue.
                <input
                  id="admin-self-confirmation"
                  type="email"
                  placeholder={confirmation.user.email}
                  value={selfConfirmation}
                  onChange={(event) => setSelfConfirmation(event.target.value)}
                />
              </label>
            )}

            <div className="admin-confirm-actions">
              <button type="button" onClick={closeConfirmation}>
                Cancel
              </button>
              <button
                className="admin-confirm-primary"
                type="button"
                disabled={isApplying || selectedUserIsFinalAdministrator}
                onClick={applyConfirmedAction}
              >
                {isApplying ? "Applying..." : "Confirm change"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminUsersPage;
