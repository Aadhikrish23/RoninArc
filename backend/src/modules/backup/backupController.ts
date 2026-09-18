import { Request, Response } from "express";
import backupService from "./backupService";

const pushBackup = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const result = await backupService.backupUser(userId);
    return res.status(200).json({ Status: "Success", Data: result });
  } catch (error: any) {
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({
      Status: "Failed",
      Message: error?.message || "Backup failed",
    });
  }
};

const restoreBackup = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ Status: "Failed", Message: "Username and password are required" });
    }

    const result = await backupService.restoreByCredentials(username, password);
    return res.status(200).json({ Status: "Success", Data: result });
  } catch (error: any) {
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({
      Status: "Failed",
      Message: error?.message || "Restore failed",
    });
  }
};

export default { pushBackup, restoreBackup };
