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

// roomId -> { players: { socketId -> PlayerState } }
const rooms = {};

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
});
