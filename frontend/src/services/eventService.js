import apiClient from "../api/axiosClient";

const EVENTS_BASE = "/events";

export async function listMyEvents() {
  const response = await apiClient.get(EVENTS_BASE);
  return response.data;
}

export async function listPublishedEvents() {
  const response = await apiClient.get(`${EVENTS_BASE}/published`);
  return response.data;
}

export async function getPublishedEvent(eventId) {
  const response = await apiClient.get(
    `${EVENTS_BASE}/published/${eventId}`,
  );
  return response.data;
}

export async function getEvent(eventId) {
  const response = await apiClient.get(`${EVENTS_BASE}/${eventId}`);
  return response.data;
}

export async function createEvent(eventDetails) {
  const response = await apiClient.post(EVENTS_BASE, eventDetails);
  return response.data;
}

export async function updateEvent(eventId, changes) {
  const response = await apiClient.patch(
    `${EVENTS_BASE}/${eventId}`,
    changes,
  );
  return response.data;
}

export async function deleteEvent(eventId) {
  await apiClient.delete(`${EVENTS_BASE}/${eventId}`);
}

export async function getEventAnalytics(eventId) {
  const response = await apiClient.get(
    `${EVENTS_BASE}/${eventId}/analytics`,
  );
  return response.data;
}

export async function getOrganiserStats() {
  const response = await apiClient.get(`${EVENTS_BASE}/mine/stats`);
  return response.data;
}
