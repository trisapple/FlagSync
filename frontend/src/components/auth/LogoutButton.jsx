import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../services/authService";

function LogoutButton({ className = "", onLoggedOut }) {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
    } catch {
      // The client session is cleared by logout() even when the API is unavailable.
    } finally {
      onLoggedOut?.();
      navigate("/", { replace: true });
      setIsLoggingOut(false);
    }
  }

  return (
    <button
      className={className}
      type="button"
      disabled={isLoggingOut}
      onClick={handleLogout}
    >
      {isLoggingOut ? "Logging out..." : "Log out"}
    </button>
  );
}

export default LogoutButton;
