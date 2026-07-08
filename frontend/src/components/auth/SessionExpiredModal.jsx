import { useState } from "react";
import { login, resendLoginOtp, verifyLoginOtp } from "../../services/authService";
import { clearSessionUser, saveSessionUser } from "../../utils/authSession";
import "./SessionExpiredModal.css";

function SessionExpiredModal({ onSuccess }) {
  const [step, setStep] = useState("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loginIntentId, setLoginIntentId] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleCredentialsSubmit(event) {
    event.preventDefault();
    setFeedback({ type: "", text: "" });
    setIsSubmitting(true);

    try {
      const result = await login({ email, password });
      setLoginIntentId(result.login_intent_id);
      setOtp("");
      setStep("otp");
    } catch (error) {
      setFeedback({ type: "error", text: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOtpChange(event) {
    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
  }

  async function handleOtpSubmit(event) {
    event.preventDefault();
    setFeedback({ type: "", text: "" });

    if (otp.length !== 6) {
      setFeedback({ type: "error", text: "Enter the 6-digit code from your email." });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await verifyLoginOtp({ loginIntentId, otp });
      const user = result.user ?? result;

      saveSessionUser({
        user_id: user.user_id ?? result.user_id ?? "",
        role: user.role ?? user.role_name ?? result.role ?? result.role_name,
        email: user.email ?? result.email ?? "",
        display_name: user.display_name ?? result.display_name ?? "",
      });

      onSuccess();
    } catch (error) {
      setFeedback({ type: "error", text: error.message });
      setOtp("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setIsResending(true);
    setFeedback({ type: "", text: "" });

    try {
      const result = await resendLoginOtp(loginIntentId);
      setLoginIntentId(result.login_intent_id);
      setOtp("");
      setFeedback({ type: "success", text: "A new code has been sent to your email." });
    } catch (error) {
      setFeedback({ type: "error", text: error.message });
    } finally {
      setIsResending(false);
    }
  }

  function handleSwitchAccount() {
    clearSessionUser();
    window.location.href = "/login";
  }

  return (
    <div className="session-modal-backdrop" role="presentation">
      <section
        className="session-expired-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
      >
        <p className="public-eyebrow">Session expired</p>
        <h2 id="session-expired-title">Sign in to continue</h2>
        <p className="login-form-intro">
          Your session timed out for security reasons. Sign in again to pick up
          right where you left off.
        </p>

        {step === "credentials" ? (
          <form className="login-form" onSubmit={handleCredentialsSubmit}>
            <div className="login-field">
              <label htmlFor="session-email">Email address</label>
              <input
                id="session-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="session-password">Password</label>
              <input
                id="session-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
        ) : (
          <form className="login-form" onSubmit={handleOtpSubmit}>
            <p className="login-form-intro">
              We sent a 6-digit code to <strong>{email}</strong>.
            </p>

            <div className="login-field">
              <label htmlFor="session-otp">Verification code</label>
              <input
                id="session-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={handleOtpChange}
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
              disabled={isSubmitting || otp.length !== 6}
            >
              {isSubmitting ? "Verifying..." : "Verify and sign in"}
            </button>

            <p className="auth-switch">
              Didn't get the code?{" "}
              <button
                type="button"
                className="auth-switch-link"
                onClick={handleResend}
                disabled={isResending}
              >
                {isResending ? "Sending..." : "Resend code"}
              </button>
            </p>
          </form>
        )}

        <p className="auth-switch">
          Not you?{" "}
          <button type="button" className="auth-switch-link" onClick={handleSwitchAccount}>
            Sign in with a different account
          </button>
        </p>
      </section>
    </div>
  );
}

export default SessionExpiredModal;
