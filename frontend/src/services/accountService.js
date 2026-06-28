import {
  deleteCurrentUser,
  updateCurrentUser,
} from "./authService";

export async function updateProfile(profileDetails) {
  return updateCurrentUser(profileDetails);
}

export async function changePassword(passwordDetails) {
  return updateCurrentUser(passwordDetails);
}

export async function deleteAccount() {
  return deleteCurrentUser();
}
