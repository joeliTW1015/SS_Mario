const A11y = require("AccessibilitySettings");

const { ccclass } = cc._decorator;

const KEY_UP    = cc.macro.KEY.up;
const KEY_DOWN  = cc.macro.KEY.down;
const KEY_ENTER = cc.macro.KEY.enter;
const KEY_SPACE = cc.macro.KEY.space;
const KEY_SLASH = 191;   // "/" on most layouts

// Keyboard-only menu navigation for StartScene and LevelSelectScene.
//
//   /       → toggle accessibility mode on / off
//   ↑ ↓     → move focus between buttons / input fields
//   Enter   → activate focused button, or begin typing in focused input
//
// Only active when focusable nodes (cc.Button / cc.EditBox) exist in the
// scene. In gameplay scenes (Level1 etc.) the list is empty so ↑↓ pass
// straight through to PlayerController.

@ccclass
export default class FocusManager extends cc.Component {

  private static _inst: FocusManager = null;

  static ensure(): FocusManager {
    if (FocusManager._inst && FocusManager._inst.isValid) {
      return FocusManager._inst;
    }
    var scene = cc.director.getScene();
    if (!scene) { return null; }
    var node = new cc.Node("FocusManager");
    scene.addChild(node);
    try { cc.game.addPersistRootNode(node); } catch (e) { /* ignore */ }
    var comp = node.addComponent(FocusManager);
    FocusManager._inst = comp;
    return comp;
  }

  // ─── state ───────────────────────────────────────────────────────────────────

  private items: cc.Node[] = [];
  private idx: number = -1;
  private active: boolean = false;
  private border: cc.Node = null;
  private hintLabel: cc.Label = null;
  private _docKeyHandler: (e: KeyboardEvent) => void = null;

  private static MSG_OFF = "按 / 開啟無障礙導航 · ↑↓ 上下鍵切換 · Enter 確認";
  private static MSG_ON  = "鍵盤導航模式已啟動 · ↑↓ 上下鍵切換 · Enter 確認";

  // Keys whose browser default (page scroll, history nav) we always block
  // while the game is running.
  private static BLOCK_KEYS: { [k: string]: boolean } = {
    "ArrowUp": true, "ArrowDown": true, "ArrowLeft": true, "ArrowRight": true,
    " ": true,       // Space also scrolls the page
  };

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    this.active = !!A11y.get("a11yModeActive");
    cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKey, this);
    cc.director.on(cc.Director.EVENT_AFTER_SCENE_LAUNCH, this.rescan, this);

    // Document-level handler that solves two problems at once:
    //   1. preventDefault on arrow/space keys so the browser doesn't scroll
    //      the page or navigate history.
    //   2. When DOM focus drifts to <body> (e.g. after an EditBox blur or
    //      the user clicks outside the canvas), pull it back to the canvas
    //      so cc.systemEvent keeps receiving keyboard events.
    //
    // We only block defaults when the active element is NOT an <input> or
    // <textarea> — otherwise normal typing inside an EditBox would break.
    if (cc.sys.isBrowser && typeof document !== "undefined") {
      var self = this;
      this._docKeyHandler = function (e: KeyboardEvent) {
        var tag = "";
        if (document.activeElement) {
          tag = document.activeElement.tagName || "";
        }
        var isTyping = (tag === "INPUT" || tag === "TEXTAREA");

        // If focus is on <body> or <html>, shove it back to the canvas so
        // Cocos receives the event.
        if (!isTyping && cc.game.canvas && typeof cc.game.canvas.focus === "function") {
          cc.game.canvas.focus();
        }

        // Block browser defaults for game keys (but not while typing).
        if (!isTyping && FocusManager.BLOCK_KEYS[e.key]) {
          e.preventDefault();
        }

        // Always block "/" default (Quick Find in Firefox) regardless.
        if (e.key === "/") {
          e.preventDefault();
        }
      };
      document.addEventListener("keydown", this._docKeyHandler, true);
    }

    this.rescan();
  }

  onDestroy() {
    cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKey, this);
    cc.director.off(cc.Director.EVENT_AFTER_SCENE_LAUNCH, this.rescan, this);
    if (this._docKeyHandler && typeof document !== "undefined") {
      document.removeEventListener("keydown", this._docKeyHandler, true);
      this._docKeyHandler = null;
    }
    if (FocusManager._inst === this) { FocusManager._inst = null; }
  }

  // ─── scan scene for focusable nodes ──────────────────────────────────────────

  rescan() {
    this.items = [];
    var scene = cc.director.getScene();
    if (scene) { this.collect(scene as any as cc.Node); }

    // Remove our own nodes from the list.
    var self = this;
    this.items = this.items.filter(function (n) {
      return n !== self.node && n !== self.border;
    });

    // Sort top-to-bottom (Y desc), left-to-right (X asc).
    this.items.sort(function (a, b) {
      var aw = a.convertToWorldSpaceAR(cc.v2(0, 0));
      var bw = b.convertToWorldSpaceAR(cc.v2(0, 0));
      if (Math.abs(aw.y - bw.y) > 4) { return bw.y - aw.y; }
      return aw.x - bw.x;
    });

    this.idx = this.items.length > 0 ? 0 : -1;
    this.showBorder();
    this.findHintLabel();
    this.updateHint();

    if (this.active && this.idx >= 0) {
      this.nativeFocus(this.items[this.idx]);
    }
  }

  private collect(node: cc.Node) {
    if (!node || !node.active) { return; }
    if (node.getComponent(cc.Button) || node.getComponent(cc.EditBox)) {
      this.items.push(node);
    }
    var ch = node.children;
    for (var i = 0; i < ch.length; i++) { this.collect(ch[i]); }
  }

  // ─── keyboard ────────────────────────────────────────────────────────────────

  private onKey(e: cc.Event.EventKeyboard) {
    if (e.keyCode === KEY_SLASH) {
      this.active = !this.active;
      A11y.set("a11yModeActive", this.active);
      cc.log("[A11y] " + (this.active ? "ON (↑↓ + Enter)" : "OFF"));
      if (this.active && this.idx < 0 && this.items.length > 0) {
        this.idx = 0;
      }
      if (!this.active) { this.nativeBlur(); }
      this.showBorder();
      this.updateHint();
      return;
    }

    if (!this.active || this.items.length === 0) { return; }

    if (e.keyCode === KEY_DOWN)  { this.move(1);  return; }
    if (e.keyCode === KEY_UP)    { this.move(-1); return; }
    if (e.keyCode === KEY_ENTER || e.keyCode === KEY_SPACE) {
      this.activate();
      return;
    }
  }

  // ─── focus movement ──────────────────────────────────────────────────────────

  private cur(): cc.Node {
    if (this.idx < 0 || this.idx >= this.items.length) { return null; }
    var n = this.items[this.idx];
    return (n && n.isValid && n.active) ? n : null;
  }

  private move(delta: number) {
    var len = this.items.length;
    if (len === 0) { return; }
    var i = this.idx;
    for (var step = 0; step < len; step++) {
      i = (i + delta + len) % len;
      var n = this.items[i];
      if (n && n.isValid && n.active) {
        this.idx = i;
        this.showBorder();
        this.nativeFocus(n);
        return;
      }
    }
  }

  private activate() {
    var node = this.cur();
    if (!node) { return; }
    var eb = node.getComponent(cc.EditBox);
    if (eb) {
      // setFocus() tells Cocos to enter editing state (show cursor, accept
      // keyboard input). nativeFocus then pushes DOM focus to the underlying
      // <input> so keystrokes actually reach it.
      if (typeof eb.setFocus === "function") {
        eb.setFocus();
      }
      this.nativeFocus(node);
      return;
    }
    var btn = node.getComponent(cc.Button);
    if (btn && btn.interactable) {
      node.emit("click", btn);
    }
  }

  // ─── native HTML focus for EditBox ───────────────────────────────────────────

  private nativeFocus(node: cc.Node) {
    var eb = node.getComponent(cc.EditBox) as any;
    if (!eb) { this.nativeBlur(); return; }
    var impl = eb._impl;
    var input = impl && (impl._edTxt || impl._edFnt);
    if (input && typeof input.focus === "function") {
      try { input.focus(); } catch (e) { /* ignore */ }
    }
  }

  private nativeBlur() {
    if (typeof document === "undefined") { return; }
    var ae = document.activeElement as HTMLElement;
    if (ae && typeof ae.blur === "function") {
      try { ae.blur(); } catch (e) { /* ignore */ }
    }
  }

  // ─── double-border indicator ─────────────────────────────────────────────────

  private ensureBorder(): cc.Node {
    if (this.border && this.border.isValid) { return this.border; }
    this.border = new cc.Node("FocusBorder");
    this.border.addComponent(cc.Graphics);
    return this.border;
  }

  private showBorder() {
    var target = this.cur();
    if (!this.active || !target) {
      if (this.border && this.border.isValid) { this.border.active = false; }
      return;
    }

    var b = this.ensureBorder();
    if (b.parent !== target.parent) {
      b.removeFromParent(false);
      target.parent.addChild(b);
    }
    b.active = true;
    b.x = target.x;
    b.y = target.y;
    b.anchorX = target.anchorX;
    b.anchorY = target.anchorY;
    b.zIndex = (target.zIndex || 0) + 1;

    var pad = 10;
    var w = target.width  + pad;
    var h = target.height + pad;
    var x0 = -w * target.anchorX;
    var y0 = -h * target.anchorY;

    var g = b.getComponent(cc.Graphics);
    g.clear();

    // Outer border — bright yellow, 4 px
    g.strokeColor = cc.Color.YELLOW;
    g.lineWidth = 4;
    g.rect(x0, y0, w, h);
    g.stroke();

    // Inner border — white, 2 px (inset 4 px)
    g.strokeColor = cc.Color.WHITE;
    g.lineWidth = 2;
    g.rect(x0 + 4, y0 + 4, w - 8, h - 8);
    g.stroke();
  }

  // ─── hint label ──────────────────────────────────────────────────────────────

  private findHintLabel() {
    this.hintLabel = null;
    var scene = cc.director.getScene();
    if (!scene) { return; }
    // Search for a node named "A11yHint" anywhere in the scene.
    var node = this.searchByName(scene as any as cc.Node, "A11yHint");
    if (node) {
      var label = node.getComponent(cc.Label);
      if (label) { this.hintLabel = label; }
    }
  }

  private searchByName(root: cc.Node, name: string): cc.Node {
    if (!root) { return null; }
    if (root.name === name) { return root; }
    var ch = root.children;
    for (var i = 0; i < ch.length; i++) {
      var found = this.searchByName(ch[i], name);
      if (found) { return found; }
    }
    return null;
  }

  private updateHint() {
    if (!this.hintLabel || !this.hintLabel.isValid) { return; }
    this.hintLabel.string = this.active ? FocusManager.MSG_ON : FocusManager.MSG_OFF;
  }
}
