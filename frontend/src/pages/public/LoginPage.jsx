import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { login } from "../../services/auth_service";

function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");

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

    try {
      const result = await login(formData);
      setMessageType("success");
      setMessage(result.message ?? "Login successful");
      navigate("/profile");
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
          <div className="kicker">FlagSync Security</div>
          <h1 className="hero-title">Protected login for the CTF workspace.</h1>
          <p className="hero-text">
            Passwords are hashed with Argon2 or bcrypt, sessions are stored in
            HttpOnly cookies, and repeated failures are rate-limited with a
            lockout counter.
          </p>
          <div className="hero-points">
            <span className="pill">JWT session cookie</span>
            <span className="pill">Brute-force lockout</span>
            <span className="pill">Redis-backed tracking</span>
          </div>
          <div className="inline-actions">
            <Link className="button button-secondary" to="/register">
              Register
            </Link>
            <Link className="button button-secondary" to="/">
              Home
            </Link>
          </div>
        </article>

        <article className="surface auth-card">
          <div>
            <h2 className="card-title">Sign in</h2>
            <p className="helper">
              Use the account provided for your event or challenge environment.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field" htmlFor="email">
              <span className="label">Email</span>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </label>

            <label className="field" htmlFor="password">
              <span className="label">Password</span>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </label>

            <button
              className="button button-primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Login"}
            </button>
          </form>

          {message ? (
            <p className={`status status-${messageType}`}>{message}</p>
          ) : null}
        </article>
      </section>
    </main>
  );
}

export default LoginPage;
