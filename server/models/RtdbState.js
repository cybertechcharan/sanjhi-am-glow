import mongoose from "mongoose";

const rtdbStateSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "singleton" },
    tree: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { collection: "rtdb_state", versionKey: false }
);

export default mongoose.model("RtdbState", rtdbStateSchema);
