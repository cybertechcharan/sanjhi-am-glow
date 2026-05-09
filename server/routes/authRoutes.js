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
import { requireAnyAuth, requireTotpChallenge } from "../middleware/authMiddleware.js";

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
// /me, /change-password and /reset-totp are needed by both panel admins
// (scope=panel) and superadmins (scope=admin), so they accept either scope.
router.post("/change-password", requireAnyAuth, changePassword);
router.post("/reset-totp", requireAnyAuth, resetTotp);
router.get("/me", requireAnyAuth, me);

export default router;
