// Bypasses the fact that cc.audioEngine and Web Audio are two independent
// volume chains. SpatialAudio handles its own master via the GainNode it
// already owns. This module makes sure the user's "Master volume" slider
// in SettingsPanel ALSO routes through cc.audioEngine so BGM + classic
// SFX (jump / stomp / coin) respond to the same control.

const A11y = require("AccessibilitySettings");

let _initialized = false;

function apply() {
  if (typeof cc === "undefined" || !cc.audioEngine) { return; }
  const v = A11y.get("masterVolume");
  if (cc.audioEngine.setMusicVolume)   { cc.audioEngine.setMusicVolume(v); }
  if (cc.audioEngine.setEffectsVolume) { cc.audioEngine.setEffectsVolume(v); }
}

function init() {
  if (_initialized) { return; }
  _initialized = true;
  A11y.subscribe(function (key) {
    if (key === "masterVolume" || key === null) { apply(); }
  });
  apply();   // sync once on init in case user changed it before this scene loaded
}

module.exports = { init: init, apply: apply };
