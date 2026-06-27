import { Request, Response, NextFunction } from "express";
import ProviderRegistry from "./shared/ProviderRegistry";
import AppError from "../../shared/errors/AppError";

const getStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { providerId } = req.params;
    const provider = ProviderRegistry.get(providerId);
    const data = await provider.getStatus(req.user.id);
    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error: any) {
    next(error);
  }
};

const connect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { providerId } = req.params;
    const provider = ProviderRegistry.get(providerId);
    const data = await provider.connect(req.user.id, req.body);
    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error: any) {
    next(error);
  }
};

const disconnect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { providerId } = req.params;
    const provider = ProviderRegistry.get(providerId);
    await provider.disconnect(req.user.id);
    return res.status(200).json({ Status: "Success" });
  } catch (error: any) {
    next(error);
  }
};

const resync = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { providerId } = req.params;
    const provider = ProviderRegistry.get(providerId);
    const data = await provider.resync(req.user.id, req.body);
    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error: any) {
    next(error);
  }
};

const startOAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { providerId } = req.params;
    const provider = ProviderRegistry.get(providerId);
    if (provider.getLoginUrl) {
      const url = await provider.getLoginUrl(req.user.id);
      return res.status(200).json({ Status: "Success", Data: { loginUrl: url } });
    }
    return res.status(400).json({ Status: "Failed", Message: "OAuth not supported for this provider" });
  } catch (error: any) {
    next(error);
  }
};

const refreshInstallations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reports: Record<string, any> = {};
    const { installations = {} } = req.body;
    
    for (const [providerId, localGames] of Object.entries(installations)) {
      try {
        const provider = ProviderRegistry.get(providerId);
        if (provider.refreshInstallations) {
          reports[providerId] = await provider.refreshInstallations(req.user.id, localGames as any[]);
        }
      } catch (err) {
        console.error(`[providerController] Failed to refresh installations for ${providerId}:`, err);
      }
    }
    return res.status(200).json({ Status: "Success", Data: reports });
  } catch (error: any) {
    next(error);
  }
};

export default {
  getStatus,
  connect,
  disconnect,
  resync,
  startOAuth,
  refreshInstallations,
};

