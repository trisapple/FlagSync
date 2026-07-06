const DATE_FORMAT = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Singapore",
});

const TIME_FORMAT = new Intl.DateTimeFormat("en-SG", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Singapore",
});

export function formatEventType(type) {
  return type === "ctf" ? "CTF" : "Hackathon";
}

export function formatEventFormat(format) {
  const labels = {
    online: "Online",
    hybrid: "Hybrid",
    in_person: "In person",
  };
  return labels[format] ?? format;
}

export function formatEventDate(event) {
  const start = new Date(event.start_date);
  const end = new Date(event.end_date);
  const startLabel = DATE_FORMAT.format(start);
  const endLabel = DATE_FORMAT.format(end);
  return startLabel === endLabel ? startLabel : `${startLabel}–${endLabel}`;
}

export function formatEventTime(event) {
  return `${TIME_FORMAT.format(new Date(event.start_date))}–${TIME_FORMAT.format(
    new Date(event.end_date),
  )} SGT`;
}

export function formatDeadline(deadline) {
  return deadline ? DATE_FORMAT.format(new Date(deadline)) : "No deadline";
}

export function getEventDateBadge(startDate) {
  const date = new Date(startDate);
  return {
    month: new Intl.DateTimeFormat("en-SG", {
      month: "short",
      timeZone: "Asia/Singapore",
    }).format(date),
    day: new Intl.DateTimeFormat("en-SG", {
      day: "2-digit",
      timeZone: "Asia/Singapore",
    }).format(date),
    year: new Intl.DateTimeFormat("en-SG", {
      year: "numeric",
      timeZone: "Asia/Singapore",
    }).format(date),
  };
}

export function getTeamLabel(event) {
  return event.team_mode ? `Up to ${event.max_team_size} members` : "Solo";
}

export function getRegistrationStatus(event) {
  if (event.status === "cancelled") {
    return { label: "Cancelled", key: "closed" };
  }
  if (event.status === "closed") {
    return { label: "Registration closed", key: "closed" };
  }
  if (!event.registration_deadline) {
    return { label: "Registration open", key: "open" };
  }

  const millisecondsRemaining =
    new Date(event.registration_deadline).getTime() - Date.now();
  if (millisecondsRemaining <= 0) {
    return { label: "Registration closed", key: "closed" };
  }
  if (millisecondsRemaining <= 3 * 24 * 60 * 60 * 1000) {
    return { label: "Closing soon", key: "closing" };
  }
  return { label: "Registration open", key: "open" };
}
