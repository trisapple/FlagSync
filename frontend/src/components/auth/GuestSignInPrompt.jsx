import { Link } from "react-router-dom";
import PublicLayout from "../public/PublicLayout";
import "./GuestSignInPrompt.css";

function GuestSignInPrompt({ eyebrow, heading, subtext }) {
  return (
    <PublicLayout>
      <main className="guest-auth-prompt">
        <div>
          <p className="public-eyebrow">{eyebrow}</p>
          <h1>{heading}</h1>
          <p>{subtext}</p>
          <Link className="public-button public-button-primary" to="/login">
            Sign in
          </Link>
        </div>
      </main>
    </PublicLayout>
  );
}

export default GuestSignInPrompt;
