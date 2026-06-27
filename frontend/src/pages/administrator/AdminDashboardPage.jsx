import DashboardLayout from "../../components/dashboard/DashboardLayout";

const stats = [
  { label: "Platform users", value: "1,284", detail: "+48 this month" },
  { label: "Active events", value: "24", detail: "Across 8 organisers" },
  { label: "Pending reviews", value: "7", detail: "Requires attention" },
];

const actions = [
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

const activity = [
  {
    title: "New organiser registered",
    description: "CyberForge requested organiser access.",
    time: "12 min ago",
  },
  {
    title: "Event submitted for review",
    description: "Cloud Security Sprint is ready for approval.",
    time: "1 hour ago",
  },
  {
    title: "Role permissions updated",
    description: "User access rules were changed.",
    time: "Yesterday",
  },
];

function AdminDashboardPage() {
  return (
    <DashboardLayout
      role="Administrator"
      eyebrow="Platform control"
      title="Administrator dashboard"
      description="Manage users, oversee events, and keep the FlagSync platform running smoothly."
      stats={stats}
      actions={actions}
      activity={activity}
    />
  );
}

export default AdminDashboardPage;
