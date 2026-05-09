import crypto from "crypto";
import Admin from "../models/Admin.js";
import RtdbState from "../models/RtdbState.js";
import Device from "../models/Device.js";

/**
 * Idempotent startup migrations.
 *
 * 1. Backfill `tenantId` on every Admin row that doesn't have one.
 * 2. Move the legacy `rtdb_state` document with `_id === "singleton"` to a
 *    tenanted document keyed by the FIRST migrated admin's tenantId, so the
 *    existing panel data is preserved (not nuked).
 * 3. Backfill `tenantId` on every Device row that doesn't have one,
 *    pointing them at the same first-admin tenant.
 *
 * After this runs, all per-tenant routes read isolated data per admin and
 * legacy data continues to live under the original admin's tenant.
 */

function newTenantId() {
  return `t_${crypto.randomBytes(8).toString("hex")}`;
}

export async function runMigrations() {
  const summary = { admins_backfilled: 0, devices_backfilled: 0, singleton_moved: false, fresh_states_created: 0 };

  const orphanAdmins = await Admin.find({ $or: [{ tenantId: { $exists: false } }, { tenantId: null }, { tenantId: "" }] });
  if (orphanAdmins.length === 0 && (await RtdbState.findById("singleton").lean()) === null) {
    return summary;
  }

  const tenantAssignments = [];
  for (const a of orphanAdmins) {
    a.tenantId = newTenantId();
    if (typeof a.role !== "string") a.role = "admin";
    if (typeof a.totp_enrolled !== "boolean") a.totp_enrolled = false;
    if (a.totp_secret === undefined) a.totp_secret = null;
    await a.save();
    tenantAssignments.push({ adminId: String(a._id), tenantId: a.tenantId });
    summary.admins_backfilled += 1;
  }

  const firstAdmin = await Admin.findOne({}).sort({ createdAt: 1, _id: 1 }).lean();
  const primaryTenantId = firstAdmin?.tenantId;

  if (primaryTenantId) {
    const singleton = await RtdbState.findById("singleton").lean();
    if (singleton) {
      const exists = await RtdbState.findById(primaryTenantId).lean();
      if (!exists) {
        await RtdbState.create({ _id: primaryTenantId, tenantId: primaryTenantId, tree: singleton.tree || {} });
      }
      await RtdbState.deleteOne({ _id: "singleton" });
      summary.singleton_moved = true;
    }

    const devicesNoTenant = await Device.updateMany(
      { $or: [{ tenantId: { $exists: false } }, { tenantId: null }, { tenantId: "" }] },
      { $set: { tenantId: primaryTenantId } }
    );
    summary.devices_backfilled = devicesNoTenant.modifiedCount || 0;

    for (const a of await Admin.find({}).lean()) {
      if (!a.tenantId) continue;
      const exists = await RtdbState.findById(a.tenantId).lean();
      if (!exists) {
        await RtdbState.create({ _id: a.tenantId, tenantId: a.tenantId, tree: {} });
        summary.fresh_states_created += 1;
      }
    }
  }

  if (Object.values(summary).some((v) => v && v !== 0)) {
    console.log("[migrations] applied:", summary);
  }
  return summary;
}
