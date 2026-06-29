import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import { verifyLoginOtp } from "../../services/authService";
import { saveSessionUser } from "../../utils/authSession";
import { getDashboardPath } from "../../utils/roleRoutes";

function LoginOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const loginIntentId = location.state?.loginIntentId;
  const email = location.state?.email ?? "your email";
  const returnTo = location.state?.returnTo;

  const [otp, setOtp] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loginIntentId) {
      navigate("/login", { replace: true });
    }
  }, [loginIntentId, navigate]);

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
                <Link to="/login">Try signing in again</Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </PublicLayout>
  );
}

export default LoginOtpPage;
