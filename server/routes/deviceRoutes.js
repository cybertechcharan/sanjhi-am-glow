import express from "express";
import { upsertDevice, listDevices, getDevice } from "../controllers/deviceController.js";
import { requirePanelAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requirePanelAuth);

router.post("/", upsertDevice);
router.get("/", listDevices);
router.get("/:id", getDevice);

export default router;
