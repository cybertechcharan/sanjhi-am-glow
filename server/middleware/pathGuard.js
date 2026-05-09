/**
 * Server-side write whitelist for the per-tenant RTDB tree.
 *
 * Some paths (session, auth, panel_config.scanned_by, …) are server-managed.
 * Even an authenticated admin must NOT be able to write/clobber them via the
 * generic /api/rtdb/* endpoints — that's the exploit class the security
 * tester used to inject a fake `auth.users.testuser`.
 *
 * Reads are allowed (panel UI shows session info etc.), writes are blocked.
 */

const FORBIDDEN_WRITE_PREFIXES = [
  "session",
  "auth",
  "panel_config/scanned_by",
  "panel_config/scan_time",
  "_internal",
];

function normalize(path) {
  return String(path || "").replace(/^\/+|\/+$/g, "");
}

export function isWriteForbidden(path) {
  const p = normalize(path);
  if (!p) return true; // root-level writes never allowed
  for (const prefix of FORBIDDEN_WRITE_PREFIXES) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function blockForbiddenWrites(req, res, next) {
  const path = req.body?.path ?? req.query?.path ?? "";
  if (isWriteForbidden(path)) {
    return res.status(403).json({ ok: false, error: "write to this path is forbidden" });
  }
  return next();
}
