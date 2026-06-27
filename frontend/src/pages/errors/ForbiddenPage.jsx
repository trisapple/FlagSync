import { Link } from "react-router-dom";
import PublicLayout from "../../components/public/PublicLayout";
import "./ForbiddenPage.css";

function ForbiddenPage() {
  return (
    <PublicLayout>
      <main className="forbidden-page">
        <div className="public-container">
          <p className="public-eyebrow">403 · Access denied</p>
          <h1>You do not have permission to view this page.</h1>
          <p>This area is restricted to FlagSync administrators.</p>
          <Link className="public-button public-button-primary" to="/">
            Return home
          </Link>
        </div>
      </main>
    </PublicLayout>
  );
}

export default ForbiddenPage;
