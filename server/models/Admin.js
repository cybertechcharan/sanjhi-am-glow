import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    password_hash: { type: String, required: true },
  },
  { timestamps: true, collection: "admins" }
);

export default mongoose.model("Admin", adminSchema);
