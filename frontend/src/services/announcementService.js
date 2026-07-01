import apiClient from "../api/axiosClient";

export async function listEventAnnouncements(eventId) {
  const response = await apiClient.get(`/events/${eventId}/announcements`);
  return response.data;
}

export async function createEventAnnouncement(eventId, body) {
  const response = await apiClient.post(
    `/events/${eventId}/announcements`,
    body,
  );
  return response.data;
}

export async function deleteAnnouncement(announcementId) {
  await apiClient.delete(`/announcements/${announcementId}`);
}
