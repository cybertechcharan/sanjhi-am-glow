import express from "express";
import { getPath, pushPath, queryPath, removePath, setPath, updatePath } from "../controllers/rtdbController.js";

const router = express.Router();

router.get("/", getPath);
router.post("/query", queryPath);
router.post("/set", setPath);
router.post("/update", updatePath);
router.post("/remove", removePath);
router.post("/push", pushPath);

export default router;
