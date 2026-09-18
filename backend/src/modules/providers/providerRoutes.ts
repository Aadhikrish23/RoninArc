import express from "express";
import authMiddleware from "../auth/authMiddleware";
import providerController from "./providerController";

const router = express.Router();

// Unauthenticated: this is the redirect target Steam's OpenID login itself
// navigates the browser to, so it can never carry our Authorization header.
// Must be registered before the authMiddleware gate below.
router.get("/:providerId/oauth/return", providerController.oauthReturn);

router.use(authMiddleware);

router.post("/installations/refresh", providerController.refreshInstallations);
router.get("/:providerId/status", providerController.getStatus);
router.post("/:providerId/connect", providerController.connect);
router.delete("/:providerId/disconnect", providerController.disconnect);
router.post("/:providerId/resync", providerController.resync);
router.get("/:providerId/oauth/start", providerController.startOAuth);

export default router;
