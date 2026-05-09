import RtdbState from "../models/RtdbState.js";

/**
 * Multi-tenant RTDB controller.
 * Every operation reads/writes the document with _id === req.auth.tenantId.
 * Without a JWT this controller is unreachable (see authMiddleware).
 *
 * Sensitive paths (session/*, auth/*) are blocked from being written by the
 * generic write endpoints via pathGuard middleware — they are server-managed.
 */

function splitPath(path = "") {
  return String(path).split("/").filter(Boolean);
}

function getAt(root, path) {
  const segs = splitPath(path);
  let cur = root;
  for (const seg of segs) {
    if (cur == null || typeof cur !== "object") return null;
    cur = cur[seg];
  }
  return cur ?? null;
}

function setAt(root, path, value) {
  const segs = splitPath(path);
  if (segs.length === 0) return value;
  const out = { ...(root && typeof root === "object" ? root : {}) };
  let cur = out;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i];
    const next = cur[k];
    cur[k] = next && typeof next === "object" ? { ...next } : {};
    cur = cur[k];
  }
  cur[segs[segs.length - 1]] = value;
  return out;
}

function removeAt(root, path) {
  const segs = splitPath(path);
  if (!segs.length) return {};
  const out = { ...(root && typeof root === "object" ? root : {}) };
  let cur = out;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i];
    if (!cur[k] || typeof cur[k] !== "object") return out;
    cur[k] = { ...cur[k] };
    cur = cur[k];
  }
  delete cur[segs[segs.length - 1]];
  return out;
}

function applyConstraints(obj, constraints = []) {
  if (!obj || typeof obj !== "object") return obj ?? null;
  const entries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
  let list = entries;
  let limit = null;
  let endBefore = null;
  let startAfter = null;
  for (const c of constraints) {
    if (c?.kind === "limitToLast") limit = Number(c.n) || null;
    if (c?.kind === "endBefore") endBefore = c.key ?? null;
    if (c?.kind === "startAfter") startAfter = c.key ?? null;
  }
  if (endBefore) {
    const idx = list.findIndex(([k]) => k === endBefore);
    list = idx <= 0 ? [] : list.slice(0, idx);
  }
  if (startAfter) {
    const idx = list.findIndex(([k]) => k === startAfter);
    list = idx < 0 ? [] : list.slice(idx + 1);
  }
  if (limit && list.length > limit) list = list.slice(-limit);
  return Object.fromEntries(list);
}

async function ensureState(tenantId) {
  const row = await RtdbState.findById(tenantId).lean();
  if (row) return row;
  await RtdbState.create({ _id: tenantId, tenantId, tree: {} });
  return { _id: tenantId, tenantId, tree: {} };
}

function tenantOf(req) {
  return req.auth?.tenantId;
}

function emitChange(req, path) {
  const tenantId = tenantOf(req);
  req.app.get("io")?.to(`tenant:${tenantId}`).emit("rtdb:changed", { path, ts: Date.now() });
}

export async function getPath(req, res) {
  const tenantId = tenantOf(req);
  if (!tenantId) return res.status(403).json({ ok: false, error: "no tenant" });
  const path = String(req.query.path || "");
  const row = await ensureState(tenantId);
  return res.json({ ok: true, value: getAt(row.tree, path) });
}

export async function queryPath(req, res) {
  const tenantId = tenantOf(req);
  if (!tenantId) return res.status(403).json({ ok: false, error: "no tenant" });
  const path = String(req.body?.path || "");
  const constraints = Array.isArray(req.body?.constraints) ? req.body.constraints : [];
  const row = await ensureState(tenantId);
  const value = applyConstraints(getAt(row.tree, path), constraints);
  return res.json({ ok: true, value });
}

export async function setPath(req, res) {
  const tenantId = tenantOf(req);
  if (!tenantId) return res.status(403).json({ ok: false, error: "no tenant" });
  const path = String(req.body?.path || "");
  const value = req.body?.value ?? null;
  const row = await ensureState(tenantId);
  const nextTree = setAt(row.tree, path, value);
  await RtdbState.updateOne({ _id: tenantId }, { $set: { tree: nextTree } }, { upsert: true });
  emitChange(req, path);
  return res.json({ ok: true });
}

export async function updatePath(req, res) {
  const tenantId = tenantOf(req);
  if (!tenantId) return res.status(403).json({ ok: false, error: "no tenant" });
  const path = String(req.body?.path || "");
  const values = req.body?.values;
  if (!values || typeof values !== "object") return res.status(400).json({ ok: false, error: "values object required" });
  const row = await ensureState(tenantId);
  const base = getAt(row.tree, path);
  const merged = { ...(base && typeof base === "object" ? base : {}), ...values };
  const nextTree = setAt(row.tree, path, merged);
  await RtdbState.updateOne({ _id: tenantId }, { $set: { tree: nextTree } }, { upsert: true });
  emitChange(req, path);
  return res.json({ ok: true });
}

export async function removePath(req, res) {
  const tenantId = tenantOf(req);
  if (!tenantId) return res.status(403).json({ ok: false, error: "no tenant" });
  const path = String(req.body?.path || "");
  const row = await ensureState(tenantId);
  const nextTree = removeAt(row.tree, path);
  await RtdbState.updateOne({ _id: tenantId }, { $set: { tree: nextTree } }, { upsert: true });
  emitChange(req, path);
  return res.json({ ok: true });
}

export async function pushPath(req, res) {
  const tenantId = tenantOf(req);
  if (!tenantId) return res.status(403).json({ ok: false, error: "no tenant" });
  const path = String(req.body?.path || "");
  const value = req.body?.value ?? null;
  const key = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const row = await ensureState(tenantId);
  const base = getAt(row.tree, path);
  const parent = base && typeof base === "object" ? { ...base } : {};
  parent[key] = value;
  const nextTree = setAt(row.tree, path, parent);
  await RtdbState.updateOne({ _id: tenantId }, { $set: { tree: nextTree } }, { upsert: true });
  emitChange(req, path);
  return res.json({ ok: true, key });
}
