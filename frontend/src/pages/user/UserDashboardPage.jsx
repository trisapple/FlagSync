import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { listMyRegistrations } from "../../services/registrationService";

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

function UserDashboardPage() {
  const [registrations, setRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    listMyRegistrations()
      .then((data) => {
        if (!ignore) setRegistrations(data);
      })
      .catch(() => {
        if (!ignore) setRegistrations([]);
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const registeredCount = registrations.length;
  const activeCount = registrations.filter(
    (r) => r.registration_status === "registered",
  ).length;
  const waitlistedCount = registrations.filter(
    (r) => r.registration_status === "waitlisted",
  ).length;

  const stats = [
    {
      label: "Registered events",
      value: isLoading ? "—" : String(registeredCount),
      detail: `${activeCount} confirmed, ${waitlistedCount} waitlisted`,
    },
  ];

  return (
    <DashboardLayout
      role="User"
      eyebrow="Your competition hub"
      title="User dashboard"
      description="Track your events, team progress, and latest competition activity in one place."
      stats={stats}
      actions={actions}
    />
  );
}

export default UserDashboardPage;
