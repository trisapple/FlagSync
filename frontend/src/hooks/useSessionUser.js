import { useEffect, useState } from "react";
import {
  getSessionUser,
  SESSION_CHANGE_EVENT,
} from "../utils/authSession";

export function useSessionUser() {
  const [sessionUser, setSessionUser] = useState(() => getSessionUser());

  useEffect(() => {
    function syncSession() {
      setSessionUser(getSessionUser());
    }

    window.addEventListener(SESSION_CHANGE_EVENT, syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  return sessionUser;
}
