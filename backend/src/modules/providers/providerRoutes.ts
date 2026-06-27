import express from "express";
import authMiddleware from "../auth/authMiddleware";
import providerController from "./providerController";

const router = express.Router();

router.use(authMiddleware);

router.post("/installations/refresh", providerController.refreshInstallations);
router.get("/:providerId/status", providerController.getStatus);
router.post("/:providerId/connect", providerController.connect);
router.delete("/:providerId/disconnect", providerController.disconnect);
router.post("/:providerId/resync", providerController.resync);
router.get("/:providerId/oauth/start", providerController.startOAuth);

export default router;
