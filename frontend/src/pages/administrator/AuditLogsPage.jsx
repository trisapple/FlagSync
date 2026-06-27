import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import AuditLogDetailsModal from "../../components/audit/AuditLogDetailsModal";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import { getAuditLogs } from "../../services/auditLogService";
import { getSessionUser } from "../../utils/authSession";
import { canAccessAuditLogs } from "../../utils/auditLogAccess";
import { formatAuditAction } from "../../utils/auditLogPresentation";
import "./AuditLogsPage.css";

const PAGE_SIZE = 20;
const EMPTY_FILTERS = {
  actionType: "",
  result: "all",
  actor: "",
  dateFrom: "",
  dateTo: "",
};

function getRoleName(role) {
  return typeof role === "string" ? role : (role?.role_name ?? role?.name ?? "");
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "Unknown date";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function getActorLabel(log) {
  if (!log.actor_user_id) return "Unknown or deleted user";
  return log.actor_display_name || log.actor_email || log.actor_user_id;
}

function AuditLogsPage() {
  const location = useLocation();
  const sessionUser = getSessionUser();
  const isAdministrator = canAccessAuditLogs(getRoleName(sessionUser?.role));
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    if (!isAdministrator) return undefined;
    let isCurrent = true;

    async function loadLogs() {
      setIsLoading(true);
      setHasError(false);
      try {
        const response = await getAuditLogs({
          action_type: appliedFilters.actionType.trim() || undefined,
          result:
            appliedFilters.result === "all" ? undefined : appliedFilters.result,
          actor: appliedFilters.actor.trim() || undefined,
          date_from: appliedFilters.dateFrom || undefined,
          date_to: appliedFilters.dateTo || undefined,
          page,
          page_size: PAGE_SIZE,
          order: "created_at_desc",
        });
        if (!isCurrent) return;
        setLogs(response.items);
        setTotalLogs(response.total);
      } catch {
        if (!isCurrent) return;
        setLogs([]);
        setTotalLogs(0);
        setHasError(true);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadLogs();
    return () => {
      isCurrent = false;
    };
  }, [appliedFilters, isAdministrator, page]);

  if (!sessionUser) {
    return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  }
  if (!isAdministrator) return <Navigate to="/403" replace />;

  const pageCount = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE));

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters({ ...filters });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  }

  return (
    <div className="dashboard-shell">
      <DashboardSidebar role="Administrator" activePage="audit-logs" />
      <main className="dashboard-main audit-logs-main">
        <header className="audit-logs-header">
          <div>
            <p className="dashboard-eyebrow">Security and accountability</p>
            <h1>Audit logs</h1>
            <p>Review immutable records of important actions across FlagSync.</p>
          </div>
          <div className="audit-logs-total">
            <span>Total records</span>
            <strong>{totalLogs}</strong>
          </div>
        </header>

        <section className="audit-logs-panel">
          <form className="audit-log-filters" onSubmit={applyFilters}>
            <div>
              <label htmlFor="audit-action-filter">Action type</label>
              <input
                id="audit-action-filter"
                type="search"
                placeholder="e.g. user role changed"
                value={filters.actionType}
                onChange={(event) => updateFilter("actionType", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="audit-result-filter">Result</label>
              <select
                id="audit-result-filter"
                value={filters.result}
                onChange={(event) => updateFilter("result", event.target.value)}
              >
                <option value="all">All results</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
                <option value="denied">Denied</option>
              </select>
            </div>
            <div>
              <label htmlFor="audit-actor-filter">Actor</label>
              <input
                id="audit-actor-filter"
                type="search"
                placeholder="User ID or email"
                value={filters.actor}
                onChange={(event) => updateFilter("actor", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="audit-date-from">From date</label>
              <input
                id="audit-date-from"
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(event) => updateFilter("dateFrom", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="audit-date-to">To date</label>
              <input
                id="audit-date-to"
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(event) => updateFilter("dateTo", event.target.value)}
              />
            </div>
            <div className="audit-filter-actions">
              <button type="submit">Apply filters</button>
              <button type="button" onClick={clearFilters}>Clear</button>
            </div>
          </form>

          {isLoading ? (
            <div className="audit-logs-state" role="status">Loading audit logs...</div>
          ) : hasError ? (
            <div className="audit-logs-state audit-logs-error" role="alert">
              <h2>Audit logs could not be loaded</h2>
              <p>Please try again later.</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="audit-logs-state">
              <h2>No audit logs found</h2>
              <p>Try changing or clearing the current filters.</p>
            </div>
          ) : (
            <div className="audit-logs-table-wrap">
              <table className="audit-logs-table">
                <thead>
                  <tr>
                    <th>Date and time</th><th>Actor</th><th>Action</th>
                    <th>Resource</th><th>Result</th><th>View details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.log_id}>
                      <td>{formatTimestamp(log.created_at)}</td>
                      <td>
                        <span className={!log.actor_user_id ? "audit-actor-unknown" : ""}>
                          {getActorLabel(log)}
                        </span>
                      </td>
                      <td>{formatAuditAction(log.action_type)}</td>
                      <td><strong>{log.resource_type || "Unknown"}</strong><small>{log.resource_id || "No resource ID"}</small></td>
                      <td><span className={`audit-result audit-result-${log.result}`}>{log.result || "unknown"}</span></td>
                      <td><button type="button" onClick={() => setSelectedLog(log)}>View details</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="audit-pagination">
            <span>Page {page} of {pageCount}</span>
            <div>
              <button type="button" disabled={page <= 1 || isLoading} onClick={() => setPage((value) => value - 1)}>Previous</button>
              <button type="button" disabled={page >= pageCount || isLoading} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          </div>
        </section>
      </main>

      {selectedLog && (
        <AuditLogDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}

export default AuditLogsPage;
