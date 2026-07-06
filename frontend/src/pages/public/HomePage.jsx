import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import { useSessionUser } from "../../hooks/useSessionUser";
import { listPublishedEvents } from "../../services/eventService";
import { getDashboardPath } from "../../utils/roleRoutes";

const features = [
  {
    icon: "01",
    title: "Discover competitions",
    description:
      "Explore upcoming CTFs and hackathons without digging through scattered announcements.",
  },
  {
    icon: "02",
    title: "Keep teams in sync",
    description:
      "Track registrations, teammates, schedules, and updates from one shared workspace.",
  },
  {
    icon: "03",
    title: "Run better events",
    description:
      "Give organisers a clear view of participants, activity, and competition progress.",
  },
];

function eventTypeBadge(type) {
  if (type === "ctf") return "CTF";
  if (type === "hackathon") return "HCK";
  return (type ?? "EVT").slice(0, 3).toUpperCase();
}

function eventDetail(event) {
  const now = Date.now();
  const start = new Date(event.start_date).getTime();
  const diffMs = start - now;
  const dayMs = 1000 * 60 * 60 * 24;

  if (diffMs > 0) {
    const days = Math.ceil(diffMs / dayMs);
    if (days === 1) return "Starts tomorrow";
    if (days <= 30) return `Starts in ${days} days`;
    return new Date(event.start_date).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const end = new Date(event.end_date).getTime();
  if (end > now) return "Happening now";
  return "Ended";
}

function HomePage() {
  const sessionUser = useSessionUser();
  const dashboardPath = getDashboardPath(sessionUser?.role);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  useEffect(() => {
    let ignore = false;
    listPublishedEvents()
      .then((events) => {
        if (ignore) return;
        const now = Date.now();
        const upcoming = events
          .filter((event) => new Date(event.start_date).getTime() > now)
          .slice(0, 3);
        setUpcomingEvents(upcoming);
      })
      .catch(() => {
        if (!ignore) setUpcomingEvents([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <PublicLayout>
      <main>
        <section className="home-hero">
          <div className="public-container home-hero-grid">
            <div className="home-hero-copy">
              <p className="public-eyebrow">Compete. Organise. Stay in sync.</p>
              <h1>
                Every competition, <span>one clear view.</span>
              </h1>
              <p>
                FlagSync brings CTF competitions, hackathons, teams, and event
                updates together so everyone knows what is happening next.
              </p>
              <div className="home-hero-actions">
                {dashboardPath ? (
                  <>
                    <Link
                      className="public-button public-button-primary"
                      to={dashboardPath}
                    >
                      Go to dashboard
                    </Link>
                    <Link
                      className="public-button public-button-secondary"
                      to="/events"
                    >
                      Browse events
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      className="public-button public-button-primary"
                      to="/register"
                    >
                      Create your account
                    </Link>
                    <Link
                      className="public-button public-button-secondary"
                      to="/login"
                    >
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="home-preview-card" aria-label="Upcoming event preview">
              <div className="home-preview-top">
                <span>Upcoming events</span>
                <span className="home-live-label">Live platform</span>
              </div>
              <div className="home-event-list">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map((event) => (
                    <Link
                      className="home-event-row"
                      key={event.event_id}
                      to={`/events/${event.event_id}`}
                    >
                      <span className="home-event-icon" aria-hidden="true">
                        {eventTypeBadge(event.event_type)}
                      </span>
                      <div>
                        <strong>{event.event_name}</strong>
                        <p>{eventDetail(event)}</p>
                      </div>
                      <span className="home-event-meta">View -&gt;</span>
                    </Link>
                  ))
                ) : (
                  <article className="home-event-row">
                    <div>
                      <strong>No upcoming events yet</strong>
                      <p>Organisers haven't published anything new.</p>
                    </div>
                  </article>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="home-feature-section" id="features">
          <div className="public-container">
            <div className="home-section-heading">
              <p className="public-eyebrow">Built for the whole community</p>
              <h2>Less searching. More building and competing.</h2>
              <p>
                A focused workspace for users, organisers, and administrators
                across every stage of an event.
              </p>
            </div>

            <div className="home-feature-grid">
              {features.map((feature) => (
                <article className="home-feature-card" key={feature.title}>
                  <span className="home-feature-icon" aria-hidden="true">
                    {feature.icon}
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="home-process-section" id="how-it-works">
          <div className="public-container">
            <div className="home-section-heading">
              <p className="public-eyebrow">Simple by design</p>
              <h2>From discovery to results.</h2>
            </div>
            <div className="home-process-grid">
              <article className="home-process-card">
                <span className="home-process-number">1</span>
                <h3>Find the right event</h3>
                <p>Browse opportunities and choose what your team wants to tackle.</p>
              </article>
              <article className="home-process-card">
                <span className="home-process-number">2</span>
                <h3>Join and prepare</h3>
                <p>Keep the important details, deadlines, and teammates together.</p>
              </article>
              <article className="home-process-card">
                <span className="home-process-number">3</span>
                <h3>Compete with clarity</h3>
                <p>Follow progress and updates without losing focus on the challenge.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="home-cta-section">
          <div className="public-container home-cta">
            <div>
              <h2>
                {dashboardPath
                  ? "Your FlagSync workspace is ready."
                  : "Ready for your next challenge?"}
              </h2>
              <p>
                {dashboardPath
                  ? "Continue to your role-specific dashboard."
                  : "Sign in and see what is waiting in your workspace."}
              </p>
            </div>
            <Link
              className="public-button public-button-primary"
              to={dashboardPath ?? "/register"}
            >
              {dashboardPath ? "Go to dashboard" : "Create an account"}
            </Link>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

export default HomePage;
