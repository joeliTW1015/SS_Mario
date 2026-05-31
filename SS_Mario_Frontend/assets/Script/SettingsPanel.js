// Accessibility settings UI built as a real HTML overlay rather than a
// Cocos canvas panel. Reasoning: Cocos draws all its UI to canvas, which
// is invisible to screen readers. A native <form> with <input> / <label>
// elements is keyboard-navigable and ARIA-friendly out of the box —
// exactly the audience this panel exists for.
//
// Toggle with Esc. Idempotent init() — safe to call from every scene
// manager's onLoad.

const A11y = require("AccessibilitySettings");

const OVERLAY_ID = "ss-mario-a11y-overlay";
let _initialized = false;

function _styleSetup() {
  if (document.getElementById("ss-mario-a11y-style")) { return; }
  const style = document.createElement("style");
  style.id = "ss-mario-a11y-style";
  style.textContent = [
    "#" + OVERLAY_ID + " {",
    "  position: fixed; inset: 0; background: rgba(0,0,0,0.6);",
    "  display: flex; align-items: center; justify-content: center;",
    "  z-index: 99999; font-family: system-ui, -apple-system, sans-serif;",
    "}",
    "#" + OVERLAY_ID + " .panel {",
    "  background: #1d1f24; color: #f4f4f4; min-width: 360px; max-width: 92vw;",
    "  border-radius: 12px; padding: 20px 22px; box-shadow: 0 10px 40px #000a;",
    "}",
    "#" + OVERLAY_ID + " h2 { margin: 0 0 14px; font-size: 18px; }",
    "#" + OVERLAY_ID + " .row {",
    "  display: flex; align-items: center; justify-content: space-between;",
    "  margin: 12px 0; gap: 12px;",
    "}",
    "#" + OVERLAY_ID + " label { flex: 1; cursor: pointer; }",
    "#" + OVERLAY_ID + " input[type=range] { width: 160px; }",
    "#" + OVERLAY_ID + " .actions {",
    "  display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;",
    "}",
    "#" + OVERLAY_ID + " button {",
    "  background: #3a82f7; color: white; border: 0; border-radius: 6px;",
    "  padding: 8px 14px; font-size: 14px; cursor: pointer;",
    "}",
    "#" + OVERLAY_ID + " button.secondary { background: #444; }",
    "#" + OVERLAY_ID + " button:focus, #" + OVERLAY_ID + " input:focus {",
    "  outline: 3px solid #ffd400; outline-offset: 2px;",
    "}",
    "#" + OVERLAY_ID + " .hint { color: #999; font-size: 12px; margin-top: 14px; }",
  ].join("\n");
  document.head.appendChild(style);
}

function isOpen() {
  return !!document.getElementById(OVERLAY_ID);
}

function open() {
  if (typeof document === "undefined") { return; }
  if (isOpen()) { return; }
  _styleSetup();

  const cur = A11y.getAll();

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Accessibility settings");

  overlay.innerHTML = [
    '<div class="panel">',
    '  <h2>Accessibility settings</h2>',
    '  <div class="row">',
    '    <label for="a11y-master">Master volume</label>',
    '    <input type="range" id="a11y-master" min="0" max="1" step="0.05" value="' + cur.masterVolume + '">',
    '  </div>',
    '  <div class="row">',
    '    <label for="a11y-cues">Enemy proximity audio cues</label>',
    '    <input type="checkbox" id="a11y-cues"' + (cur.audioCuesEnabled ? " checked" : "") + '>',
    '  </div>',
    '  <div class="row">',
    '    <label for="a11y-cuevol">Cue volume</label>',
    '    <input type="range" id="a11y-cuevol" min="0" max="1" step="0.05" value="' + cur.audioCueVolume + '">',
    '  </div>',
    '  <div class="row">',
    '    <label for="a11y-flash">Reduced flashing</label>',
    '    <input type="checkbox" id="a11y-flash"' + (cur.reducedFlashing ? " checked" : "") + '>',
    '  </div>',
    '  <div class="row">',
    '    <label for="a11y-focus">Show keyboard focus border</label>',
    '    <input type="checkbox" id="a11y-focus"' + (cur.showFocusIndicator ? " checked" : "") + '>',
    '  </div>',
    '  <div class="actions">',
    '    <button type="button" class="secondary" id="a11y-reset">Reset</button>',
    '    <button type="button" id="a11y-close">Close</button>',
    '  </div>',
    '  <div class="hint">Press Esc to close. Tab to navigate.</div>',
    '</div>',
  ].join("");

  document.body.appendChild(overlay);

  const bind = (id, key, kind) => {
    const el = document.getElementById(id);
    if (!el) { return; }
    el.addEventListener("input", () => {
      const v = kind === "checkbox" ? el.checked : Number(el.value);
      A11y.set(key, v);
    });
  };
  bind("a11y-master", "masterVolume",       "range");
  bind("a11y-cues",   "audioCuesEnabled",   "checkbox");
  bind("a11y-cuevol", "audioCueVolume",     "range");
  bind("a11y-flash",  "reducedFlashing",    "checkbox");
  bind("a11y-focus",  "showFocusIndicator", "checkbox");

  const closeBtn = document.getElementById("a11y-close");
  if (closeBtn) { closeBtn.addEventListener("click", close); }
  const resetBtn = document.getElementById("a11y-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      A11y.reset();
      close();
      open();
    });
  }

  // Focus the first control so the user can Tab around immediately.
  const first = overlay.querySelector("input, button");
  if (first && first.focus) { first.focus(); }
}

function close() {
  const el = document.getElementById(OVERLAY_ID);
  if (el && el.parentNode) { el.parentNode.removeChild(el); }
}

function toggle() {
  if (isOpen()) { close(); } else { open(); }
}

// Single global Esc binding. Bound on document so it works regardless of
// which Cocos scene is active.
function init() {
  if (_initialized || typeof document === "undefined") { return; }
  _initialized = true;
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" || e.keyCode === 27) {
      toggle();
      // Don't preventDefault — leave Cocos systemEvent free to react too.
    }
  });
}

module.exports = {
  init:    init,
  open:    open,
  close:   close,
  toggle:  toggle,
  isOpen:  isOpen,
};
