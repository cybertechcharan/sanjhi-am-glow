import mongoose from "mongoose";

/** Aligns with Android PbApi.saveDevice + web DeviceUser / devices collection. */
const deviceSchema = new mongoose.Schema(
  {
    android_id: { type: String, required: true, unique: true, index: true },
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

export default mongoose.model("Device", deviceSchema);
