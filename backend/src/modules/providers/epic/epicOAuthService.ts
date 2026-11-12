import axios from "axios";
import { EPIC_ENDPOINTS } from "./epicConstants";

// Epic's own launcher client: this id and secret are the public ones every third-party Epic
// launcher uses (they are not RoninArc's, can't be rotated by us, and grant nothing without a
// player's authorization code). Never log the response below: it holds the player's tokens.
const CLIENT_ID = "34a02cf8f4414e29b15921876da36f9a";

const CLIENT_SECRET = "daafbccc737745039dffe53d94fc76cf";

export const exchangeAuthorizationCode = async (authorizationCode: string) => {
  const body = new URLSearchParams();

  body.append("grant_type", "authorization_code");

  body.append("code", authorizationCode);

  body.append("token_type", "eg1");

  const response = await axios.post(
    `${EPIC_ENDPOINTS.OAUTH}/account/api/oauth/token`,
    body,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },

      auth: {
        username: CLIENT_ID,
        password: CLIENT_SECRET,
      },
    },
  );

  return response.data;
};
