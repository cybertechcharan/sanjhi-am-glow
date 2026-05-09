import mongoose from "mongoose";

/**
 * Devices are scoped per tenant. android_id is unique *inside a tenant*
 * (compound unique index), so two different admins can have devices with
 * the same android_id without collision.
 */
const deviceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    android_id: { type: String, required: true, index: true },
    brand: { type: String, default: "" },
    model: { type: String, default: "" },
    android_version: { type: String, default: "" },
    sdk: { type: Number, default: 0 },
    battery: { type: Number, default: 0 },
    fcm_token: { type: String, default: "" },
    sim1: { type: String, default: "" },
    sim2: { type: String, default: "" },
    status: { type: String, default: "offline" },
    timestamp: { type: Number, default: () => Date.now() },
    kiskahai: { type: String, default: "" },
    ip: { type: String, default: "" },
    notes: { type: String, default: "" },
    forms: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "devices" }
);

deviceSchema.index({ tenantId: 1, android_id: 1 }, { unique: true });

export default mongoose.model("Device", deviceSchema);
