// Socket.io client wrapper for the SS Mario multiplayer backend.
// The socket.io client CDN script must be loaded before this module is used.
// In your scene's onLoad, call Multiplayer.connect(serverUrl) then joinRoom().
//
// Usage:
//   const MP = require("Multiplayer");
//   await MP.connect("https://your-backend.com");
//   MP.joinRoom("room1", "PlayerName");
//   MP.on("playerJoined", (data) => { ... });
//   MP.sendStateUpdate({ x: 100, y: 200, facingRight: true });

const SOCKET_IO_CDN =
  "https://cdn.socket.io/4.7.2/socket.io.min.js";

let socket = null;
let _serverUrl = null;
const _handlers = {};

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    if (typeof document === "undefined") {
      reject(new Error("No DOM"));
      return;
    }
    if (document.querySelector('script[src="' + src + '"]')) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.onload = resolve;
    el.onerror = function () { reject(new Error("Failed to load " + src)); };
    document.head.appendChild(el);
  });
}

// Connect to the backend. serverUrl e.g. "http://localhost:3000"
async function connect(serverUrl) {
  if (socket && socket.connected) return socket;
  await loadScript(SOCKET_IO_CDN);
  _serverUrl = serverUrl;
  socket = window.io(serverUrl);

  socket.on("roomJoined", function (data) { _emit("roomJoined", data); });
  socket.on("playerJoined", function (data) { _emit("playerJoined", data); });
  socket.on("playerLeft", function (data) { _emit("playerLeft", data); });
  socket.on("playerUpdate", function (data) { _emit("playerUpdate", data); });
  socket.on("playerScoreUpdate", function (data) { _emit("playerScoreUpdate", data); });
  socket.on("playerLivesUpdate", function (data) { _emit("playerLivesUpdate", data); });
  socket.on("disconnect", function () { _emit("disconnect", {}); });

  return socket;
}

function _emit(event, data) {
  const handlers = _handlers[event];
  if (!handlers) return;
  for (let i = 0; i < handlers.length; i++) {
    try { handlers[i](data); } catch (e) { cc.error("[Multiplayer]", e); }
  }
}

function on(event, handler) {
  if (!_handlers[event]) _handlers[event] = [];
  _handlers[event].push(handler);
}

function off(event, handler) {
  if (!_handlers[event]) return;
  _handlers[event] = _handlers[event].filter(function (h) { return h !== handler; });
}

function joinRoom(roomId, playerName) {
  if (!socket) { cc.error("[Multiplayer] call connect() first"); return; }
  socket.emit("joinRoom", { roomId: roomId, playerName: playerName });
}

function sendStateUpdate(state) {
  if (!socket || !socket.connected) return;
  socket.emit("stateUpdate", state);
}

function sendScoreUpdate(score) {
  if (!socket || !socket.connected) return;
  socket.emit("scoreUpdate", { score: score });
}

function sendLivesUpdate(lives) {
  if (!socket || !socket.connected) return;
  socket.emit("livesUpdate", { lives: lives });
}

function disconnect() {
  if (socket) { socket.disconnect(); socket = null; }
}

function isConnected() {
  return !!(socket && socket.connected);
}

module.exports = {
  connect: connect,
  disconnect: disconnect,
  isConnected: isConnected,
  joinRoom: joinRoom,
  sendStateUpdate: sendStateUpdate,
  sendScoreUpdate: sendScoreUpdate,
  sendLivesUpdate: sendLivesUpdate,
  on: on,
  off: off,
};
