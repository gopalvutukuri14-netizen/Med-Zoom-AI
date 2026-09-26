// server.js - socket / http server for MedZoom AI
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";
import 'dotenv/config'; // load .env

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js'; // keep if used

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());

// Connect to MongoDB (local or MongoDB Atlas global cloud)
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch((err) => console.error('❌ Mongo connect error:', err.message));

  mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB connection lost. Reconnecting...'));
  mongoose.connection.on('error', (err) => console.error('❌ MongoDB error:', err.message));
} else {
  console.warn('⚠️ MONGODB_URI is not set. Set it in .env (e.g. MongoDB Atlas connection string) for database persistence.');
}


// Auth routes
app.use('/api/auth', authRoutes);

// Server-side AI X-Ray report generation endpoint
app.post("/api/generate-report", async (req, res) => {
  try {
    const { diagnosis } = req.body;
    if (!diagnosis) {
      return res.status(400).json({ ok: false, error: "Diagnosis text is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "GEMINI_API_KEY is not configured on the server." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Write a concise medical radiology summary (4-5 lines) for a chest X-ray.\nDiagnosis: ${diagnosis}\nUse professional, simple medical language.\nAvoid over-claiming.`;
    const result = await model.generateContent(prompt);
    const reportText = result?.response?.text() || "No report generated.";

    return res.json({ ok: true, report: reportText });
  } catch (err) {
    console.error("Gemini report generation error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Failed to generate AI report" });
  }
});


// Proxy /predict to AI service (AI server should run separately)
app.use(
  "/predict",
  createProxyMiddleware({
    target: process.env.AI_PREDICT_TARGET || "http://localhost:5001",
    changeOrigin: true,
    logLevel: "warn"
  })
);

// Serve static files (client build and public)
app.use(express.static(path.join(__dirname, "../client/dist")));
app.use(express.static(path.join(__dirname, "public")));

// In-memory room store
// rooms[roomName] = { code, hostName, hostSocketId, lastXray, participants: [{socketId,name}], videoStates: {}, audioStates: {} }
const rooms = {};

// drawing colors
const COLORS = [
  "#ef4444", "#22c55e", "#3b82f6", "#eab308",
  "#a855f7", "#f97316", "#ec4899", "#14b8a6"
];
let colorIndex = 0;

// ----- Helpers -----
function ensureRoom(roomName) {
  if (!rooms[roomName]) {
    rooms[roomName] = {
      code: null,
      hostName: null,
      hostSocketId: null,
      lastXray: null,
      participants: [],
      videoStates: {},
      audioStates: {}
    };
  }
  return rooms[roomName];
}

function ensureRoomParticipants(roomName) {
  ensureRoom(roomName);
  if (!Array.isArray(rooms[roomName].participants)) rooms[roomName].participants = [];
  return true;
}

function broadcastParticipantList(roomName) {
  if (!rooms[roomName]) {
    io.to(roomName).emit('participant-list', { participants: [] });
    return;
  }
  const participants = rooms[roomName].participants || [];
  io.to(roomName).emit('participant-list', { participants });
}

function dedupeParticipants(roomName) {
  if (!rooms[roomName] || !Array.isArray(rooms[roomName].participants)) return;
  const list = rooms[roomName].participants;

  // 1) Remove exact duplicate socketId entries (keep last)
  const bySocket = new Map();
  for (const p of list) bySocket.set(p.socketId, p);
  let uniqueBySocket = Array.from(bySocket.values());

  // 2) Collapse same-named users (keep last)
  const byName = new Map();
  for (const p of uniqueBySocket) byName.set(p.name, p);
  rooms[roomName].participants = Array.from(byName.values());
}

// A periodic dedupe for all rooms (safe)
function dedupeAllRooms() {
  Object.keys(rooms).forEach(roomName => {
    try {
      dedupeParticipants(roomName);
      broadcastParticipantList(roomName);
      console.log(`✓ DEDUPED room ${roomName}: ${rooms[roomName].participants.length} participants`);
    } catch (e) {
      // swallow
    }
  });
}

// ---------- HTTP API (room creation / check) ----------
app.post("/api/create-room", (req, res) => {
  const { roomName, roomCode, displayName } = req.body;
  if (!roomName || !roomCode || !displayName) return res.json({ ok: false, msg: "Missing fields" });

  rooms[roomName] = {
    code: roomCode,
    hostName: displayName,
    hostSocketId: null,
    lastXray: null,
    participants: [],
    videoStates: {},
    audioStates: {}
  };
  return res.json({ ok: true });
});

app.post("/api/check-room", (req, res) => {
  const { roomName, roomCode } = req.body;
  const room = rooms[roomName];
  if (!room) return res.json({ ok: false, msg: "Room not found" });
  if (room.code !== roomCode) return res.json({ ok: false, msg: "Wrong room code" });
  return res.json({ ok: true });
});

// ---------- Socket.IO ----------
io.on("connection", socket => {
  console.log("🔌 Socket connected:", socket.id);

  // give this connection a draw color
  const drawColor = COLORS[colorIndex++ % COLORS.length];
  socket.data.drawColor = drawColor;
  socket.emit("your-color", drawColor);

  // request handlers
  socket.on("request-join", ({ room, name }) => {
    const roomObj = rooms[room];
    if (!roomObj) {
      socket.emit("join-rejected", { reason: "Room not found" });
      return;
    }
    if (!roomObj.hostSocketId) {
      socket.emit("join-rejected", { reason: "Host not in meeting yet" });
      return;
    }

    socket.data.pendingRoom = room;
    socket.data.name = name;

    io.to(roomObj.hostSocketId).emit("join-request", {
      socketId: socket.id,
      name,
      room
    });
  });

  socket.on("join-room", ({ room, name, isHost }) => {
    const roomObj = rooms[room];
    if (!roomObj) {
      socket.emit("join-rejected", { reason: "Room not found" });
      return;
    }

    socket.join(room);
    socket.data.room = room;
    socket.data.name = name;
    socket.data.isHost = !!isHost;

    if (isHost) {
      roomObj.hostSocketId = socket.id;
      roomObj.hostName = name || roomObj.hostName || "Host";
      console.log(`⭐ HOST ${name} joined room ${room}`);
    } else {
      console.log(`👤 USER ${name} joined room ${room}`);
    }

    // Ensure participants array exists
    ensureRoomParticipants(room);

    // Remove any previous entries for this socket
    roomObj.participants = roomObj.participants.filter(p => p.socketId !== socket.id);
    roomObj.participants = roomObj.participants.filter(p => p.name !== (name || "Participant"));

    // Add current participant to room's participant list
    roomObj.participants.push({ socketId: socket.id, name: name || "Participant" });
    
    // final guard dedupe
    dedupeParticipants(room);

    // emit room-info to this client
    socket.emit("room-info", {
      room,
      code: roomObj.code,
      hostName: roomObj.hostName,
      participants: roomObj.participants,
      videoStates: roomObj.videoStates,
      audioStates: roomObj.audioStates,
      lastXray: roomObj.lastXray
    });

    // if a last xray exists, also send it explicitly (good for older clients)
    if (roomObj.lastXray) {
      socket.emit("xray-result", roomObj.lastXray);
    }

    // notify existing participants to kick off WebRTC handshake
    socket.to(room).emit("user-joined", {
      socketId: socket.id,
      name
    });

    // system message and participant-list broadcast
    io.to(room).emit("system-message", `${name} joined the room`);
    broadcastParticipantList(room);
  });

  socket.on("approve-join", ({ targetSocketId, room }) => {
    const roomObj = rooms[room];
    if (!roomObj || roomObj.hostSocketId !== socket.id) return;

    const target = io.sockets.sockets.get(targetSocketId);
    if (!target) return;

    // Add target to participants list if not present
    ensureRoomParticipants(room);
    roomObj.participants = roomObj.participants.filter(p => p.socketId !== targetSocketId);
    const nameForParticipant = target.data?.name || target._joinName || "Guest";
    roomObj.participants.push({ socketId: targetSocketId, name: nameForParticipant });
    dedupeParticipants(room);

    target.emit("join-approved");
    io.to(room).emit("system-message", `${nameForParticipant} was admitted.`);
    io.to(room).emit("user-joined", { socketId: targetSocketId, name: nameForParticipant });
    broadcastParticipantList(room);
  });

  socket.on("reject-join", ({ targetSocketId, room }) => {
    const roomObj = rooms[room];
    if (!roomObj || roomObj.hostSocketId !== socket.id) return;

    const target = io.sockets.sockets.get(targetSocketId);
    if (!target) return;
    target.emit("join-rejected", { reason: "Host denied your request" });
    io.to(room).emit("system-message", `A join request was denied by the host.`);
  });

  // WebRTC signals
  socket.on("offer", ({ to, sdp }) => { io.to(to).emit("offer", { from: socket.id, sdp }); });
  socket.on("answer", ({ to, sdp }) => { io.to(to).emit("answer", { from: socket.id, sdp }); });
  socket.on("ice-candidate", ({ to, candidate }) => { io.to(to).emit("ice-candidate", { from: socket.id, candidate }); });

  // chat
  socket.on("chat-message", data => {
    io.to(data.room).emit("chat-message", {
      name: data.name,
      message: data.message
    });
  });

  // video/audio state toggle from clients
  socket.on('video-state', ({ room, enabled }) => {
    if (!rooms[room]) ensureRoom(room);
    rooms[room].videoStates[socket.id] = enabled;
    socket.to(room).emit('video-state', { socketId: socket.id, enabled });
  });

  socket.on('audio-state', ({ room, enabled }) => {
    if (!rooms[room]) ensureRoom(room);
    rooms[room].audioStates[socket.id] = enabled;
    socket.to(room).emit('audio-state', { socketId: socket.id, enabled });
  });

  // X-ray result broadcast & save
  socket.on("xray-result", data => {
    const room = socket.data.room;
    if (!room || !rooms[room]) return;
    rooms[room].lastXray = {
      from: socket.data.name,
      result: data.result,
      confidence: data.confidence,
      image: data.image
    };
    io.to(room).emit("xray-result", rooms[room].lastXray);
  });

  // collaborative drawing
  socket.on("draw-op", data => {
    const room = (data && data.room) || socket.data.room;
    if (!room) return;

    const payload = { ...data, room, from: socket.id };
    if (payload.action === "add" && payload.stroke) {
      payload.stroke = { ...payload.stroke, color: payload.stroke.color || socket.data.drawColor || "#ff0000" };
    }

    io.to(room).emit("draw-op", payload);
  });

  // host manually ends meeting
  socket.on("end-meeting", ({ room }) => {
    const roomObj = rooms[room];
    if (!roomObj || roomObj.hostSocketId !== socket.id) return;
    console.log(`🏁 Host ended meeting for room ${room}`);
    io.to(room).emit("room-ended");
    delete rooms[room];
  });

  // socket disconnect
  socket.on("disconnect", () => {
    const room = socket.data.room;
    const name = socket.data.name || socket._joinName || "Someone";

    if (room && rooms[room]) {
      const roomObj = rooms[room];

      // host disconnect
      if (roomObj && roomObj.hostSocketId === socket.id) {
        console.log(`⚠️ Host disconnected… waiting to see if they reconnect`);
        roomObj.hostSocketId = null;

        setTimeout(() => {
          if (rooms[room] && !rooms[room].hostSocketId) {
            console.log(`🏁 Host did NOT return → ending room ${room}`);
            io.to(room).emit("room-ended");
            io.to(room).emit('participant-list', { participants: [] });
            delete rooms[room];
          }
        }, 5000);

      } else {
        // normal participant disconnect
        if (Array.isArray(roomObj.participants)) {
          const idx = roomObj.participants.findIndex(p => p.socketId === socket.id);
          if (idx !== -1) {
            const removed = roomObj.participants.splice(idx, 1)[0];
            socket.to(room).emit("user-left", { socketId: socket.id, name: removed?.name || name });
            io.to(room).emit("system-message", `${removed?.name || name} left the room`);
            broadcastParticipantList(room);
          } else {
            socket.to(room).emit("user-left", { socketId: socket.id, name });
            io.to(room).emit("system-message", `${name} left the room`);
          }
        } else {
          socket.to(room).emit("user-left", { socketId: socket.id, name });
          io.to(room).emit("system-message", `${name} left the room`);
        }
      }
    }

    console.log("❌ Socket disconnected:", socket.id);
  });
});

// serve dashboard and room html from public directory
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html"));
});
app.get("/room", (req, res) => {
  res.sendFile(path.join(__dirname, "public/room.html"));
});

// SPA fallback
app.get("*", (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/predict') || req.path.startsWith('/socket.io')) {
    return res.status(404).end();
  }
  const indexPath = path.join(__dirname, "../client/dist/index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.sendFile(path.join(__dirname, "public/dashboard.html"));
  }
});

// start server
const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MedZoom AI Backend running at http://0.0.0.0:${PORT}`);
  // initial dedupe (if any)
  try { dedupeAllRooms(); } catch (e) { /* ignore */ }
});

