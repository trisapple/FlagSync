import apiClient from "../api/axiosClient";

export async function listEventResources(eventId) {
  const response = await apiClient.get(`/events/${eventId}/resources`);
  return response.data;
}

export async function uploadResource(eventId, file, challengeId = null) {
  const formData = new FormData();
  formData.append("file", file);
  const url = challengeId
    ? `/events/${eventId}/resources?challenge_id=${challengeId}`
    : `/events/${eventId}/resources`;
  const response = await apiClient.post(url, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function getResourceDownloadUrl(resourceId) {
  const response = await apiClient.get(
    `/resources/${resourceId}/download`,
  );
  return response.data;
}

export async function deleteResource(resourceId) {
  await apiClient.delete(`/resources/${resourceId}`);
}
