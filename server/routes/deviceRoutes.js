import express from "express";
import { upsertDevice, listDevices, getDevice } from "../controllers/deviceController.js";

const router = express.Router();

router.post("/", upsertDevice);
router.get("/", listDevices);
router.get("/:id", getDevice);

export default router;
