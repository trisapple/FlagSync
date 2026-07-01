import apiClient from "../api/axiosClient";

export async function registerForEvent(eventId) {
  const response = await apiClient.post(`/events/${eventId}/register`);
  return response.data;
}

export async function unregisterFromEvent(eventId) {
  await apiClient.delete(`/events/${eventId}/register`);
}

export async function listMyRegistrations() {
  const response = await apiClient.get("/me/registrations");
  return response.data;
}

export async function listEventParticipants(eventId) {
  const response = await apiClient.get(`/events/${eventId}/participants`);
  return response.data;
}
