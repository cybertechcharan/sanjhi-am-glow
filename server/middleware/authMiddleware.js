import jwt from "jsonwebtoken";

/**
 * JWT structure (final, post-2FA):
 *   { sub: adminId, email, tenantId, role, scope: "panel"|"admin", iat, exp }
 *
 * "panel" scope is issued after credential + TOTP success and grants access
 * to all /api/rtdb and /api/devices endpoints (scoped to that tenant).
 *
 * "admin" scope is only issued to role=superadmin and unlocks /api/admin/*.
 */

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

if (!JWT_SECRET) {
  console.warn("[auth] JWT_SECRET is not set — using insecure fallback. Set JWT_SECRET in env immediately.");
}

const effectiveSecret = JWT_SECRET || "INSECURE_DEV_SECRET_DO_NOT_USE_IN_PROD";

export function signPanelToken(payload) {
  return jwt.sign({ ...payload, scope: "panel" }, effectiveSecret, { expiresIn: JWT_EXPIRES_IN });
}

export function signAdminToken(payload) {
  return jwt.sign({ ...payload, scope: "admin" }, effectiveSecret, { expiresIn: JWT_EXPIRES_IN });
}

/** Short-lived intermediate token for "credentials OK, TOTP pending" state. */
export function signTotpChallengeToken(payload) {
  return jwt.sign({ ...payload, scope: "totp_challenge" }, effectiveSecret, { expiresIn: "5m" });
}

function readBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  if (typeof h !== "string") return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** Verify and require panel-scope token. Sets req.auth = decoded. */
export function requirePanelAuth(req, res, next) {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ ok: false, error: "missing token" });
  try {
    const decoded = jwt.verify(token, effectiveSecret);
    if (decoded.scope !== "panel") return res.status(403).json({ ok: false, error: "wrong scope" });
    if (!decoded.tenantId) return res.status(403).json({ ok: false, error: "no tenant" });
    req.auth = decoded;
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "invalid token" });
  }
}

export function requireAdminAuth(req, res, next) {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ ok: false, error: "missing token" });
  try {
    const decoded = jwt.verify(token, effectiveSecret);
    if (decoded.scope !== "admin" || decoded.role !== "superadmin") {
      return res.status(403).json({ ok: false, error: "admin only" });
    }
    req.auth = decoded;
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "invalid token" });
  }
}

export function requireTotpChallenge(req, res, next) {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ ok: false, error: "missing token" });
  try {
    const decoded = jwt.verify(token, effectiveSecret);
    if (decoded.scope !== "totp_challenge") return res.status(403).json({ ok: false, error: "wrong scope" });
    req.auth = decoded;
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "invalid challenge" });
  }
}
