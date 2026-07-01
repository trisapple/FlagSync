import apiClient from "../api/axiosClient";

export async function getMyTeamForEvent(eventId) {
  const response = await apiClient.get(`/events/${eventId}/teams/mine`);
  return response.data;
}

export async function createTeamForEvent(eventId, teamName) {
  const response = await apiClient.post(`/events/${eventId}/teams`, {
    team_name: teamName,
  });
  return response.data;
}

export async function joinTeamByCode(inviteCode) {
  const response = await apiClient.post("/teams/join", {
    invite_code: inviteCode,
  });
  return response.data;
}

export async function listEventTeams(eventId) {
  const response = await apiClient.get(`/events/${eventId}/teams`);
  return response.data;
}
