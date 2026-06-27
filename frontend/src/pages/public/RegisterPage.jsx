import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import { register } from "../../services/authService";

const initialFormData = {
  display_name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormData);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        display_name: formData.display_name.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });
      navigate("/login", { replace: true });
    } catch (registrationError) {
      setError(
        registrationError.message ||
          "Unable to create your account. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PublicLayout actionTo="/login" actionLabel="Sign in" showNavigation={false}>
      <main className="login-main register-main">
        <div className="public-container">
          <section className="login-panel register-panel">
            <div className="login-context register-context">
              <div>
                <p className="public-eyebrow">Join FlagSync</p>
                <h1>Make your next event easier to follow.</h1>
                <p>
                  Create one account for your competitions, teams, schedules,
                  and updates.
                </p>
                <ul className="login-context-list">
                  <li>
                    <span aria-hidden="true">✓</span> Discover upcoming events
                  </li>
                  <li>
                    <span aria-hidden="true">✓</span> Keep your team organised
                  </li>
                  <li>
                    <span aria-hidden="true">✓</span> Track everything in one view
                  </li>
                </ul>
              </div>
              <p className="login-context-note">
                Public registrations create a standard user account.
              </p>
            </div>

            <div className="login-form-side register-form-side">
              <p className="public-eyebrow">Create your account</p>
              <h2>Get started with FlagSync</h2>
              <p className="login-form-intro">
                Enter your details below. You can update your profile later.
              </p>

              <form className="login-form" onSubmit={handleSubmit}>
                <div className="login-field">
                  <label htmlFor="display_name">Display name</label>
                  <input
                    id="display_name"
                    name="display_name"
                    type="text"
                    autoComplete="name"
                    minLength="2"
                    maxLength="120"
                    placeholder="How should we address you?"
                    value={formData.display_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="register-password-grid">
                  <div className="login-field">
                    <label htmlFor="password">Password</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength="12"
                      placeholder="At least 12 characters"
                      value={formData.password}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="login-field">
                    <label htmlFor="confirmPassword">Confirm password</label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength="12"
                      placeholder="Repeat your password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                    />
                  </div>
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
                  {isSubmitting ? "Creating account..." : "Create account"}
                </button>
              </form>

              <p className="auth-switch">
                Already have an account? <Link to="/login">Sign in</Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </PublicLayout>
  );
}

export default RegisterPage;
