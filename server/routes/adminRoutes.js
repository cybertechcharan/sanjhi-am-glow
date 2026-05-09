import express from "express";
import {
  createTenant,
  deleteTenant,
  listTenants,
  resetTenantPassword,
  resetTenantTotp,
  setTenantDisabled,
  stats,
} from "../controllers/adminController.js";
import { requireAdminAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAdminAuth);

router.get("/stats", stats);
router.get("/tenants", listTenants);
router.post("/tenants", createTenant);
router.post("/tenants/:id/disabled", setTenantDisabled);
router.post("/tenants/:id/reset-password", resetTenantPassword);
router.post("/tenants/:id/reset-totp", resetTenantTotp);
router.delete("/tenants/:id", deleteTenant);

export default router;
