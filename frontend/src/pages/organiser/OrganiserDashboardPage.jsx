import DashboardLayout from "../../components/dashboard/DashboardLayout";

const stats = [
  { label: "Active events", value: "4", detail: "2 accepting registrations" },
  { label: "Registrations", value: "386", detail: "+72 this week" },
  { label: "Upcoming events", value: "3", detail: "Next event in 6 days" },
];

const actions = [
  {
    icon: "+",
    title: "Create an event",
    description: "Set up a new CTF competition or hackathon.",
  },
  {
    icon: "P",
    title: "Manage participants",
    description: "Review registrations and participant details.",
  },
  {
    icon: "S",
    title: "Publish results",
    description: "Update rankings and announce event winners.",
  },
];

const activity = [
  {
    title: "New team registered",
    description: "ByteBusters joined Summer Cyber Clash.",
    time: "8 min ago",
  },
  {
    title: "Registration milestone reached",
    description: "SecureHack 2026 now has 100 participants.",
    time: "3 hours ago",
  },
  {
    title: "Event details updated",
    description: "The challenge schedule was successfully published.",
    time: "Yesterday",
  },
];

function OrganiserDashboardPage() {
  return (
    <DashboardLayout
      role="Organiser"
      eyebrow="Event management"
      title="Organiser dashboard"
      description="Create memorable competitions, manage registrations, and follow every event from one place."
      stats={stats}
      actions={actions}
      activity={activity}
    />
  );
}

export default OrganiserDashboardPage;
