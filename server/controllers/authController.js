import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import crypto from "crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import Admin from "../models/Admin.js";
import RtdbState from "../models/RtdbState.js";
import {
  signPanelToken,
  signAdminToken,
  signTotpChallengeToken,
} from "../middleware/authMiddleware.js";

const DEFAULT_EMAIL = (process.env.ADMIN_EMAIL || "admin@panel.local").toLowerCase();
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || "").toLowerCase();
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || "";

const MAX_FAILED = Number(process.env.AUTH_MAX_FAILED || 5);
const LOCK_MINUTES = Number(process.env.AUTH_LOCK_MINUTES || 15);

const TOTP_ISSUER = "Cyber Panel";

function newTenantId() {
  return `t_${crypto.randomBytes(8).toString("hex")}`;
}

function buildTotp(secret, label) {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: label || "Admin",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

function verifyTotpCode(secret, code) {
  if (!secret || !code) return false;
  try {
    const totp = buildTotp(secret);
    const delta = totp.validate({ token: String(code).trim(), window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}

async function ensureTenantRtdb(tenantId) {
  const exists = await RtdbState.findById(tenantId).lean();
  if (!exists) await RtdbState.create({ _id: tenantId, tenantId, tree: {} });
}

export async function initAdminPassword() {
  try {
    const existing = await Admin.findOne({ email: DEFAULT_EMAIL });
    if (!existing) {
      const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
      const tenantId = newTenantId();
      await Admin.create({ email: DEFAULT_EMAIL, password_hash, tenantId, role: "admin" });
      await ensureTenantRtdb(tenantId);
      console.log(`Default admin created: ${DEFAULT_EMAIL} (tenant ${tenantId})`);
    }
    if (SUPERADMIN_EMAIL && SUPERADMIN_PASSWORD) {
      const sa = await Admin.findOne({ email: SUPERADMIN_EMAIL });
      if (!sa) {
        const password_hash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
        const tenantId = newTenantId();
        await Admin.create({ email: SUPERADMIN_EMAIL, password_hash, tenantId, role: "superadmin" });
        await ensureTenantRtdb(tenantId);
        console.log(`Superadmin created: ${SUPERADMIN_EMAIL}`);
      }
    }
  } catch (err) {
    console.error(`[auth] init admin failed: ${err?.message || err}`);
  }
}

function dbReadyOr503(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ ok: false, error: "database not ready" });
    return false;
  }
  return true;
}

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.ip || "";
}

/**
 * STEP 1: credential check.
 * - If TOTP not enrolled → return enroll: true with QR + secret + challenge token.
 *   Client must call /verify-totp-enroll with the token + first 6-digit code.
 * - If TOTP enrolled → return enroll: false with challenge token.
 *   Client must call /verify-totp with the token + 6-digit code.
 */
export async function login(req, res) {
  if (!dbReadyOr503(res)) return;
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) return res.status(400).json({ ok: false, error: "email and password required" });

    const row = await Admin.findOne({ email });
    if (!row) return res.status(401).json({ ok: false, error: "invalid credentials" });
    if (row.disabled) return res.status(403).json({ ok: false, error: "account disabled" });

    const now = Date.now();
    if (row.locked_until && row.locked_until > now) {
      const mins = Math.ceil((row.locked_until - now) / 60000);
      return res.status(429).json({ ok: false, error: `account locked. try again in ${mins} min` });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      row.failed_attempts = (row.failed_attempts || 0) + 1;
      if (row.failed_attempts >= MAX_FAILED) {
        row.locked_until = now + LOCK_MINUTES * 60_000;
        row.failed_attempts = 0;
      }
      await row.save();
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    }

    if (!row.totp_enrolled) {
      // Generate a fresh secret bound to a short-lived enroll session.
      const secret = new OTPAuth.Secret({ size: 20 }).base32;
      row.pending_totp_secret = secret;
      row.pending_totp_expires = now + 10 * 60_000;
      await row.save();

      const totp = buildTotp(secret, email);
      const otpauthUri = totp.toString();
      const qrDataUrl = await QRCode.toDataURL(otpauthUri, { width: 256, margin: 2 });
      const challenge = signTotpChallengeToken({ sub: row.id, email: row.email, tenantId: row.tenantId, role: row.role });

      return res.json({
        ok: true,
        step: "enroll",
        challenge,
        totp: { secret, otpauth: otpauthUri, qr: qrDataUrl, issuer: TOTP_ISSUER, label: email },
      });
    }

    const challenge = signTotpChallengeToken({ sub: row.id, email: row.email, tenantId: row.tenantId, role: row.role });
    return res.json({ ok: true, step: "verify", challenge });
  } catch (err) {
    return res.status(500).json({ ok: false, error: `login failed: ${err?.message || err}` });
  }
}

/** STEP 2a: confirm TOTP enrollment. Body: { code }. Header: Bearer <challenge token>. */
export async function verifyTotpEnroll(req, res) {
  if (!dbReadyOr503(res)) return;
  try {
    const code = String(req.body?.code || "").trim();
    if (!code) return res.status(400).json({ ok: false, error: "code required" });
    const row = await Admin.findById(req.auth.sub);
    if (!row) return res.status(401).json({ ok: false, error: "session invalid" });
    if (!row.pending_totp_secret || !row.pending_totp_expires || row.pending_totp_expires < Date.now()) {
      return res.status(400).json({ ok: false, error: "enrollment expired, please login again" });
    }
    if (!verifyTotpCode(row.pending_totp_secret, code)) {
      return res.status(401).json({ ok: false, error: "invalid code" });
    }
    row.totp_secret = row.pending_totp_secret;
    row.totp_enrolled = true;
    row.pending_totp_secret = null;
    row.pending_totp_expires = 0;
    row.failed_attempts = 0;
    row.last_login_at = new Date();
    row.last_login_ip = clientIp(req);
    await row.save();
    await ensureTenantRtdb(row.tenantId);

    const sign = row.role === "superadmin" ? signAdminToken : signPanelToken;
    const token = sign({ sub: row.id, email: row.email, tenantId: row.tenantId, role: row.role });
    return res.json({ ok: true, token, user: { uid: row.id, email: row.email, role: row.role, tenantId: row.tenantId } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: `verify failed: ${err?.message || err}` });
  }
}

/** STEP 2b: verify TOTP for already-enrolled admin. */
export async function verifyTotp(req, res) {
  if (!dbReadyOr503(res)) return;
  try {
    const code = String(req.body?.code || "").trim();
    if (!code) return res.status(400).json({ ok: false, error: "code required" });
    const row = await Admin.findById(req.auth.sub);
    if (!row || !row.totp_enrolled || !row.totp_secret) {
      return res.status(401).json({ ok: false, error: "totp not set up" });
    }
    if (!verifyTotpCode(row.totp_secret, code)) {
      row.failed_attempts = (row.failed_attempts || 0) + 1;
      if (row.failed_attempts >= MAX_FAILED) {
        row.locked_until = Date.now() + LOCK_MINUTES * 60_000;
        row.failed_attempts = 0;
      }
      await row.save();
      return res.status(401).json({ ok: false, error: "invalid code" });
    }
    row.failed_attempts = 0;
    row.last_login_at = new Date();
    row.last_login_ip = clientIp(req);
    await row.save();
    await ensureTenantRtdb(row.tenantId);

    const sign = row.role === "superadmin" ? signAdminToken : signPanelToken;
    const token = sign({ sub: row.id, email: row.email, tenantId: row.tenantId, role: row.role });
    return res.json({ ok: true, token, user: { uid: row.id, email: row.email, role: row.role, tenantId: row.tenantId } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: `verify failed: ${err?.message || err}` });
  }
}

export async function changePassword(req, res) {
  if (!dbReadyOr503(res)) return;
  try {
    const oldPassword = String(req.body?.oldPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    if (!oldPassword || !newPassword) return res.status(400).json({ ok: false, error: "oldPassword, newPassword required" });
    if (newPassword.length < 8) return res.status(400).json({ ok: false, error: "password must be at least 8 characters" });

    const row = await Admin.findById(req.auth.sub);
    if (!row) return res.status(404).json({ ok: false, error: "user not found" });
    const ok = await bcrypt.compare(oldPassword, row.password_hash);
    if (!ok) return res.status(401).json({ ok: false, error: "wrong password" });
    row.password_hash = await bcrypt.hash(newPassword, 12);
    await row.save();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: `change password failed: ${err?.message || err}` });
  }
}

export async function me(req, res) {
  if (!dbReadyOr503(res)) return;
  const row = await Admin.findById(req.auth.sub).lean();
  if (!row) return res.status(404).json({ ok: false, error: "not found" });
  return res.json({
    ok: true,
    user: {
      uid: row._id,
      email: row.email,
      role: row.role,
      tenantId: row.tenantId,
      totp_enrolled: row.totp_enrolled,
    },
  });
}

/** Reset TOTP — requires current password. New login will force fresh enrollment. */
export async function resetTotp(req, res) {
  if (!dbReadyOr503(res)) return;
  try {
    const password = String(req.body?.password || "");
    if (!password) return res.status(400).json({ ok: false, error: "password required" });
    const row = await Admin.findById(req.auth.sub);
    if (!row) return res.status(404).json({ ok: false, error: "user not found" });
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ ok: false, error: "wrong password" });
    row.totp_secret = null;
    row.totp_enrolled = false;
    row.pending_totp_secret = null;
    row.pending_totp_expires = 0;
    await row.save();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: `reset failed: ${err?.message || err}` });
  }
}
