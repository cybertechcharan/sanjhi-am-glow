import mongoose from "mongoose";

/**
 * Admin = a tenant owner of the Cyber Panel.
 * Each admin has its own tenantId; all RTDB / device / settings data is
 * scoped under that tenantId so 1000+ admins can share one MongoDB cluster
 * without ever seeing each other's data.
 *
 * - role: "admin"      — owns one tenant (default)
 *         "superadmin" — manages the global admin panel (all tenants)
 *
 * - totp_secret: base32 string. Required for every login after enrollment.
 * - totp_enrolled: false until the first successful TOTP verify.
 *   While false, login flow forces enrollment (QR + verify).
 */
const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    tenantId: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ["admin", "superadmin"], default: "admin", index: true },
    totp_secret: { type: String, default: null },
    totp_enrolled: { type: Boolean, default: false },
    pending_totp_secret: { type: String, default: null },
    pending_totp_expires: { type: Number, default: 0 },
    locked_until: { type: Number, default: 0 },
    failed_attempts: { type: Number, default: 0 },
    last_login_at: { type: Date, default: null },
    last_login_ip: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "admins" }
);

export default mongoose.model("Admin", adminSchema);
