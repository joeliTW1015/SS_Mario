// Web Audio API wrapper for stereo-positioned audio cues. Coexists with
// cc.audioEngine — one-shots (jump/stomp/coin) stay on cc.audioEngine,
// only the proximity cues that need horizontal pan go through here.
//
// Cocos 2.4's audioEngine has no pan support. The Web Audio API does, and
// is available in every modern browser. Voices are simple sine-wave
// oscillators by default (configurable) so we don't need new audio assets.
//
// Usage:
//   const SA = require("SpatialAudio");
//   const voice = SA.startTone({ freq: 220, pan: -0.3, volume: 0.4 });
//   SA.update(voice, { pan: 0.2, volume: 0.6 });
//   SA.stop(voice);
//
//   SA.setMasterVolume(0.5);   // affects all live voices

const A11y = require("AccessibilitySettings");

let _ctx = null;
let _master = null;
let _voices = {};
let _nextId = 1;
let _resumeBound = false;

function _ensureCtx() {
  if (_ctx) return _ctx;
  const Ctor = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!Ctor) {
    if (typeof cc !== "undefined") cc.warn("[SpatialAudio] Web Audio not supported.");
    return null;
  }
  _ctx = new Ctor();
  _master = _ctx.createGain();
  _master.gain.value = A11y.get("masterVolume");
  _master.connect(_ctx.destination);

  // Autoplay policy: AudioContext starts in "suspended" until a user
  // gesture. Resume on first interaction. Login/click already covers this
  // path, but bind defensively.
  if (_ctx.state === "suspended" && !_resumeBound) {
    _resumeBound = true;
    const resume = function () {
      if (_ctx && _ctx.state === "suspended") _ctx.resume();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("click",    resume, { once: true });
      document.addEventListener("keydown",  resume, { once: true });
      document.addEventListener("touchend", resume, { once: true });
    }
  }

  // Live-update master gain when the user changes the slider.
  A11y.subscribe(function (key, value) {
    if (!_master) return;
    if (key === "masterVolume" || key === null) {
      _master.gain.setTargetAtTime(A11y.get("masterVolume"), _ctx.currentTime, 0.02);
    }
  });

  return _ctx;
}

// Start a continuous tone. Returns a voice id you pass to update/stop.
//   opts.freq     — oscillator frequency in Hz (default 200)
//   opts.type     — oscillator type: "sine"|"triangle"|"square"|"sawtooth" (default "sine")
//   opts.pan      — -1 (full left) .. +1 (full right)  (default 0)
//   opts.volume   — 0..1 (default 0.2). Multiplied by masterVolume.
//   opts.attack   — fade-in seconds (default 0.05)
function startTone(opts) {
  const ctx = _ensureCtx();
  if (!ctx) return null;

  opts = opts || {};
  const freq    = typeof opts.freq    === "number" ? opts.freq    : 200;
  const type    = opts.type           || "sine";
  const pan     = typeof opts.pan     === "number" ? opts.pan     : 0;
  const volume  = typeof opts.volume  === "number" ? opts.volume  : 0.2;
  const attack  = typeof opts.attack  === "number" ? opts.attack  : 0.05;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;

  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(volume, ctx.currentTime, attack);

  let panner = null;
  if (typeof ctx.createStereoPanner === "function") {
    panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    osc.connect(gain).connect(panner).connect(_master);
  } else {
    // Safari < 14.1 lacks StereoPannerNode; fall back to mono.
    osc.connect(gain).connect(_master);
  }

  osc.start();
  const id = _nextId++;
  _voices[id] = { osc: osc, gain: gain, panner: panner };
  return id;
}

// Live-tweak a running voice. Any field omitted is left alone.
//   opts.pan, opts.volume, opts.freq
function update(voiceId, opts) {
  const v = _voices[voiceId];
  if (!v || !_ctx) return;
  opts = opts || {};
  const now = _ctx.currentTime;
  if (typeof opts.volume === "number") {
    v.gain.gain.setTargetAtTime(Math.max(0, opts.volume), now, 0.04);
  }
  if (typeof opts.pan === "number" && v.panner) {
    v.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, opts.pan)), now, 0.04);
  }
  if (typeof opts.freq === "number") {
    v.osc.frequency.setTargetAtTime(opts.freq, now, 0.05);
  }
}

// Fade out and dispose a voice.
function stop(voiceId, fadeSec) {
  const v = _voices[voiceId];
  if (!v || !_ctx) return;
  const fade = typeof fadeSec === "number" ? fadeSec : 0.05;
  const now = _ctx.currentTime;
  v.gain.gain.setTargetAtTime(0, now, fade);
  // Stop oscillator after fade completes.
  try { v.osc.stop(now + fade + 0.1); } catch (e) {}
  delete _voices[voiceId];
}

function stopAll() {
  for (const id in _voices) stop(Number(id));
}

function setMasterVolume(v) {
  A11y.set("masterVolume", Math.max(0, Math.min(1, v)));
}

module.exports = {
  startTone:       startTone,
  update:          update,
  stop:            stop,
  stopAll:         stopAll,
  setMasterVolume: setMasterVolume,
};
