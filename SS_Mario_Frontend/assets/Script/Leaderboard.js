// Player leaderboard client for the Mario frontend (Cocos Creator 2.4.8).
// Talks to the SS_Mario_Backend leaderboard REST API over HTTP using
// XMLHttpRequest + Promises (no async/await, no SDK), so it runs the same on
// web and native.
//
// Each entry: { username, level, score, timestamp } (timestamp = Unix epoch ms).
//
// Usage from any Cocos script:
//   const Leaderboard = require("Leaderboard");
//   Leaderboard.setBaseUrl("http://localhost:3000");                 // optional
//   Leaderboard.getLeaderboard().then(function (list) { ... });      // array of objects
//   Leaderboard.getLeaderboardJSON().then(function (json) { ... });  // JSON string
//   Leaderboard.submitEntry("Mario", 8, 15200).then(function (entry) { ... });

// Base URL of the SS_Mario_Backend server. Same value you pass to
// Multiplayer.connect(). Change to your deployed host for production.
let BASE_URL = "http://localhost:3000";

// API key required by the backend for POST /leaderboard. Must match MARIO_API_KEY
// on the server. (A client-embedded key is not a true secret, but it's the
// standard approach for a game client and gates casual writes.)
const API_KEY = "ss-mario-dev-key-2026";

const MAX_NAME_LEN = 20;

function endpoint() { return BASE_URL.replace(/\/+$/, "") + "/leaderboard"; }

// Point the client at a different backend host at runtime.
function setBaseUrl(url) { BASE_URL = url; }

// HTTP helper — method is the explicit request verb ("GET" | "POST").
// Resolves with the parsed JSON response.
function request(method, url, body, headers) {
  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (headers) {
      Object.keys(headers).forEach(function (h) { xhr.setRequestHeader(h, headers[h]); });
    }
    xhr.timeout = 10000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : null);
        } catch (e) {
          reject(new Error("Bad JSON from " + url));
        }
      } else {
        reject(new Error(method + " " + url + " -> HTTP " + xhr.status + " " + xhr.responseText));
      }
    };
    xhr.ontimeout = function () { reject(new Error(method + " " + url + " timed out")); };
    xhr.onerror = function () { reject(new Error("Network error on " + method + " " + url)); };
    xhr.send(body ? JSON.stringify(body) : null);
  });
}

// GET the leaderboard. Resolves with an array of
// { username, level, score, timestamp }, highest score first (server-sorted).
// Method: GET <BASE_URL>/leaderboard
function getLeaderboard() {
  return request("GET", endpoint()).then(function (data) {
    return Array.isArray(data) ? data : [];
  });
}

// Same as getLeaderboard() but resolves with a JSON string of all fields.
function getLeaderboardJSON() {
  return getLeaderboard().then(function (list) { return JSON.stringify(list); });
}

// POST a new entry. The server stamps the timestamp. Resolves with the created
// entry { username, level, score, timestamp }.
// Method: POST <BASE_URL>/leaderboard  (header x-api-key)
function submitEntry(username, level, score) {
  const body = {
    username: String(username == null ? "anonymous" : username).slice(0, MAX_NAME_LEN),
    level: Number(level) || 0,
    score: Number(score) || 0,
  };
  return request("POST", endpoint(), body, { "x-api-key": API_KEY });
}

module.exports = {
  getLeaderboard: getLeaderboard,
  getLeaderboardJSON: getLeaderboardJSON,
  submitEntry: submitEntry,
  setBaseUrl: setBaseUrl,
};
