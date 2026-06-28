import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  getRegistrationChallenge,
  register,
} from "../../services/auth_service";

const initialFormData = {
  display_name: "",
  email: "",
  password: "",
  challenge_answer: "",
};

function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormData);
  const [challenge, setChallenge] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");

  async function loadChallenge() {
    const nextChallenge = await getRegistrationChallenge();
    setChallenge(nextChallenge);
  }

  useEffect(() => {
    let ignore = false;

    getRegistrationChallenge()
      .then((nextChallenge) => {
        if (!ignore) {
          setChallenge(nextChallenge);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setMessageType("error");
          setMessage(error.message);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!challenge) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const result = await register({
        ...formData,
        challenge_id: challenge.challenge_id,
      });
      setMessageType("success");
      setMessage(result.message ?? "Registration successful");
      setFormData(initialFormData);
      setTimeout(() => navigate("/login"), 900);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
      loadChallenge().catch(() => undefined);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-frame">
      <section className="shell hero-grid">
        <article className="surface hero-copy">
          <div className="kicker">FlagSync Registration</div>
          <h1 className="hero-title">Create a verified CTF account.</h1>
          <p className="hero-text">
            New accounts pass a lightweight challenge, password policy checks,
            and server-side validation before login is allowed.
          </p>
          <div className="inline-actions">
            <Link className="button button-secondary" to="/login">
              Login
            </Link>
            <Link className="button button-secondary" to="/">
              Home
            </Link>
          </div>
        </article>

        <article className="surface auth-card">
          <div>
            <h2 className="card-title">Register</h2>
            <p className="helper">
              Use a strong password with uppercase, lowercase, number, and
              symbol characters.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field" htmlFor="display_name">
              <span className="label">Display name</span>
              <input
                className="input"
                id="display_name"
                name="display_name"
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={120}
                value={formData.display_name}
                onChange={handleChange}
                required
              />
            </label>

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
                autoComplete="new-password"
                minLength={12}
                value={formData.password}
                onChange={handleChange}
                required
              />
            </label>

            <label className="field" htmlFor="challenge_answer">
              <span className="label">Micro-challenge</span>
              <span className="challenge-prompt">
                {challenge?.prompt ?? "Loading challenge..."}
              </span>
              <input
                className="input"
                id="challenge_answer"
                name="challenge_answer"
                type="text"
                autoComplete="off"
                value={formData.challenge_answer}
                onChange={handleChange}
                required
              />
            </label>

            <button
              className="button button-primary"
              type="submit"
              disabled={isSubmitting || !challenge}
            >
              {isSubmitting ? "Creating account..." : "Register"}
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

export default RegisterPage;
