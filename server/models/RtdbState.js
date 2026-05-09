import mongoose from "mongoose";

/**
 * Multi-tenant RTDB state.
 * One document per tenant. _id === tenantId.
 *
 * Every read/write done by the panel goes through rtdbController which
 * picks the document by req.auth.tenantId — strict isolation.
 */
const rtdbStateSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    tree: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { collection: "rtdb_state", versionKey: false, timestamps: true }
);

export default mongoose.model("RtdbState", rtdbStateSchema);
