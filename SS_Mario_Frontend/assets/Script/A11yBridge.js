// Screen-reader bridge for Cocos canvas UI.
//
// Cocos draws all its UI to a single <canvas>, which screen readers can't
// see. To bridge the gap, we create a transparent native <button> element
// over each cc.Button. The browser handles Tab order, focus, Enter/Space
// activation, ARIA announcements — everything — natively. We forward the
// click back into Cocos by emitting on the original cc.Button.
//
// cc.EditBox is already a real <input>, so it works with native Tab order
// out of the box and doesn't need a bridge.
//
// API: A11yBridge.init() is idempotent; safe to call from every scene
// manager. Rescans on cc.Director.EVENT_AFTER_SCENE_LAUNCH and repositions
// DOM mirrors every animation frame so they track button positions.

const CONTAINER_ID = "ss-mario-a11y-bridge";
let _initialized = false;
let _container = null;
let _bridges = [];          // { ccNode, domEl }
let _rafHandle = 0;

const _focusListeners = []; // { handler(ccNode) }

function _ensureContainer() {
  if (_container && document.body.contains(_container)) { return _container; }
  if (!document.body) { return null; }
  _container = document.createElement("div");
  _container.id = CONTAINER_ID;
  // pointer-events:none on the container so empty areas don't eat clicks;
  // each child <button> sets pointer-events:auto on itself.
  _container.style.cssText =
    "position:fixed;left:0;top:0;width:100%;height:100%;" +
    "pointer-events:none;z-index:9000;";
  document.body.appendChild(_container);
  return _container;
}

function _accessibleLabel(ccNode) {
  // Prefer a cc.Label on a direct child (typical Button structure).
  const ch = ccNode.children;
  for (let i = 0; i < ch.length; i++) {
    const lbl = ch[i].getComponent(cc.Label);
    if (lbl && lbl.string && lbl.string.trim()) { return lbl.string.trim(); }
  }
  // Fallback to component-in-children if not found at depth 1.
  if (ccNode.getComponentInChildren) {
    const lbl = ccNode.getComponentInChildren(cc.Label);
    if (lbl && lbl.string && lbl.string.trim()) { return lbl.string.trim(); }
  }
  return ccNode.name || "Button";
}

function _emitFocus(ccNode) {
  for (let i = 0; i < _focusListeners.length; i++) {
    try { _focusListeners[i](ccNode); }
    catch (e) { cc.error("[A11yBridge] focus listener error:", e); }
  }
}

function _makeBridge(ccNode) {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", _accessibleLabel(ccNode));
  el.dataset.bridge = "1";
  // Transparent visually but still announced by screen readers and
  // focusable by keyboard. outline:none — focus ring is drawn on the
  // Cocos side by FocusManager so it matches game style.
  el.style.cssText =
    "position:absolute;background:transparent;border:0;padding:0;" +
    "color:transparent;font:inherit;cursor:pointer;" +
    "pointer-events:auto;outline:none;" +
    "opacity:0.001;";   // not zero — some screen readers skip 0-opacity

  el.addEventListener("click", function (ev) {
    ev.preventDefault();
    if (!ccNode.isValid) { return; }
    const btn = ccNode.getComponent(cc.Button);
    if (!btn || btn.interactable === false) { return; }
    ccNode.emit("click", btn);
  });
  el.addEventListener("focus", function () {
    if (ccNode.isValid) { _emitFocus(ccNode); }
  });
  el.addEventListener("blur", function () {
    // Defer one tick — the next focus is typically already in flight,
    // and emitting null in between causes the indicator to blink.
    setTimeout(function () {
      const ae = document.activeElement;
      if (ae && ae.dataset && ae.dataset.bridge) { return; }
      _emitFocus(null);
    }, 0);
  });
  return el;
}

function _rectFor(ccNode) {
  if (!ccNode || !ccNode.isValid || !ccNode.activeInHierarchy) { return null; }
  const canvas = cc.game.canvas;
  if (!canvas) { return null; }
  const cssRect = canvas.getBoundingClientRect();
  if (cssRect.width === 0 || cssRect.height === 0) { return null; }
  const design = cc.view.getDesignResolutionSize();
  // Visible viewport in design coords (visible after policy applied).
  const sx = cssRect.width  / design.width;
  const sy = cssRect.height / design.height;
  const wb = ccNode.getBoundingBoxToWorld();
  return {
    left:   cssRect.left + wb.x * sx,
    top:    cssRect.top  + (design.height - wb.y - wb.height) * sy,
    width:  wb.width  * sx,
    height: wb.height * sy,
  };
}

function _clearBridges() {
  for (let i = 0; i < _bridges.length; i++) {
    const el = _bridges[i].domEl;
    if (el && el.parentNode) { el.parentNode.removeChild(el); }
  }
  _bridges = [];
}

function _scan() {
  _clearBridges();
  const scene = cc.director.getScene();
  if (!scene) { return; }
  _ensureContainer();
  _collect(scene);
}

function _collect(node) {
  if (!node) { return; }
  if (node.getComponent && node.getComponent(cc.Button)) {
    const el = _makeBridge(node);
    if (_container) { _container.appendChild(el); }
    _bridges.push({ ccNode: node, domEl: el });
  }
  const ch = node.children;
  if (!ch) { return; }
  for (let i = 0; i < ch.length; i++) { _collect(ch[i]); }
}

function _tick() {
  for (let i = 0; i < _bridges.length; i++) {
    const b = _bridges[i];
    if (!b.ccNode || !b.ccNode.isValid) {
      b.domEl.style.display = "none";
      continue;
    }
    if (!b.ccNode.activeInHierarchy) {
      // Hide AND remove from tab order while the Cocos node is invisible
      // (e.g. game-over panel hidden).
      b.domEl.style.display = "none";
      b.domEl.setAttribute("tabindex", "-1");
      continue;
    }
    const r = _rectFor(b.ccNode);
    if (!r) { b.domEl.style.display = "none"; continue; }
    b.domEl.style.display = "block";
    b.domEl.removeAttribute("tabindex");
    b.domEl.style.left   = r.left   + "px";
    b.domEl.style.top    = r.top    + "px";
    b.domEl.style.width  = r.width  + "px";
    b.domEl.style.height = r.height + "px";
    // Disabled state mirror — also drops the bridge out of tab order.
    const btn = b.ccNode.getComponent(cc.Button);
    if (btn && btn.interactable === false) {
      b.domEl.setAttribute("aria-disabled", "true");
      b.domEl.setAttribute("tabindex", "-1");
    } else {
      b.domEl.removeAttribute("aria-disabled");
    }
  }
  _rafHandle = requestAnimationFrame(_tick);
}

function init() {
  if (_initialized) { return; }
  if (typeof document === "undefined" || typeof cc === "undefined" || !cc.director) { return; }
  _initialized = true;
  _ensureContainer();
  cc.director.on(cc.Director.EVENT_AFTER_SCENE_LAUNCH, _scan);
  _scan();
  _rafHandle = requestAnimationFrame(_tick);
}

function refresh() { _scan(); }

function onFocusChange(handler) {
  _focusListeners.push(handler);
  return function unsubscribe() {
    const i = _focusListeners.indexOf(handler);
    if (i >= 0) _focusListeners.splice(i, 1);
  };
}

function focusedCcNode() {
  if (typeof document === "undefined") { return null; }
  const ae = document.activeElement;
  if (!ae) { return null; }
  for (let i = 0; i < _bridges.length; i++) {
    if (_bridges[i].domEl === ae) { return _bridges[i].ccNode; }
  }
  return null;
}

module.exports = {
  init:           init,
  refresh:        refresh,
  onFocusChange:  onFocusChange,
  focusedCcNode:  focusedCcNode,
};
