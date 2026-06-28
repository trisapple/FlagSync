import { Link } from "react-router-dom";

function HomePage() {
  return (
    <main className="app-frame">
      <section className="shell hero-grid">
        <article className="surface hero-copy">
          <div className="kicker">FlagSync</div>
          <h1 className="hero-title">Discover and manage CTF competitions and hackathons.</h1>
          <p className="hero-text">
            Navigate the platform with authenticated sessions, role-aware access,
            and security controls built for challenge environments.
          </p>
          <div className="inline-actions">
            <Link className="button button-primary" to="/login">
              Login
            </Link>
            <Link className="button button-secondary" to="/register">
              Register
            </Link>
            <Link className="button button-secondary" to="/profile">
              Profile
            </Link>
          </div>
        </article>

        <article className="surface auth-card">
          <h2 className="card-title">Security posture</h2>
          <p className="helper">
            This build uses hashed passwords, cookie-based JWT sessions, and login
            lockout tracking to slow brute-force attacks.
          </p>
          <div className="hero-points">
            <span className="pill">HttpOnly cookies</span>
            <span className="pill">Session expiry</span>
            <span className="pill">Account lockout</span>
          </div>
        </article>
      </section>
    </main>
  );
}

export default HomePage;
