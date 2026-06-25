
import axios from "axios";
import { EPIC_ENDPOINTS } from "./epicConstants";

const verifyToken = async (
  accessToken: string
) => {
  const response =
    await axios.get(
      `${EPIC_ENDPOINTS.OAUTH}/account/api/oauth/verify`,
      {
        headers: {
          Authorization:
            `bearer ${accessToken}`,
        },
      }
    );

  return response.data;
};
const refreshAccessToken = async (
  refreshToken: string
) => {
  const response = await axios.post(
    `${EPIC_ENDPOINTS.OAUTH}/account/api/oauth/token`,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      token_type: "eg1",
    }),
    {
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      auth: {
        username:
          "34a02cf8f4414e29b15921876da36f9a",
        password:
          "daafbccc737745039dffe53d94fc76cf",
      },
    }
  );

  return response.data;
};



const getCatalogItem = async (
  accessToken: string,
  namespace: string,
  catalogItemId: string
) => {
  const response =
    await axios.get(
      `${EPIC_ENDPOINTS.CATALOG}/catalog/api/shared/namespace/${namespace}/bulk/items`,
      {
        params: {
          id: catalogItemId,
          country: "IN",
          locale: "en-US",
        },

        headers: {
          Authorization:
            `bearer ${accessToken}`,
        },
      }
    );
    // console.log("get catalog item response:",response)
  return response.data;
};
const getLibraryItems = async (
  accessToken: string,
  cursor?: string
) => {
  const response =
    await axios.get(
      `${EPIC_ENDPOINTS.LIBRARY}/library/api/public/items`,
      {
        params: {
          includeMetadata: true,
          cursor,
        },

        headers: {
          Authorization:
            `bearer ${accessToken}`,
        },
      }
    );

  return response.data;
};
export default {
  verifyToken,
  refreshAccessToken,getCatalogItem,getLibraryItems
};