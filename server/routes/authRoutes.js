import express from "express";
import { changePassword, login } from "../controllers/authController.js";

const router = express.Router();

router.post("/login", login);
router.post("/change-password", changePassword);

export default router;
