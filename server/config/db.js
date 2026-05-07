import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set");
  }
  await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 15000,
  });
  console.log("MongoDB connected");
}
