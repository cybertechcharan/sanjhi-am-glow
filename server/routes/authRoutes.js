import express from "express";
import rateLimit from "express-rate-limit";
import {
  changePassword,
  login,
  me,
  resetTotp,
  verifyTotp,
  verifyTotpEnroll,
} from "../controllers/authController.js";
import { requirePanelAuth, requireTotpChallenge } from "../middleware/authMiddleware.js";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "too many login attempts" },
});

const verifyLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "too many verification attempts" },
});

router.post("/login", loginLimiter, login);
router.post("/verify-totp-enroll", verifyLimiter, requireTotpChallenge, verifyTotpEnroll);
router.post("/verify-totp", verifyLimiter, requireTotpChallenge, verifyTotp);
router.post("/change-password", requirePanelAuth, changePassword);
router.post("/reset-totp", requirePanelAuth, resetTotp);
router.get("/me", requirePanelAuth, me);

export default router;
