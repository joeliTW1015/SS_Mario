// Firebase Realtime Database multiplayer presence/sync for SS Mario (Tier 1).
// Each player owns one node at rooms/<roomId>/players/<uid>. Players watch the
// whole players collection to see everyone else move.
//
// Usage:
//   const RoomSync = require("RoomSync");
//   await RoomSync.join("room1", uid, "Mario", { x, y, facingRight, anim, state });
//   RoomSync.on("playerJoined", (d) => { /* d.uid, d.state */ });
//   RoomSync.on("playerUpdate", (d) => { /* d.uid, d.state */ });
//   RoomSync.on("playerLeft",   (d) => { /* d.uid */ });
//   RoomSync.sendState({ x, y, facingRight, anim, state });   // call on a tick
//   RoomSync.leave();

const Firebase = require("Firebase");

let _playersRef = null;   // rooms/<roomId>/players
let _playerRef = null;    // rooms/<roomId>/players/<uid>
let _uid = null;

const _handlers = {};
let _cbAdded = null, _cbChanged = null, _cbRemoved = null;

function _emit(event, data) {
  const hs = _handlers[event];
  if (!hs) return;
  for (let i = 0; i < hs.length; i++) {
    try { hs[i](data); } catch (e) { cc.error("[RoomSync]", e); }
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

// Joins the room and starts listening. Resolves once our node is written.
function join(roomId, uid, name, initialState) {
  return Firebase.init().then(function (firebase) {
    const db = firebase.database();
    _uid = uid;
    _playersRef = db.ref("rooms/" + roomId + "/players");
    _playerRef = _playersRef.child(uid);

    const state = Object.assign({ name: String(name || "Player").slice(0, 20) }, initialState || {});
    state.updatedAt = firebase.database.ServerValue.TIMESTAMP;

    // Auto-remove our node if the tab closes or the connection drops.
    _playerRef.onDisconnect().remove();

    return _playerRef.set(state).then(function () {
      cc.log("[RoomSync] joined room=" + roomId + " uid=" + uid);
      _cbAdded = _playersRef.on("child_added", function (snap) {
        if (snap.key === _uid) return;
        cc.log("[RoomSync] child_added uid=" + snap.key);
        _emit("playerJoined", { uid: snap.key, state: snap.val() });
      });
      _cbChanged = _playersRef.on("child_changed", function (snap) {
        if (snap.key === _uid) return;
        _emit("playerUpdate", { uid: snap.key, state: snap.val() });
      });
      _cbRemoved = _playersRef.on("child_removed", function (snap) {
        if (snap.key === _uid) return;
        cc.log("[RoomSync] child_removed uid=" + snap.key);
        _emit("playerLeft", { uid: snap.key });
      });
    }, function (err) {
      // Most commonly seen here: PERMISSION_DENIED because the new "rooms" rule
      // hasn't been deployed to Realtime Database yet.
      cc.error("[RoomSync] write to rooms/" + roomId + "/players/" + uid +
               " failed: " + (err && err.message ? err.message : err));
      throw err;
    });
  });
}

// Pushes a partial state update for our own player node.
function sendState(state) {
  if (!_playerRef || !state) return;
  const payload = {};
  if (typeof state.x === "number") payload.x = state.x;
  if (typeof state.y === "number") payload.y = state.y;
  if (typeof state.facingRight === "boolean") payload.facingRight = state.facingRight;
  if (typeof state.anim === "string") payload.anim = state.anim;
  if (typeof state.state === "string") payload.state = state.state;
  _playerRef.update(payload);
}

// Detaches listeners and removes our node from the room.
function leave() {
  if (_playersRef) {
    if (_cbAdded)   _playersRef.off("child_added", _cbAdded);
    if (_cbChanged) _playersRef.off("child_changed", _cbChanged);
    if (_cbRemoved) _playersRef.off("child_removed", _cbRemoved);
  }
  if (_playerRef) {
    _playerRef.onDisconnect().cancel();
    _playerRef.remove();
  }
  _playersRef = null;
  _playerRef = null;
  _uid = null;
  _cbAdded = null;
  _cbChanged = null;
  _cbRemoved = null;

  // Drop external subscribers too so a scene reload doesn't accumulate them.
  for (const k in _handlers) { _handlers[k] = []; }
}

module.exports = {
  join: join,
  leave: leave,
  sendState: sendState,
  on: on,
  off: off,
};
