const { shell } = require("electron");

const axios = require("axios");

const API_BASE =
  process.env.RONINARC_API ??
  "http://localhost:5000/api";

/**
 * Opens the Epic OAuth page in the user's default browser.
 *
 * Returns:
 * {
 *   success: true
 * }
 *
 * This DOES NOT authenticate yet.
 * It only launches the browser.
 */
async function authenticate() {
  const response = await axios.get(
    `${API_BASE}/provider/epic/oauth/start`
  );

  const loginUrl =
    response.data.Data.loginUrl;

  await shell.openExternal(loginUrl);

  return {
    success: true,
  };
}

module.exports = {
  authenticate,
};