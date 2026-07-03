import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import { confirmPasswordReset } from "../../services/authService";

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ type: "", text: "" });

    if (form.newPassword !== form.confirmPassword) {
      setFeedback({ type: "error", text: "Passwords do not match." });
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset({ token, newPassword: form.newPassword });
      setIsSuccess(true);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to reset your password.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PublicLayout actionTo="/login" actionLabel="Sign in" showNavigation={false}>
      <main className="login-main">
        <div
          className="public-container"
          style={{ display: "flex", justifyContent: "center" }}
        >
          <section
            className="login-panel"
            style={{
              gridTemplateColumns: "minmax(0, 1fr)",
              maxWidth: 540,
              width: "100%",
            }}
          >
            <div className="login-form-side">
              <p className="public-eyebrow">Account access</p>

              {!token && (
                <>
                  <h2>Reset link invalid</h2>
                  <p className="login-status login-status-error" role="alert">
                    This password reset link is missing a token.
                  </p>
                  <p className="auth-switch">
                    Request a new link from the{" "}
                    <Link to="/forgot-password">forgot password</Link> page.
                  </p>
                </>
              )}

              {token && isSuccess && (
                <>
                  <h2>Password reset</h2>
                  <p className="login-form-intro">
                    Your password has been updated. You can now sign in with
                    your new password.
                  </p>
                  <Link
                    className="public-button public-button-primary login-submit"
                    to="/login"
                  >
                    Continue to sign in
                  </Link>
                </>
              )}

              {token && !isSuccess && (
                <>
                  <h2>Choose a new password</h2>
                  <p className="login-form-intro">
                    Enter a new password for your account.
                  </p>

                  <form className="login-form" onSubmit={handleSubmit}>
                    <div className="login-field">
                      <label htmlFor="newPassword">New password</label>
                      <input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Enter a new password"
                        value={form.newPassword}
                        onChange={handleChange}
                        minLength={12}
                        required
                      />
                    </div>

                    <div className="login-field">
                      <label htmlFor="confirmPassword">
                        Confirm new password
                      </label>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Re-enter your new password"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        minLength={12}
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
                      {isSubmitting ? "Resetting..." : "Reset password"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </PublicLayout>
  );
}

export default ResetPasswordPage;
