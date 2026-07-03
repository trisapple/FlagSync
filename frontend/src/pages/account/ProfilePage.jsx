import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import GuestSignInPrompt from "../../components/auth/GuestSignInPrompt";
import { getCurrentUser } from "../../services/authService";
import {
  changePassword,
  deleteAccount,
  updateProfile,
} from "../../services/accountService";
import { getSessionUser } from "../../utils/authSession";
import { useSessionUser } from "../../hooks/useSessionUser";
import "./ProfilePage.css";

const initialProfile = {
  email: "",
  display_name: "",
  role_name: "user",
  account_status: "active",
  email_verified: false,
  created_at: "",
};

const initialPasswordForm = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

function createInitialProfile() {
  const sessionUser = getSessionUser();
  const sessionRole =
    typeof sessionUser?.role === "string"
      ? sessionUser.role
      : (sessionUser?.role?.role_name ?? sessionUser?.role?.name ?? "user");

  return {
    ...initialProfile,
    user_id: sessionUser?.user_id ?? "",
    email: sessionUser?.email ?? "",
    display_name: sessionUser?.display_name ?? "",
    role_name: sessionRole,
  };
}

function formatRole(role) {
  if (!role) return "User";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatDate(date) {
  if (!date) return "Not available";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function ProfilePage() {
  const navigate = useNavigate();
  const sessionUser = useSessionUser();
  const [profile, setProfile] = useState(createInitialProfile);
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });
  const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" });
  const [accountMessage, setAccountMessage] = useState({ type: "", text: "" });

  function redirectToLogin(message) {
    window.setTimeout(() => {
      navigate("/login", {
        replace: true,
        state: { type: "success", message },
      });
    }, 900);
  }

  useEffect(() => {
    if (!sessionUser) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadProfile() {
      try {
        const result = await getCurrentUser();
        const user = result.user ?? result;

        if (isMounted) {
          setProfile((currentProfile) => ({
            ...currentProfile,
            ...user,
            role_name:
              user.role_name ??
              user.role?.role_name ??
              user.role?.name ??
              user.role ??
              currentProfile.role_name,
          }));
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error.message || "Unable to load your profile.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [sessionUser]);

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileMessage({ type: "", text: "" });
    setIsSavingProfile(true);

    try {
      const result = await updateProfile({
        display_name: profile.display_name.trim(),
      });
      const message = result.message ?? "Display name updated. Please log in again.";
      setProfileMessage({ type: "success", text: message });
      redirectToLogin(message);
    } catch (error) {
      setProfileMessage({
        type: "error",
        text: error.message || "Unable to update your display name.",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;
    setPasswordForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordMessage({ type: "", text: "" });

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setIsSavingPassword(true);

    try {
      const result = await changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      const message = result.message ?? "Password updated. Please log in again.";
      setPasswordForm(initialPasswordForm);
      setPasswordMessage({ type: "success", text: message });
      redirectToLogin(message);
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: error.message || "Unable to update your password.",
      });
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    if (!window.confirm("Delete this account? This action cannot be undone.")) {
      return;
    }

    setAccountMessage({ type: "", text: "" });
    setIsDeletingAccount(true);

    try {
      const result = await deleteAccount();
      const message = result.message ?? "Account deleted.";
      setAccountMessage({ type: "success", text: message });
      redirectToLogin(message);
    } catch (error) {
      setAccountMessage({
        type: "error",
        text: error.message || "Unable to delete your account.",
      });
    } finally {
      setIsDeletingAccount(false);
    }
  }

  if (!sessionUser) {
    return (
      <GuestSignInPrompt
        eyebrow="Profile"
        heading="Sign in to view your profile."
        subtext="Your account details will appear here."
      />
    );
  }

  const role = formatRole(profile.role_name);
  const profileInitial = profile.display_name?.charAt(0).toUpperCase() || "U";

  return (
    <div className="dashboard-shell">
      <DashboardSidebar role={role} activePage="profile" />

      <main className="dashboard-main profile-main">
        <header className="profile-header">
          <div>
            <p className="dashboard-eyebrow">Account settings</p>
            <h1>Profile</h1>
            <p>Manage the personal information and password for your account.</p>
          </div>
        </header>

        {loadError && (
          <p className="profile-status profile-status-error" role="alert">
            {loadError}
          </p>
        )}

        <section className="profile-summary-card">
          <div className="profile-avatar" aria-hidden="true">
            {profileInitial}
          </div>
          <div>
            <h2>{profile.display_name || (isLoading ? "Loading profile..." : "User")}</h2>
            <p>{profile.email || "Email unavailable"}</p>
          </div>
          <span className="profile-role-badge">{role}</span>
        </section>

        <div className="profile-content-grid">
          <div className="profile-form-stack">
            <section className="profile-card">
              <div className="profile-card-heading">
                <h2>Personal information</h2>
                <p>Your email identifies your account and cannot be changed.</p>
              </div>

              <form className="profile-form" onSubmit={handleProfileSubmit}>
                <div className="profile-field">
                  <label htmlFor="display_name">Display name</label>
                  <input
                    id="display_name"
                    name="display_name"
                    type="text"
                    minLength="2"
                    maxLength="100"
                    value={profile.display_name}
                    onChange={(event) =>
                      setProfile((currentProfile) => ({
                        ...currentProfile,
                        display_name: event.target.value,
                      }))
                    }
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="profile_email">Email address</label>
                  <input
                    className="profile-readonly-input"
                    id="profile_email"
                    type="email"
                    value={profile.email}
                    readOnly
                    aria-readonly="true"
                  />
                  <small>Email changes are not permitted.</small>
                </div>

                {profileMessage.text && (
                  <p
                    className={`profile-status profile-status-${profileMessage.type}`}
                    role="status"
                  >
                    {profileMessage.text}
                  </p>
                )}

                <div className="profile-form-actions">
                  <button
                    className="profile-primary-button"
                    type="submit"
                    disabled={isLoading || isSavingProfile || isDeletingAccount}
                  >
                    {isSavingProfile ? "Saving..." : "Save display name"}
                  </button>
                </div>
              </form>
            </section>

            <section className="profile-card">
              <div className="profile-card-heading">
                <h2>Change password</h2>
                <p>Use at least 12 characters for your new password.</p>
              </div>

              <form className="profile-form" onSubmit={handlePasswordSubmit}>
                <div className="profile-field">
                  <label htmlFor="current_password">Current password</label>
                  <input
                    id="current_password"
                    name="current_password"
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.current_password}
                    onChange={handlePasswordChange}
                    required
                  />
                </div>

                <div className="profile-password-grid">
                  <div className="profile-field">
                    <label htmlFor="new_password">New password</label>
                    <input
                      id="new_password"
                      name="new_password"
                      type="password"
                      autoComplete="new-password"
                      minLength="12"
                      value={passwordForm.new_password}
                      onChange={handlePasswordChange}
                      required
                    />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="confirm_password">Confirm new password</label>
                    <input
                      id="confirm_password"
                      name="confirm_password"
                      type="password"
                      autoComplete="new-password"
                      minLength="12"
                      value={passwordForm.confirm_password}
                      onChange={handlePasswordChange}
                      required
                    />
                  </div>
                </div>

                {passwordMessage.text && (
                  <p
                    className={`profile-status profile-status-${passwordMessage.type}`}
                    role="status"
                  >
                    {passwordMessage.text}
                  </p>
                )}

                <div className="profile-form-actions">
                  <button
                    className="profile-primary-button"
                    type="submit"
                    disabled={isSavingPassword || isDeletingAccount}
                  >
                    {isSavingPassword ? "Updating..." : "Update password"}
                  </button>
                </div>
              </form>
            </section>
          </div>

          <aside className="profile-account-card">
            <h2>Account details</h2>
            <dl>
              <div>
                <dt>Status</dt>
                <dd className="profile-active-status">{profile.account_status}</dd>
              </div>
              <div>
                <dt>Email verification</dt>
                <dd>{profile.email_verified ? "Verified" : "Not verified"}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{role}</dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>{formatDate(profile.created_at)}</dd>
              </div>
            </dl>

            <div className="profile-danger-zone">
              <h3>Delete account</h3>
              <p>This deactivates your account and signs you out.</p>
              {accountMessage.text && (
                <p
                  className={`profile-status profile-status-${accountMessage.type}`}
                  role={accountMessage.type === "error" ? "alert" : "status"}
                >
                  {accountMessage.text}
                </p>
              )}
              <button
                className="profile-danger-button"
                type="button"
                onClick={handleDeleteAccount}
                disabled={isLoading || isDeletingAccount}
              >
                {isDeletingAccount ? "Deleting..." : "Delete account"}
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default ProfilePage;
