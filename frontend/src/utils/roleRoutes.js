export const DASHBOARD_PATHS = Object.freeze({
  administrator: "/admin/dashboard",
  organiser: "/organiser/dashboard",
  user: "/user/dashboard",
});

const ROLE_ALIASES = Object.freeze({
  admin: "administrator",
  administrator: "administrator",
  organizer: "organiser",
  organiser: "organiser",
  user: "user",
});

export function getDashboardPath(role) {
  const roleName =
    typeof role === "string" ? role : (role?.role_name ?? role?.name);
  const normalizedRole = roleName?.trim().toLowerCase();
  const canonicalRole = ROLE_ALIASES[normalizedRole];

  return DASHBOARD_PATHS[canonicalRole] ?? null;
}

export function canRegisterForEvents(role) {
  return getDashboardPath(role) === DASHBOARD_PATHS.user;
}
