/**
 * Where the signed-in session lives. "Remember me" keeps it in localStorage, otherwise it stays in
 * this tab's sessionStorage. Everything that reads or clears a session goes through here, so the
 * two stores are never mixed and an older sign-in in one can't come back after a newer one in the other.
 */
export const SESSION_KEYS = ["roninarc_user", "roninarc_token", "roninarc_refresh_token"] as const;

export function clearStore(store: Storage) {
  for (const key of SESSION_KEYS) store.removeItem(key);
}

export function clearSession() {
  clearStore(localStorage);
  clearStore(sessionStorage);
}

/** The store holding the current sign-in: "remember me" (local) first, else this tab's session. */
export function signedInStore(): Storage | null {
  const complete = (store: Storage) => SESSION_KEYS.every((key) => !!store.getItem(key));
  if (complete(localStorage)) return localStorage;
  if (complete(sessionStorage)) return sessionStorage;
  return null;
}
