import { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import { requestPasswordReset } from "../../services/authService";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ type: "", text: "" });
    setIsSubmitting(true);

    try {
      const result = await requestPasswordReset(email);
      setIsSubmitted(true);
      setFeedback({
        type: "success",
        text:
          result.message ??
          "If that email is registered, we've sent a password reset link.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Unable to send a reset link right now.",
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
              <h2>Reset your password</h2>
              <p className="login-form-intro">
                Enter the email address on your account and we'll send you a
                link to reset your password.
              </p>

              {!isSubmitted && (
                <form className="login-form" onSubmit={handleSubmit}>
                  <div className="login-field">
                    <label htmlFor="email">Email address</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
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
                    {isSubmitting ? "Sending..." : "Send reset link"}
                  </button>
                </form>
              )}

              {isSubmitted && (
                <p
                  className={`login-status login-status-${feedback.type}`}
                  role="status"
                >
                  {feedback.text}
                </p>
              )}

              <p className="auth-switch">
                Remembered your password? <Link to="/login">Sign in</Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </PublicLayout>
  );
}

export default ForgotPasswordPage;
