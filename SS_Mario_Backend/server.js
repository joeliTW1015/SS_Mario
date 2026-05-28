const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

// API key for protected (write) endpoints. Override with the MARIO_API_KEY env
// var in production; the default below is for local development only.
const API_KEY = process.env.MARIO_API_KEY || "ss-mario-dev-key-2026";

// roomId -> { players: { socketId -> PlayerState } }
const rooms = {};

// Realtime Database REST base. A node is read/written by appending "<path>.json".
// Public read/write on the leaderboard node is governed by the database rules.
const DATABASE_URL =
  process.env.FIREBASE_DB_URL ||
  "https://ss-mario-250da-default-rtdb.asia-southeast1.firebasedatabase.app";
const LEADERBOARD_URL = DATABASE_URL + "/leaderboard.json";

// Dummy data used to seed the Realtime Database leaderboard if it is empty.
// Each entry: { username, level, score, timestamp } (timestamp = Unix epoch ms).
const DUMMY_LEADERBOARD = [
  { username: "Mario",  level: 8, score: 15200, timestamp: 1748390400000 },
  { username: "Luigi",  level: 6, score: 11800, timestamp: 1748304000000 },
  { username: "Peach",  level: 5, score:  9400, timestamp: 1748217600000 },
  { username: "Toad",   level: 3, score:  5100, timestamp: 1748131200000 },
  { username: "Bowser", level: 2, score:  2600, timestamp: 1748044800000 },
];

// Reads all leaderboard entries from Realtime Database, sorted by score (desc).
async function readLeaderboard() {
  const r = await fetch(LEADERBOARD_URL);
  if (!r.ok) throw new Error("RTDB GET -> HTTP " + r.status);
  const data = await r.json();
  const out = [];
  if (data) {
    for (const key of Object.keys(data)) {
      const v = data[key] || {};
      out.push({ key: key, username: v.username, level: v.level, score: v.score, timestamp: v.timestamp });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

// Seeds the dummy rows into Realtime Database once, only if it is currently empty.
async function seedLeaderboardIfEmpty() {
  try {
    const existing = await readLeaderboard();
    if (existing.length > 0) return;
    for (const entry of DUMMY_LEADERBOARD) {
      await fetch(LEADERBOARD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
    }
    console.log("Leaderboard seeded with dummy data");
  } catch (e) {
    console.warn("Leaderboard seed skipped:", e.message);
  }
}

function getOrCreateRoom(roomId) {
  if (!rooms[roomId]) rooms[roomId] = { players: {} };
  return rooms[roomId];
}

// REST: list active rooms
app.get("/rooms", (req, res) => {
  const list = Object.entries(rooms).map(([id, room]) => ({
    id,
    playerCount: Object.keys(room.players).length,
  }));
  res.json(list);
});

// REST: health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", rooms: Object.keys(rooms).length });
});

// REST: get the full player leaderboard as JSON (all fields), highest score first.
// Backed by Realtime Database.
// Method:   GET /leaderboard
// Response: 200 -> [ { key, username, level, score, timestamp }, ... ]
app.get("/leaderboard", async (req, res) => {
  try {
    res.json(await readLeaderboard());
  } catch (e) {
    res.status(502).json({ error: "Failed to read leaderboard", detail: e.message });
  }
});

// REST: add a player leaderboard entry. Protected by the API key. Persists to
// Realtime Database.
// Method:   POST /leaderboard
// Headers:  x-api-key: <API_KEY>
// Body:     { username: string, level: number, score: number }
// The server stamps timestamp (Unix epoch ms). Response: 201 -> the created entry.
app.post("/leaderboard", async (req, res) => {
  if (req.header("x-api-key") !== API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }
  const { username, level, score } = req.body || {};
  if (typeof username !== "string" || !username.trim()) {
    return res.status(400).json({ error: "username (non-empty string) is required" });
  }
  const entry = {
    username: username.trim().slice(0, 20),
    level: Number(level) || 0,
    score: Number(score) || 0,
    timestamp: Date.now(),
  };
  try {
    const r = await fetch(LEADERBOARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!r.ok) throw new Error("RTDB POST -> HTTP " + r.status + " " + (await r.text()));
    const saved = await r.json(); // Firebase returns { name: "<generated-key>" }
    res.status(201).json(Object.assign({ key: saved && saved.name }, entry));
  } catch (e) {
    res.status(502).json({ error: "Failed to save leaderboard entry", detail: e.message });
  }
});

io.on("connection", (socket) => {
  let currentRoom = null;

  // joinRoom: { roomId: string, playerName: string }
  socket.on("joinRoom", ({ roomId, playerName }) => {
    if (currentRoom) {
      leaveCurrentRoom();
    }

    const room = getOrCreateRoom(roomId);
    room.players[socket.id] = {
      name: String(playerName || "Player").slice(0, 20),
      x: 0,
      y: 0,
      score: 0,
      lives: 3,
      facingRight: true,
    };

    currentRoom = roomId;
    socket.join(roomId);

    // Send current room state to the joining player
    socket.emit("roomJoined", {
      roomId,
      myId: socket.id,
      players: room.players,
    });

    // Notify others
    socket.to(roomId).emit("playerJoined", {
      id: socket.id,
      ...room.players[socket.id],
    });
  });

  // stateUpdate: { x, y, facingRight, animState }
  socket.on("stateUpdate", (state) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const player = rooms[currentRoom].players[socket.id];
    if (!player) return;
    Object.assign(player, {
      x: state.x,
      y: state.y,
      facingRight: state.facingRight,
      animState: state.animState,
    });
    socket.to(currentRoom).emit("playerUpdate", { id: socket.id, ...state });
  });

  // scoreUpdate: { score }
  socket.on("scoreUpdate", ({ score }) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const player = rooms[currentRoom].players[socket.id];
    if (!player) return;
    player.score = Number(score) || 0;
    socket.to(currentRoom).emit("playerScoreUpdate", {
      id: socket.id,
      score: player.score,
    });
  });

  // livesUpdate: { lives }
  socket.on("livesUpdate", ({ lives }) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const player = rooms[currentRoom].players[socket.id];
    if (!player) return;
    player.lives = Number(lives) || 0;
    socket.to(currentRoom).emit("playerLivesUpdate", {
      id: socket.id,
      lives: player.lives,
    });
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom();
  });

  function leaveCurrentRoom() {
    if (!currentRoom || !rooms[currentRoom]) return;
    delete rooms[currentRoom].players[socket.id];
    io.to(currentRoom).emit("playerLeft", { id: socket.id });
    if (Object.keys(rooms[currentRoom].players).length === 0) {
      delete rooms[currentRoom];
    }
    currentRoom = null;
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Mario backend listening on port " + PORT);
  seedLeaderboardIfEmpty();
});
