import { Request, Response } from "express";
import epicAuthService from "./epicAuthService";
import { exchangeAuthorizationCode } from "./epicOAuthService";
import epicApiService from "./epicApiService";
import epicLibraryService from "./epicLibraryService";
import User from "../../auth/models/User";
import syncService from "../syncService";

const getStatus = async (req: Request, res: Response) => {
  const data = await epicAuthService.getStatus(req.user.id);

  return res.status(200).json({
    Status: "Success",
    Data: data,
  });
};

const connect = async (req: Request, res: Response) => {
  try {
    const { authorizationCode } = req.body;

    if (!authorizationCode) {
      return res.status(400).json({
        Status: "Failed",
        Message: "Authorization code required",
      });
    }

    const tokenData = await exchangeAuthorizationCode(authorizationCode);

    console.log("STEP 1");
    console.log(tokenData);
    await epicAuthService.connect(req.user.id, {
      epicAccountId: tokenData.account_id,
      displayName: tokenData.displayName,
      refreshToken: tokenData.refresh_token,
      accessToken: tokenData.access_token,
      accessTokenExpiresAt: new Date(tokenData.expires_at),
    });
    console.log("STEP 2");

    const libraryResult = await epicLibraryService.syncLibrary(req.user.id);

    const metadataResult = await epicLibraryService.syncMetadata(req.user.id);

    await syncService.syncEpicGames(req.user.id);

    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        "providers.epic.lastSyncAt": new Date(),
      },
    });

    return res.status(200).json({
      Status: "Success",
      Data: {
        connected: true,
        displayName: tokenData.displayName,
        imported: libraryResult.imported,
        totalGames: libraryResult.totalGames,
        updated: metadataResult.updated,
      },
    });
  } catch (error: any) {
    //console.error("[EPIC CONNECT ERROR]", error?.response?.data || error);

    return res.status(500).json({
      Status: "Failed",
      Message:
        error?.response?.data || error?.message || "Epic connection failed",
    });
  }
};

const disconnect = async (req: Request, res: Response) => {
  await epicAuthService.disconnect(req.user.id);

  return res.status(200).json({
    Status: "Success",
  });
};

const verifyConnection = async (req: Request, res: Response) => {
  const data = await epicAuthService.verifyConnection(req.user.id);

  return res.status(200).json({
    Status: "Success",
    Data: data,
  });
};

const verifyToken = async (req: Request, res: Response) => {
  const data = await epicAuthService.verifyEpicToken(req.user.id);

  return res.status(200).json({
    Status: "Success",
    Data: data,
  });
};

const startOAuth = async (req: Request, res: Response) => {
  const url = epicAuthService.getLoginUrl();

  return res.status(200).json({
    Status: "Success",
    Data: {
      loginUrl: url,
    },
  });
};

const resync = async (req: Request, res: Response) => {
  try {
    const libraryResult = await epicLibraryService.syncLibrary(req.user.id);

    const metadataResult = await epicLibraryService.syncMetadata(req.user.id);

    await syncService.syncEpicGames(req.user.id);

    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        "providers.epic.lastSyncAt": new Date(),
      },
    });

    return res.status(200).json({
      Status: "Success",
      Data: {
        imported: libraryResult.imported,
        totalGames: libraryResult.totalGames,
        updated: metadataResult.updated,
      },
    });
  } catch (error: any) {
    console.error("[RESYNC ERROR]");

    // console.dir(error, {
    //   depth: 10,
    // });

    return res.status(500).json({
      Status: "Failed",
      Message: error.message,
    });
  }
};

const debugLibrary = async (req: Request, res: Response) => {
  const data = await epicLibraryService.debugLibrary(req.user.id);

  return res.status(200).json({
    Status: "Success",
    Data: data,
  });
};

const debugCatalog = async (req: Request, res: Response) => {
  const accessToken = await epicAuthService.getValidAccessToken(req.user.id);

  const data = await epicApiService.getCatalogItem(
    accessToken,
    "ab9f1f7354a8418388b43132d420524a",
    "bf81790c99634630b7389c5d261f3a11",
  );

  return res.json(data);
};

export default {
  getStatus,
  connect,
  disconnect,
  verifyConnection,
  verifyToken,
  startOAuth,
  resync,
  debugLibrary,
  debugCatalog,
};
