import User from "../../auth/models/User";
import epicApiService from "./epicApiService";
import EpicOwnership from "./models/EpicOwnership";

const getStatus = async (userId: string) => {
  const user = await User.findById(userId);
  const count = user?.providers?.epic
    ? await EpicOwnership.countDocuments({ userId, provider: "epic" })
    : 0;

  return {
    connected: !!user?.providers?.epic,

    displayName: user?.providers?.epic?.displayName || null,

    connectedAt: user?.providers?.epic?.connectedAt || null,

    importedGames: count,

    lastSync: user?.providers?.epic?.lastSyncAt || null,
  };
};

const connect = async (
  userId: string,
  provider: {
    epicAccountId: string;
    displayName: string;
    refreshToken: string;
    accessToken?: string;
    accessTokenExpiresAt?: Date;
  },
) => {
  console.log("CONNECT USER", userId);

  console.log(provider);

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        "providers.epic": {
          ...provider,
          connectedAt: new Date(),
        },
      },
    },
    {
      new: true,
    },
  );
  console.log(user);

  return user?.providers?.epic;
};

const disconnect = async (userId: string) => {
  await User.findByIdAndUpdate(userId, {
    $unset: {
      "providers.epic": "",
    },
  });
};

const verifyConnection = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user?.providers?.epic) {
    return {
      connected: false,
    };
  }

  return {
    connected: true,
    displayName: user.providers.epic.displayName,
    epicAccountId: user.providers.epic.epicAccountId,
  };
};

const verifyEpicToken = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user?.providers?.epic?.accessToken) {
    throw new Error("No Epic token found");
  }

  const profile = await epicApiService.verifyToken(
    user.providers.epic.accessToken,
  );

  return profile;
};

const getLoginUrl = () => {
  const clientId = "34a02cf8f4414e29b15921876da36f9a";

  const redirectUrl = `https://www.epicgames.com/id/api/redirect?clientId=${clientId}&responseType=code`;

  return (
    "https://www.epicgames.com/id/login?redirectUrl=" +
    encodeURIComponent(redirectUrl)
  );
};
const getValidAccessToken = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user?.providers?.epic) {
    throw new Error("Epic account not connected");
  }

  const epic = user.providers.epic;

  const expired =
    !epic.accessTokenExpiresAt || epic.accessTokenExpiresAt < new Date();

  if (!expired && epic.accessToken) {
    return epic.accessToken;
  }

  const tokenData = await epicApiService.refreshAccessToken(epic.refreshToken);

  await User.findByIdAndUpdate(userId, {
    $set: {
      "providers.epic.accessToken": tokenData.access_token,

      "providers.epic.accessTokenExpiresAt": new Date(tokenData.expires_at),

      "providers.epic.refreshToken": tokenData.refresh_token,
    },
  });

  return tokenData.access_token;
};

export default {
  getStatus,
  connect,
  disconnect,
  verifyConnection,
  verifyEpicToken,
  getLoginUrl,
  getValidAccessToken,
};
