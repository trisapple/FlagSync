import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import { login } from "../../services/authService";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });
  const [feedback, setFeedback] = useState(() =>
    location.state?.message
      ? {
          type: location.state.type ?? "success",
          text: location.state.message,
        }
      : { type: "", text: "" },
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setCredentials((currentCredentials) => ({
      ...currentCredentials,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ type: "", text: "" });
    setIsSubmitting(true);

    try {
      const result = await login(credentials);
      navigate("/login/verify-otp", {
        replace: true,
        state: {
          loginIntentId: result.login_intent_id,
          email: credentials.email,
          returnTo: location.state?.returnTo,
        },
      });
    } catch {
      setFeedback({ type: "error", text: "Invalid email or password." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PublicLayout actionTo="/" actionLabel="Back home" showNavigation={false}>
      <main className="login-main">
        <div className="public-container">
          <section className="login-panel">
            <div className="login-context">
              <div>
                <p className="public-eyebrow">Welcome back</p>
                <h1>Your next challenge is waiting.</h1>
                <p>
                  Sign in to reach the workspace designed for your role and
                  pick up exactly where you left off.
                </p>
                <ul className="login-context-list">
                  <li>
                    <span aria-hidden="true">OK</span> One place for every event
                  </li>
                  <li>
                    <span aria-hidden="true">OK</span> Role-specific dashboards
                  </li>
                  <li>
                    <span aria-hidden="true">OK</span> Clear team and event updates
                  </li>
                </ul>
              </div>
              <p className="login-context-note">
                FlagSync keeps the noise out and the important details close.
              </p>
            </div>

            <div className="login-form-side">
              <p className="public-eyebrow">Account access</p>
              <h2>Sign in to FlagSync</h2>
              <p className="login-form-intro">
                Enter your account details to continue to your dashboard.
              </p>

              <form className="login-form" onSubmit={handleSubmit}>
                <div className="login-field">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={credentials.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={handleChange}
                    required
                  />
                </div>

                {feedback.text && (
                  <p
                    className={`login-status login-status-${feedback.type}`}
                    role={feedback.type === "error" ? "alert" : "status"}
                  >
                    {feedback.text}
                  </p>
                )}

                <button
                  className="public-button public-button-primary login-submit"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <p className="auth-switch">
                New to FlagSync? <Link to="/register">Create an account</Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </PublicLayout>
  );
}

export default LoginPage;
