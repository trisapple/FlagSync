const SESSION_USER_KEY = "flagsync_session_user";
export const SESSION_CHANGE_EVENT = "flagsync-session-change";
export const SESSION_EXPIRED_EVENT = "flagsync-session-expired";

let sessionExpiredActive = false;

function notifySessionChange() {
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

// Guards against every failed request on a page dispatching its own modal.
export function notifySessionExpired() {
  if (sessionExpiredActive) return;
  sessionExpiredActive = true;
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export function clearSessionExpired() {
  sessionExpiredActive = false;
}

export function saveSessionUser(user) {
  sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  notifySessionChange();
}

export function getSessionUser() {
  try {
    const storedUser = sessionStorage.getItem(SESSION_USER_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    sessionStorage.removeItem(SESSION_USER_KEY);
    return null;
  }
}

export function clearSessionUser() {
  sessionStorage.removeItem(SESSION_USER_KEY);
  notifySessionChange();
}
