import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { getOrganiserStats } from "../../services/eventService";

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

function OrganiserDashboardPage() {
  const [statsData, setStatsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    getOrganiserStats()
      .then((data) => {
        if (!ignore) setStatsData(data);
      })
      .catch(() => {
        if (!ignore) setStatsData(null);
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const stats = [
    {
      label: "Active events",
      value: isLoading ? "—" : String(statsData?.active_events ?? 0),
      detail: "Published and accepting participants",
    },
    {
      label: "Registrations",
      value: isLoading ? "—" : String(statsData?.total_registrations ?? 0),
      detail: "Confirmed across all your events",
    },
    {
      label: "Upcoming events",
      value: isLoading ? "—" : String(statsData?.upcoming_events ?? 0),
      detail: "Events yet to start",
    },
  ];

  return (
    <DashboardLayout
      role="Organiser"
      eyebrow="Event management"
      title="Organiser dashboard"
      description="Create memorable competitions, manage registrations, and follow every event from one place."
      stats={stats}
      actions={actions}
    />
  );
}

export default OrganiserDashboardPage;
