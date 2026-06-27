const REGISTRATION_KEY = "flagsync_preview_event_registrations";

function getRegistrationKey(user) {
  const accountKey = user?.email || String(user?.role || "anonymous");
  return `${REGISTRATION_KEY}:${accountKey}`;
}

export function isEventRegistered(user, eventId) {
  return getRegisteredEventIds(user).includes(String(eventId));
}

export function getRegisteredEventIds(user) {
  try {
    const registrations = JSON.parse(
      sessionStorage.getItem(getRegistrationKey(user)) || "[]",
    );
    return Array.isArray(registrations) ? registrations.map(String) : [];
  } catch {
    return [];
  }
}

export function registerEventForSession(user, eventId) {
  const key = getRegistrationKey(user);
  let registrations;

  try {
    registrations = JSON.parse(sessionStorage.getItem(key) || "[]");
  } catch {
    registrations = [];
  }

  const updatedRegistrations = [...new Set([...registrations, String(eventId)])];
  sessionStorage.setItem(key, JSON.stringify(updatedRegistrations));
}
