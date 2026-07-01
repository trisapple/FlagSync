import apiClient from "../api/axiosClient";

export async function listEventChallenges(eventId) {
  const response = await apiClient.get(`/events/${eventId}/challenges`);
  return response.data;
}

export async function createEventChallenge(eventId, body) {
  const response = await apiClient.post(`/events/${eventId}/challenges`, body);
  return response.data;
}

export async function submitFlag(challengeId, submittedFlag) {
  const response = await apiClient.post(`/challenges/${challengeId}/submit`, {
    submitted_flag: submittedFlag,
  });
  return response.data;
}

export async function listChallengeFiles(challengeId) {
  const response = await apiClient.get(`/challenges/${challengeId}/files`);
  return response.data;
}

export async function deleteChallenge(challengeId) {
  await apiClient.delete(`/challenges/${challengeId}`);
}

export async function getEventLeaderboard(eventId) {
  const response = await apiClient.get(`/events/${eventId}/leaderboard`);
  return response.data;
}
