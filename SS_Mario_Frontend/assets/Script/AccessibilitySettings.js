// Single source of truth for accessibility-related preferences.
// Persisted in localStorage; UI lives in SettingsPanel.js, consumers
// (SpatialAudio, AudioCueManager, FocusManager, PlayerController) read
// via get() and react via subscribe().

const STORAGE_KEY = "ss_mario_a11y_settings_v1";

const DEFAULTS = {
  masterVolume:       1.0,    // 0..1 — applies to spatial cues; cc.audioEngine handles its own
  audioCuesEnabled:   true,   // enemy proximity cues
  audioCueVolume:     0.5,    // 0..1 — peak gain of the synth tone
  audioCueRange:      400,    // px — distance at which volume drops to 0
  reducedFlashing:    false,  // dim opacity instead of 10Hz strobe on shrink
  showFocusIndicator: true,   // yellow border on focused button/input
};

let _settings = null;
const _subs = [];

function _load() {
  if (_settings) return _settings;
  let stored = null;
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    }
  } catch (e) {
    if (typeof cc !== "undefined") cc.warn("[A11y] settings load failed:", e);
  }
  _settings = Object.assign({}, DEFAULTS, stored || {});
  return _settings;
}

function _save() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
    }
  } catch (e) {
    if (typeof cc !== "undefined") cc.warn("[A11y] settings save failed:", e);
  }
}

function get(key) {
  return _load()[key];
}

function getAll() {
  return Object.assign({}, _load());
}

function set(key, value) {
  const s = _load();
  if (s[key] === value) return;
  s[key] = value;
  _save();
  for (let i = 0; i < _subs.length; i++) {
    try { _subs[i](key, value, s); }
    catch (e) { if (typeof cc !== "undefined") cc.error("[A11y] sub error:", e); }
  }
}

function reset() {
  _settings = Object.assign({}, DEFAULTS);
  _save();
  for (let i = 0; i < _subs.length; i++) {
    try { _subs[i](null, null, _settings); }
    catch (e) { if (typeof cc !== "undefined") cc.error("[A11y] sub error:", e); }
  }
}

function subscribe(handler) {
  _subs.push(handler);
  return function unsubscribe() {
    const i = _subs.indexOf(handler);
    if (i >= 0) _subs.splice(i, 1);
  };
}

module.exports = {
  DEFAULTS: DEFAULTS,
  get: get,
  getAll: getAll,
  set: set,
  reset: reset,
  subscribe: subscribe,
};
