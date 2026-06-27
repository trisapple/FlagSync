import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login } from "../../services/authService";
import { getDashboardPath } from "../../utils/roleRoutes";
import { saveSessionUser } from "../../utils/authSession";
import PublicLayout from "../../components/public/PublicLayout";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
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
    setError("");
    setIsSubmitting(true);

    try {
      const result = await login(credentials);
      const role =
        result.user?.role ??
        result.user?.role_name ??
        result.role ??
        result.role_name;
      const dashboardPath = getDashboardPath(role);

      if (!dashboardPath) {
        throw new Error("Your account does not have a supported dashboard role.");
      }

      saveSessionUser({
        user_id: result.user?.user_id ?? result.user_id ?? "",
        role,
        email: result.user?.email ?? result.email ?? "",
        display_name: result.user?.display_name ?? result.display_name ?? "",
      });
      navigate(location.state?.returnTo ?? dashboardPath, { replace: true });
    } catch (loginError) {
      setError(loginError.message || "Unable to log in. Please try again.");
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
                    <span aria-hidden="true">✓</span> One place for every event
                  </li>
                  <li>
                    <span aria-hidden="true">✓</span> Role-specific dashboards
                  </li>
                  <li>
                    <span aria-hidden="true">✓</span> Clear team and event updates
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

                {error && (
                  <p className="login-error" role="alert">
                    {error}
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
