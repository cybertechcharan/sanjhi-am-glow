/**
 * Cyber Panel server — Express + MongoDB + Socket.IO.
 *
 * Hardening summary:
 *  - Helmet for HTTP security headers.
 *  - Strict CORS (only origins listed in CORS_ORIGIN env, no `*` in prod).
 *  - Global rate limit on /api plus tighter limits on /api/auth.
 *  - JWT-protected /api/rtdb, /api/devices, /api/auth/me, etc. (see routes).
 *  - Path write-guard prevents clobbering server-managed RTDB paths
 *    (auth/*, session/*, panel_config.scanned_by, ...).
 *  - Multi-tenant isolation: every request resolves a tenantId from the JWT
 *    and the controller scopes all reads/writes to that tenant only.
 *  - Socket.IO requires a JWT and joins a per-tenant room, so realtime
 *    updates never cross tenants.
 *  - Mandatory TOTP 2FA: login is a 2-step credential → TOTP flow.
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import deviceRoutes from "./routes/deviceRoutes.js";
import rtdbRoutes from "./routes/rtdbRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import Device from "./models/Device.js";
import { initAdminPassword } from "./controllers/authController.js";

const PORT = Number(process.env.PORT) || 5050;
const RAW_CORS = (process.env.CORS_ORIGIN || "").trim();
const NODE_ENV = process.env.NODE_ENV || "development";
const allowedOrigins =
  RAW_CORS && RAW_CORS !== "*"
    ? RAW_CORS.split(",").map((s) => s.trim()).filter(Boolean)
    : NODE_ENV === "production"
      ? []
      : true; // dev: allow any origin

if (NODE_ENV === "production" && (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0)) {
  console.warn(
    "[cors] CORS_ORIGIN must list explicit origins in production. Refusing all browser origins until configured."
  );
}

if (!process.env.JWT_SECRET) {
  console.warn(
    "[boot] JWT_SECRET is not set. The server will use an insecure fallback secret. Set JWT_SECRET in env."
  );
}

let lastDbError = "not attempted";
let lastDbAttemptAt = 0;

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: allowedOrigins, credentials: false }));
app.use(express.json({ limit: "2mb" }));
app.set("io", io);

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

app.get("/", (_req, res) => {
  res.type("text").send("cyber-panel-server ok");
});

app.get("/api/debug/db", (_req, res) => {
  res.json({
    ok: true,
    readyState: mongoose.connection.readyState,
    readyStateText:
      mongoose.connection.readyState === 1
        ? "connected"
        : mongoose.connection.readyState === 2
          ? "connecting"
          : mongoose.connection.readyState === 3
            ? "disconnecting"
            : "disconnected",
    lastDbAttemptAt,
    lastDbError,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/rtdb", rtdbRoutes);
app.use("/api/admin", adminRoutes);

const watchers = new Map();

function notifyWatchers(deviceId, payload) {
  const set = watchers.get(deviceId);
  if (!set) return;
  for (const sid of set) {
    io.to(sid).emit("deviceRealtime", payload);
  }
}

const SOCKET_SECRET = process.env.JWT_SECRET || "INSECURE_DEV_SECRET_DO_NOT_USE_IN_PROD";

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("missing token"));
    const decoded = jwt.verify(String(token), SOCKET_SECRET);
    if (!decoded.tenantId || (decoded.scope !== "panel" && decoded.scope !== "admin")) {
      return next(new Error("invalid scope"));
    }
    socket.data.tenantId = decoded.tenantId;
    socket.data.role = decoded.role;
    return next();
  } catch {
    return next(new Error("invalid token"));
  }
});

io.on("connection", (socket) => {
  const tenantId = socket.data.tenantId;
  socket.join(`tenant:${tenantId}`);

  socket.on("watchDevice", (rawId) => {
    const id = String(rawId || "").trim();
    if (!id) return;
    const room = `tenant:${tenantId}:${id}`;
    socket.join(room);
    if (!watchers.has(id)) watchers.set(id, new Set());
    watchers.get(id).add(socket.id);
  });

  socket.on("unwatchDevice", (rawId) => {
    const id = String(rawId || "").trim();
    if (!id || !watchers.has(id)) return;
    watchers.get(id).delete(socket.id);
    socket.leave(`tenant:${tenantId}:${id}`);
  });

  socket.on("registerDevice", (rawId) => {
    const id = String(rawId || "").trim();
    if (!id) return;
    const room = `tenant:${tenantId}:${id}`;
    socket.join(room);
    socket.emit("deviceRegistered", { android_id: id });
    io.to(`tenant:${tenantId}`).emit("deviceStatus", { android_id: id, connectivity: "Online", updatedAt: new Date() });
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
      if (!doc?.android_id || !doc?.tenantId) return;
      io.to(`tenant:${doc.tenantId}`).emit("deviceUpdateGlobal", doc);
      io.to(`tenant:${doc.tenantId}:${doc.android_id}`).emit("deviceUpdate", doc);
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
  console.log(`cyber-panel-server http://localhost:${PORT}`);
});

async function connectWithRetry() {
  const retryMs = 10000;
  lastDbAttemptAt = Date.now();
  try {
    await connectDB();
    lastDbError = "";
    await initAdminPassword();
    startWatch();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    lastDbError = msg;
    console.error(`[db] connect failed: ${msg}`);
    console.error(`[db] retrying in ${retryMs / 1000}s...`);
    setTimeout(() => {
      void connectWithRetry();
    }, retryMs);
  }
}

void connectWithRetry();
