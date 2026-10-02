// Ports are deliberately unlike the dev ones (5000/5173/27017) and the packaged
// app's (27018), so a suite run can coexist with a running dev environment.
export const MONGO_PORT = Number(process.env.E2E_MONGO_PORT || 27119);
export const RAWG_PORT = Number(process.env.E2E_RAWG_PORT || 5099);
export const API_PORT = Number(process.env.E2E_API_PORT || 5055);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT || 5181);

export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const MONGO_URL = `mongodb://127.0.0.1:${MONGO_PORT}`;
