import os from "node:os";
import path from "node:path";

// Ports are deliberately unlike the dev ones (5000/5173/27017) and the packaged
// app's (27018), so a suite run can coexist with a running dev environment.
export const MONGO_PORT = Number(process.env.E2E_MONGO_PORT || 27119);
export const RAWG_PORT = Number(process.env.E2E_RAWG_PORT || 5099);
export const API_PORT = Number(process.env.E2E_API_PORT || 5055);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT || 5181);
// RoninArc Cloud for the sync tests: the same backend in cloud mode, its own database.
export const CLOUD_PORT = Number(process.env.E2E_CLOUD_PORT || 5056);
export const RESEND_PORT = Number(process.env.E2E_RESEND_PORT || 5097);

export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const MONGO_URL = `mongodb://127.0.0.1:${MONGO_PORT}`;
export const CLOUD_URL = `http://localhost:${CLOUD_PORT}`;
export const RESEND_URL = `http://127.0.0.1:${RESEND_PORT}`;
/** The cloud's per-user daily AI allowance in the suite (small, so the limit is testable). */
export const CLOUD_AI_LIMIT = 3;

export const SENTRY_PORT = Number(process.env.E2E_SENTRY_PORT || 5098);
export const SENTRY_URL = `http://127.0.0.1:${SENTRY_PORT}`;
// Sentry DSNs: <protocol>://<key>@<host>/<projectId>. Project 1 = backend, 2 = browser.
export const BACKEND_SENTRY_DSN = `http://e2ekey@127.0.0.1:${SENTRY_PORT}/1`;
export const BROWSER_SENTRY_DSN = `http://e2ekey@127.0.0.1:${SENTRY_PORT}/2`;

// Where the backend writes its JSON-lines logs during the suite (tests read them).
export const LOG_DIR = path.join(os.tmpdir(), "roninarc-e2e-logs");
