import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  deleteCurrentUser,
  getCurrentUser,
  logout,
  updateCurrentUser,
} from "../../services/auth_service";

function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    display_name: "",
    email: "",
    current_password: "",
    new_password: "",
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    getCurrentUser()
      .then((currentUser) => {
        if (!ignore) {
          setUser(currentUser);
          setFormData((current) => ({
            ...current,
            display_name: currentUser.display_name,
            email: currentUser.email,
          }));
        }
      })
      .catch((error) => {
        if (!ignore) {
          setMessageType("error");
          setMessage(error.message);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const payload = {
      display_name: formData.display_name,
      email: formData.email,
    };

    if (formData.new_password) {
      payload.current_password = formData.current_password;
      payload.new_password = formData.new_password;
    }

    try {
      const result = await updateCurrentUser(payload);
      setMessageType("success");
      setMessage(result.message ?? "Profile updated");
      setUser(null);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  async function handleDelete() {
    if (!window.confirm("Delete this account?")) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const result = await deleteCurrentUser();
      setMessageType("success");
      setMessage(result.message ?? "Account deleted");
      setUser(null);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-frame">
      <section className="shell hero-grid">
        <article className="surface hero-copy">
          <div className="kicker">Account</div>
          <h1 className="hero-title">Your FlagSync profile.</h1>
          <p className="hero-text">
            Profile changes and account deletion are protected by the current
            authenticated session and recorded for audit review.
          </p>
          <div className="inline-actions">
            <Link className="button button-secondary" to="/">
              Home
            </Link>
            <button className="button button-secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </article>

        <article className="surface auth-card">
          <div>
            <h2 className="card-title">Profile</h2>
            <p className="helper">
              {user
                ? `Signed in as ${user.role_name ?? "user"}`
                : "Login is required to view this page."}
            </p>
          </div>

          {user ? (
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="field" htmlFor="display_name">
                <span className="label">Display name</span>
                <input
                  className="input"
                  id="display_name"
                  name="display_name"
                  type="text"
                  value={formData.display_name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="field" htmlFor="email">
                <span className="label">Email</span>
                <input
                  className="input"
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="field" htmlFor="current_password">
                <span className="label">Current password</span>
                <input
                  className="input"
                  id="current_password"
                  name="current_password"
                  type="password"
                  autoComplete="current-password"
                  value={formData.current_password}
                  onChange={handleChange}
                />
              </label>

              <label className="field" htmlFor="new_password">
                <span className="label">New password</span>
                <input
                  className="input"
                  id="new_password"
                  name="new_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={formData.new_password}
                  onChange={handleChange}
                />
              </label>

              <div className="inline-actions">
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save"}
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                >
                  Delete
                </button>
              </div>
            </form>
          ) : (
            <Link className="button button-primary" to="/login">
              Login
            </Link>
          )}

          {message ? (
            <p className={`status status-${messageType}`}>{message}</p>
          ) : null}
        </article>
      </section>
    </main>
  );
}

export default ProfilePage;
