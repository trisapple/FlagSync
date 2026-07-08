import { useEffect, useState } from "react";
import AppRoutes from "./routes/AppRoutes";
import SessionExpiredModal from "./components/auth/SessionExpiredModal";
import { SESSION_EXPIRED_EVENT, clearSessionExpired } from "./utils/authSession";
import "./App.css";

function App() {
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    function handleSessionExpired() {
      setSessionExpired(true);
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  function handleReauthenticated() {
    clearSessionExpired();
    // Reload so every already-mounted page refetches with the fresh session
    // instead of continuing to show data loaded before the session died.
    window.location.reload();
  }

  return (
    <>
      <AppRoutes />
      {sessionExpired && <SessionExpiredModal onSuccess={handleReauthenticated} />}
    </>
  );
}

export default App;