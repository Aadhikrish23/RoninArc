import express from "express";
import authMiddleware from "../../auth/authMiddleware";
import epicController from "./epicController";

const router = express.Router();

router.use(authMiddleware);

router.get("/status", epicController.getStatus);

router.post("/connect", epicController.connect);

router.delete("/disconnect", epicController.disconnect);
router.post("/verify", epicController.verifyConnection);
router.post("/verify-token", epicController.verifyToken);

router.get("/oauth/start", epicController.startOAuth);

router.post("/debug-library", epicController.debugLibrary);
router.get("/debug-catalog", epicController.debugCatalog);

export default router;
