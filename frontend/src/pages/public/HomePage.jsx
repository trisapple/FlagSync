import { Link } from "react-router-dom";

function HomePage() {
  return (
    <main>
      <h1>FlagSync</h1>
      <p>Discover and manage CTF competitions and hackathons.</p>

      <Link to="/login">
        <button type="button">Go to Login</button>
      </Link>
    </main>
  );
}

export default HomePage;