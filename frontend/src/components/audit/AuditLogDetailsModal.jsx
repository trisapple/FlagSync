import { useEffect } from "react";
import { formatAuditAction, getSafeAuditDetails } from "../../utils/auditLogPresentation";
import "./AuditLogDetailsModal.css";

function formatValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function AuditLogDetailsModal({ log, onClose }) {
  const safeDetails = getSafeAuditDetails(log.details);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="audit-modal-backdrop" role="presentation">
      <section
        className="audit-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-details-title"
      >
        <header>
          <div>
            <p>Audit log details</p>
            <h2 id="audit-details-title">{formatAuditAction(log.action_type)}</h2>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <dl className="audit-details-summary">
          <div>
            <dt>Log ID</dt>
            <dd>{log.log_id || "Unavailable"}</dd>
          </div>
          <div>
            <dt>Result</dt>
            <dd>{log.result || "Unknown"}</dd>
          </div>
          <div>
            <dt>Resource type</dt>
            <dd>{log.resource_type || "Unknown"}</dd>
          </div>
          <div>
            <dt>Resource ID</dt>
            <dd>{log.resource_id || "Unavailable"}</dd>
          </div>
        </dl>

        <div className="audit-safe-details">
          <h3>Safe change details</h3>
          {safeDetails.length > 0 ? (
            <dl>
              {safeDetails.map((detail) => (
                <div key={detail.key}>
                  <dt>{detail.label}</dt>
                  <dd>{formatValue(detail.value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>No additional safe details are available for this log.</p>
          )}
        </div>

        <p className="audit-details-security-note">
          Sensitive authentication data, raw request bodies, and stack traces are
          never displayed.
        </p>
      </section>
    </div>
  );
}

export default AuditLogDetailsModal;
