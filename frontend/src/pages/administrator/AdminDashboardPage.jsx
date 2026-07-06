import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { getAdminUsers } from "../../services/adminUserService";
import { getAuditLogs } from "../../services/auditLogService";
import { formatAuditAction } from "../../utils/auditLogPresentation";

const ACTIONS = [
  {
    icon: "U",
    title: "Manage users",
    description: "Review accounts, roles, and platform access.",
  },
  {
    icon: "E",
    title: "Review events",
    description: "Approve new competitions before they are published.",
  },
  {
    icon: "R",
    title: "View reports",
    description: "Monitor activity and platform performance.",
  },
];

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function AdminDashboardPage() {
  const [totalUsers, setTotalUsers] = useState("—");
  const [activeAdminCount, setActiveAdminCount] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    getAdminUsers({ page: 1, page_size: 1 })
      .then((response) => {
        setTotalUsers(
          (response.total ?? "—").toLocaleString(),
        );
        if (response.active_administrator_count != null) {
          setActiveAdminCount(response.active_administrator_count);
        }
      })
      .catch(() => {
        setTotalUsers("—");
      });
  }, []);

  useEffect(() => {
    getAuditLogs({ page: 1, page_size: 5, order: "desc" })
      .then(({ items }) => {
        setRecentActivity(
          items.map((log) => ({
            title: formatAuditAction(log.action_type),
            description:
              log.details?.reason
                ? `Reason: ${log.details.reason}`
                : `Resource: ${log.resource_type ?? "—"} ${log.resource_id ?? ""}`.trim(),
            time: timeAgo(log.created_at),
          })),
        );
      })
      .catch(() => {
        setRecentActivity([]);
      });
  }, []);

  const stats = [
    {
      label: "Platform users",
      value: totalUsers,
      detail:
        activeAdminCount != null
          ? `${activeAdminCount} active administrator${activeAdminCount === 1 ? "" : "s"}`
          : "Loading...",
    },
    {
      label: "Active events",
      value: "—",
      detail: "—",
    },
    {
      label: "Pending reviews",
      value: "—",
      detail: "—",
    },
  ];

  const activity =
    recentActivity.length > 0
      ? recentActivity
      : [{ title: "No recent activity", description: "Audit log is empty.", time: "" }];

  return (
    <DashboardLayout
      role="Administrator"
      eyebrow="Platform control"
      title="Administrator dashboard"
      description="Manage users, oversee events, and keep the FlagSync platform running smoothly."
      stats={stats}
      actions={ACTIONS}
      activity={activity}
    />
  );
}

export default AdminDashboardPage;
