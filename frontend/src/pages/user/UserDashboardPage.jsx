import DashboardLayout from "../../components/dashboard/DashboardLayout";

const stats = [
  { label: "Registered events", value: "5", detail: "2 currently active" },
  { label: "Challenges solved", value: "38", detail: "+6 this week" },
  { label: "Team ranking", value: "#12", detail: "Top 8% overall" },
];

const actions = [
  {
    icon: "D",
    title: "Discover events",
    description: "Find upcoming CTF competitions and hackathons.",
  },
  {
    icon: "T",
    title: "Manage your team",
    description: "Invite teammates and review your shared events.",
  },
  {
    icon: "C",
    title: "Continue competing",
    description: "Return to your active challenges and submissions.",
  },
];

const activity = [
  {
    title: "Challenge completed",
    description: "You solved Hidden in Plain Sight for 250 points.",
    time: "20 min ago",
  },
  {
    title: "Team invitation accepted",
    description: "A new member joined ByteBusters.",
    time: "2 hours ago",
  },
  {
    title: "Event reminder",
    description: "Cloud Security Sprint begins this Saturday.",
    time: "Yesterday",
  },
];

function UserDashboardPage() {
  return (
    <DashboardLayout
      role="User"
      eyebrow="Your competition hub"
      title="User dashboard"
      description="Track your events, team progress, and latest competition activity in one place."
      stats={stats}
      actions={actions}
      activity={activity}
    />
  );
}

export default UserDashboardPage;
