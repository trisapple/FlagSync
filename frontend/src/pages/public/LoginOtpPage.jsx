import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import { resendLoginOtp, verifyLoginOtp } from "../../services/authService";
import { saveSessionUser } from "../../utils/authSession";
import { getDashboardPath } from "../../utils/roleRoutes";

const RESEND_COOLDOWN = 60;

function LoginOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialIntentId = location.state?.loginIntentId;
  const email = location.state?.email ?? "your email";
  const returnTo = location.state?.returnTo;

  const [loginIntentId, setLoginIntentId] = useState(initialIntentId);
  const [otp, setOtp] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (!initialIntentId) {
      navigate("/login", { replace: true });
    }
  }, [initialIntentId, navigate]);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, []);

  function startCountdown() {
    clearInterval(countdownRef.current);
    setCountdown(RESEND_COOLDOWN);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    setIsResending(true);
    setFeedback({ type: "", text: "" });
    try {
      const result = await resendLoginOtp(loginIntentId);
      setLoginIntentId(result.login_intent_id);
      setOtp("");
      startCountdown();
      setFeedback({ type: "success", text: "A new code has been sent to your email." });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err.message || "Failed to resend code. Please try again.",
      });
    } finally {
      setIsResending(false);
    }
  }

  function handleOtpChange(event) {
    const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(digitsOnly);
  }

  async function handleSubmit(event) {
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
      const role = user.role ?? user.role_name ?? result.role ?? result.role_name;
      const dashboardPath = getDashboardPath(role);

      if (!dashboardPath) {
        throw new Error("Your account does not have a supported dashboard role.");
      }

      saveSessionUser({
        user_id: user.user_id ?? result.user_id ?? "",
        role,
        email: user.email ?? result.email ?? "",
        display_name: user.display_name ?? result.display_name ?? "",
      });

      navigate(returnTo ?? dashboardPath, { replace: true });
    } catch (verifyError) {
      setFeedback({
        type: "error",
        text:
          verifyError.message ||
          "Verification failed. The code may be wrong or expired.",
      });
      setOtp("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PublicLayout actionTo="/login" actionLabel="Back to sign in" showNavigation={false}>
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
              <p className="public-eyebrow">Two-step verification</p>
              <h2>Enter your sign-in code</h2>
              <p className="login-form-intro">
                We sent a 6-digit code to <strong>{email}</strong>. The code
                expires in 5 minutes.
              </p>

              <form className="login-form" onSubmit={handleSubmit}>
                <div className="login-field">
                  <label htmlFor="otp">Verification code</label>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={otp}
                    onChange={handleOtpChange}
                    maxLength={6}
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
              </form>

              <p className="auth-switch">
                Didn't get the code?{" "}
                {countdown > 0 ? (
                  <span>Resend in {countdown}s</span>
                ) : (
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={handleResend}
                    disabled={isResending}
                  >
                    {isResending ? "Sending..." : "Resend code"}
                  </button>
                )}
              </p>
            </div>
          </section>
        </div>
      </main>
    </PublicLayout>
  );
}

export default LoginOtpPage;
