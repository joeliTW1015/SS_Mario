// Persists the single accessibility preference (keyboard navigation mode)
// in localStorage so it survives page reloads.

var STORAGE_KEY = "ss_mario_a11y_v1";
var DEFAULTS = { a11yModeActive: false };

var _settings = null;

function _load() {
  if (_settings) return _settings;
  var stored = null;
  try {
    if (typeof localStorage !== "undefined") {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    }
  } catch (e) { /* ignore */ }
  _settings = {};
  for (var k in DEFAULTS) { _settings[k] = DEFAULTS[k]; }
  if (stored) { for (var k2 in stored) { if (DEFAULTS.hasOwnProperty(k2)) _settings[k2] = stored[k2]; } }
  return _settings;
}

function _save() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
    }
  } catch (e) { /* ignore */ }
}

function get(key) { return _load()[key]; }

function set(key, value) {
  var s = _load();
  if (s[key] === value) return;
  s[key] = value;
  _save();
}

module.exports = { get: get, set: set };
