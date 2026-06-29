import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import { verifyEmail } from "../../services/authService";

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("This verification link is missing a token.");
      return;
    }

    if (hasRequestedRef.current) return;
    hasRequestedRef.current = true;

    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((error) => {
        setStatus("error");
        setErrorMessage(
          error.message ||
            "Verification failed. The link may have expired or already been used.",
        );
      });
  }, [token]);

  return (
    <PublicLayout actionTo="/login" actionLabel="Sign in" showNavigation={false}>
      <main className="login-main">
        <div className="public-container">
          <section className="login-panel">
            <div className="login-form-side">
              <p className="public-eyebrow">Email verification</p>

              {status === "verifying" && (
                <>
                  <h2>Verifying your email...</h2>
                  <p className="login-form-intro">
                    Please wait a moment while we activate your account.
                  </p>
                </>
              )}

              {status === "success" && (
                <>
                  <h2>Email verified</h2>
                  <p className="login-form-intro">
                    Your account is ready. You can now sign in to FlagSync.
                  </p>
                  <Link
                    className="public-button public-button-primary login-submit"
                    to="/login"
                  >
                    Continue to sign in
                  </Link>
                </>
              )}

              {status === "error" && (
                <>
                  <h2>Verification failed</h2>
                  <p
                    className="login-status login-status-error"
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                  <p className="auth-switch">
                    Need a new link?{" "}
                    <Link to="/register">Create another account</Link> or{" "}
                    <Link to="/login">try signing in</Link>.
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </PublicLayout>
  );
}

export default VerifyEmailPage;
