import bcrypt from "bcryptjs";
import crypto from "crypto";
import Admin from "../models/Admin.js";
import RtdbState from "../models/RtdbState.js";
import Device from "../models/Device.js";

function newTenantId() {
  return `t_${crypto.randomBytes(8).toString("hex")}`;
}

export async function listTenants(_req, res) {
  const rows = await Admin.find({}, {
    email: 1,
    role: 1,
    tenantId: 1,
    totp_enrolled: 1,
    last_login_at: 1,
    last_login_ip: 1,
    disabled: 1,
    locked_until: 1,
    createdAt: 1,
  }).lean();
  const counts = await Promise.all(
    rows.map(async (r) => {
      const devices = await Device.countDocuments({ tenantId: r.tenantId });
      return { tenantId: r.tenantId, devices };
    })
  );
  const cmap = Object.fromEntries(counts.map((c) => [c.tenantId, c.devices]));
  return res.json({
    ok: true,
    tenants: rows.map((r) => ({
      id: r._id,
      email: r.email,
      role: r.role,
      tenantId: r.tenantId,
      totp_enrolled: !!r.totp_enrolled,
      last_login_at: r.last_login_at,
      last_login_ip: r.last_login_ip,
      disabled: !!r.disabled,
      locked: r.locked_until && r.locked_until > Date.now(),
      created_at: r.createdAt,
      devices: cmap[r.tenantId] || 0,
    })),
  });
}

export async function createTenant(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ ok: false, error: "email and password required" });
  if (password.length < 8) return res.status(400).json({ ok: false, error: "password must be at least 8 characters" });
  const exists = await Admin.findOne({ email });
  if (exists) return res.status(409).json({ ok: false, error: "email already exists" });
  const tenantId = newTenantId();
  const password_hash = await bcrypt.hash(password, 12);
  await Admin.create({ email, password_hash, tenantId, role: "admin" });
  await RtdbState.create({ _id: tenantId, tenantId, tree: {} });
  return res.json({ ok: true, tenantId, email });
}

export async function setTenantDisabled(req, res) {
  const id = String(req.params.id || "");
  const disabled = !!req.body?.disabled;
  const row = await Admin.findById(id);
  if (!row) return res.status(404).json({ ok: false, error: "not found" });
  row.disabled = disabled;
  await row.save();
  return res.json({ ok: true });
}

export async function resetTenantPassword(req, res) {
  const id = String(req.params.id || "");
  const newPassword = String(req.body?.newPassword || "");
  if (newPassword.length < 8) return res.status(400).json({ ok: false, error: "password must be at least 8 characters" });
  const row = await Admin.findById(id);
  if (!row) return res.status(404).json({ ok: false, error: "not found" });
  row.password_hash = await bcrypt.hash(newPassword, 12);
  row.failed_attempts = 0;
  row.locked_until = 0;
  await row.save();
  return res.json({ ok: true });
}

export async function resetTenantTotp(req, res) {
  const id = String(req.params.id || "");
  const row = await Admin.findById(id);
  if (!row) return res.status(404).json({ ok: false, error: "not found" });
  row.totp_secret = null;
  row.totp_enrolled = false;
  row.pending_totp_secret = null;
  row.pending_totp_expires = 0;
  await row.save();
  return res.json({ ok: true });
}

export async function deleteTenant(req, res) {
  const id = String(req.params.id || "");
  const row = await Admin.findById(id);
  if (!row) return res.status(404).json({ ok: false, error: "not found" });
  if (row.role === "superadmin") return res.status(400).json({ ok: false, error: "cannot delete superadmin" });
  await Promise.all([
    RtdbState.deleteOne({ _id: row.tenantId }),
    Device.deleteMany({ tenantId: row.tenantId }),
    Admin.deleteOne({ _id: row._id }),
  ]);
  return res.json({ ok: true });
}

export async function stats(_req, res) {
  const [admins, devices, tenants] = await Promise.all([
    Admin.countDocuments({}),
    Device.countDocuments({}),
    RtdbState.countDocuments({}),
  ]);
  return res.json({ ok: true, admins, devices, tenants });
}
