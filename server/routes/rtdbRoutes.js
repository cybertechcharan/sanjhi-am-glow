import express from "express";
import rateLimit from "express-rate-limit";
import { getPath, pushPath, queryPath, removePath, setPath, updatePath } from "../controllers/rtdbController.js";
import { requirePanelAuth } from "../middleware/authMiddleware.js";
import { blockForbiddenWrites } from "../middleware/pathGuard.js";

const router = express.Router();

const rtdbLimiter = rateLimit({
  windowMs: 60_000,
  max: 600, // 10 req/sec per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate limit exceeded" },
});

router.use(rtdbLimiter);
router.use(requirePanelAuth);

router.get("/", getPath);
router.post("/query", queryPath);
router.post("/set", blockForbiddenWrites, setPath);
router.post("/update", blockForbiddenWrites, updatePath);
router.post("/remove", blockForbiddenWrites, removePath);
router.post("/push", blockForbiddenWrites, pushPath);

export default router;
