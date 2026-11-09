import { useEffect, useState } from "react";
import authApi from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import AddEmailModal from "./AddEmailModal";

const ASKED = "roninarc.addEmailAsked";

/**
 * After the update to email sign-in: an account with no email is asked for one, once per
 * sign-in session. It stays signed in either way; Settings keeps offering it.
 */
export default function AddEmailPrompt() {
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.email) return;
    let asked = false;
    try {
      asked = sessionStorage.getItem(ASKED) === "1";
    } catch {
      /* private mode: ask */
    }
    if (asked) return;
    let live = true;
    authApi
      .me()
      .then((me) => {
        if (live && me.needsEmail) {
          setOpen(true);
          try {
            sessionStorage.setItem(ASKED, "1");
          } catch {
            /* fine */
          }
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [isAuthenticated, user?.email]);

  return <AddEmailModal isOpen={open} onClose={() => setOpen(false)} />;
}
