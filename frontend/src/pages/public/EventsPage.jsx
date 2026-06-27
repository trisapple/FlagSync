import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import { availableEvents } from "../../data/previewEvents";
import {
  formatEventDate,
  formatEventFormat,
  formatEventType,
  getEventDateBadge,
  getRegistrationStatus,
  getTeamLabel,
} from "../../utils/eventPresentation";
import "./EventsPage.css";

function EventsPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [format, setFormat] = useState("all");

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return availableEvents.filter((event) => {
      if (event.status !== "published") return false;

      const matchesQuery =
        !normalizedQuery ||
        [event.event_name, event.organiser_name, event.description].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      const matchesType = type === "all" || event.event_type === type;
      const matchesFormat = format === "all" || event.event_format === format;

      return matchesQuery && matchesType && matchesFormat;
    });
  }, [format, query, type]);

  function clearFilters() {
    setQuery("");
    setType("all");
    setFormat("all");
  }

  return (
    <PublicLayout>
      <main>
        <section className="events-hero">
          <div className="public-container">
            <p className="public-eyebrow">Explore opportunities</p>
            <h1>Find your next challenge.</h1>
            <p>
              Browse available CTF competitions and hackathons, then find the
              event that fits your skills, interests, and team.
            </p>
          </div>
        </section>

        <section className="events-catalogue">
          <div className="public-container">
            <div className="events-filter-panel">
              <div className="events-search-field">
                <label htmlFor="event-search">Search events</label>
                <div>
                  <span aria-hidden="true">⌕</span>
                  <input
                    id="event-search"
                    type="search"
                    placeholder="Search by name, organiser, or topic"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
              </div>

              <div className="events-select-field">
                <label htmlFor="event-type">Event type</label>
                <select
                  id="event-type"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                >
                  <option value="all">All types</option>
                  <option value="ctf">CTF</option>
                  <option value="hackathon">Hackathon</option>
                </select>
              </div>

              <div className="events-select-field">
                <label htmlFor="event-format">Format</label>
                <select
                  id="event-format"
                  value={format}
                  onChange={(event) => setFormat(event.target.value)}
                >
                  <option value="all">All formats</option>
                  <option value="online">Online</option>
                  <option value="in_person">In person</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            <div className="events-results-heading">
              <div>
                <h2>Available events</h2>
                <p>
                  {filteredEvents.length} event
                  {filteredEvents.length === 1 ? "" : "s"} found
                </p>
              </div>
              {(query || type !== "all" || format !== "all") && (
                <button type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>

            {filteredEvents.length > 0 ? (
              <div className="events-grid">
                {filteredEvents.map((event) => {
                  const dateBadge = getEventDateBadge(event.start_date);
                  const registrationStatus = getRegistrationStatus(event);

                  return (
                  <article className="event-card" key={event.event_id}>
                    <div className="event-card-top">
                      <div className="event-date" aria-label={formatEventDate(event)}>
                        <span>{dateBadge.month}</span>
                        <strong>{dateBadge.day}</strong>
                      </div>
                      <div className="event-card-labels">
                        <span className="event-type-label">
                          {formatEventType(event.event_type)}
                        </span>
                        <span
                          className={`event-status event-status-${registrationStatus.key}`}
                        >
                          {registrationStatus.label}
                        </span>
                      </div>
                    </div>

                    <div className="event-card-body">
                      <p className="event-organiser">
                        Hosted by {event.organiser_name}
                      </p>
                      <h3>{event.event_name}</h3>
                      <p className="event-description">{event.description}</p>
                    </div>

                    <dl className="event-details">
                      <div>
                        <dt>Format</dt>
                        <dd>{formatEventFormat(event.event_format)}</dd>
                      </div>
                      <div>
                        <dt>Date</dt>
                        <dd>{formatEventDate(event)}</dd>
                      </div>
                      <div>
                        <dt>Team</dt>
                        <dd>{getTeamLabel(event)}</dd>
                      </div>
                    </dl>

                    <div className="event-card-footer">
                      <Link to={`/events/${event.event_id}`}>View event details</Link>
                      <span aria-hidden="true">→</span>
                    </div>
                  </article>
                  );
                })}
              </div>
            ) : (
              <div className="events-empty-state">
                <span aria-hidden="true">⌕</span>
                <h2>No matching events</h2>
                <p>Try a different search term or clear your filters.</p>
                <button type="button" onClick={clearFilters}>
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

export default EventsPage;
