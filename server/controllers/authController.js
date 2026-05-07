import bcrypt from "bcryptjs";
import Admin from "../models/Admin.js";

const DEFAULT_EMAIL = process.env.ADMIN_EMAIL || "admin@panel.local";
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export async function initAdminPassword() {
  const existing = await Admin.findOne({ email: DEFAULT_EMAIL });
  if (existing) return;
  const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await Admin.create({ email: DEFAULT_EMAIL, password_hash });
  console.log(`Default admin created: ${DEFAULT_EMAIL}`);
}

export async function login(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const row = await Admin.findOne({ email });
  if (!row) return res.status(401).json({ ok: false, error: "invalid credentials" });
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(401).json({ ok: false, error: "invalid credentials" });
  return res.json({ ok: true, user: { uid: row.id, email: row.email } });
}

export async function changePassword(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const oldPassword = String(req.body?.oldPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({ ok: false, error: "email, oldPassword, newPassword required" });
  }
  const row = await Admin.findOne({ email });
  if (!row) return res.status(404).json({ ok: false, error: "user not found" });
  const ok = await bcrypt.compare(oldPassword, row.password_hash);
  if (!ok) return res.status(401).json({ ok: false, error: "wrong password" });
  row.password_hash = await bcrypt.hash(newPassword, 10);
  await row.save();
  return res.json({ ok: true });
}
