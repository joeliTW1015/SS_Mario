const Auth = require("Auth");
const FocusManager = require("FocusManager");
const SettingsPanel = require("SettingsPanel");

const { ccclass, property } = cc._decorator;

@ccclass
export default class StartSceneManager extends cc.Component {

  @property(cc.EditBox)  emailInput:    cc.EditBox  = null;
  @property(cc.EditBox)  usernameInput: cc.EditBox  = null;
  @property(cc.EditBox)  passwordInput: cc.EditBox  = null;
  @property(cc.Button)   loginButton:   cc.Button   = null;
  @property(cc.Button)   signUpButton:  cc.Button   = null;
  @property(cc.Label)    messageLabel:  cc.Label    = null;

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad () {
    this.autoFindNodes();
    this.wireButtons();
    this.checkAutoLogin();

    // Accessibility: keyboard nav + Esc settings overlay should work as
    // early as the login screen.
    FocusManager.ensure();
    SettingsPanel.init();
  }

  // ─── init ────────────────────────────────────────────────────────────────────

  private autoFindNodes () {
    const c = this.node;

    if (!this.emailInput) {
      const n = cc.find("EmailInputField", c);
      if (n) this.emailInput = n.getComponent(cc.EditBox);
    }
    if (!this.usernameInput) {
      const n = cc.find("UserNameInputField", c);
      if (n) this.usernameInput = n.getComponent(cc.EditBox);
    }
    if (!this.passwordInput) {
      const n = cc.find("PasswordInputField", c);
      if (n) this.passwordInput = n.getComponent(cc.EditBox);
    }
    if (!this.loginButton) {
      const n = cc.find("LoginButton", c);
      if (n) this.loginButton = n.getComponent(cc.Button);
    }
    if (!this.signUpButton) {
      const n = cc.find("SignUpButton", c);
      if (n) this.signUpButton = n.getComponent(cc.Button);
    }
    // 紅色訊息 Label：靠顏色 r=255, g=80 識別
    if (!this.messageLabel) {
      const children = this.node.children;
      for (let i = 0; i < children.length; i++) {
        const label = children[i].getComponent(cc.Label);
        if (label && children[i].color.r === 255 && children[i].color.g === 80) {
          this.messageLabel = label;
          break;
        }
      }
    }

    if (!this.emailInput)    cc.warn("[StartSceneManager] EmailInputField not found");
    if (!this.passwordInput) cc.warn("[StartSceneManager] PasswordInputField not found");
    if (!this.loginButton)   cc.warn("[StartSceneManager] LoginButton not found");
    if (!this.signUpButton)  cc.warn("[StartSceneManager] SignUpButton not found");
    if (!this.messageLabel)  cc.warn("[StartSceneManager] messageLabel not found");

    // 修正 maxLength：scene 裡預設值太短
    if (this.emailInput)    this.emailInput.maxLength    = 100;
    if (this.usernameInput) this.usernameInput.maxLength = 20;
    if (this.passwordInput) this.passwordInput.maxLength = 50;
  }

  private wireButtons () {
    if (this.loginButton)  this.loginButton.node.on("click",  this.onLoginClick,  this);
    if (this.signUpButton) this.signUpButton.node.on("click", this.onSignUpClick, this);

    // 在 Password 欄位按 Enter → 觸發登入
    if (this.passwordInput) {
      this.passwordInput.node.on("editing-return", this.onLoginClick, this);
    }
    // 在 Username 欄位按 Enter → 觸發註冊
    if (this.usernameInput) {
      this.usernameInput.node.on("editing-return", this.onSignUpClick, this);
    }
  }

  private checkAutoLogin () {
    const self = this;
    this.scheduleOnce(function () {
      Auth.currentUser().then(function (user) {
        if (user) {
          self.setMessage("Welcome back, " + (user.username || user.email) + "!", false);
          self.scheduleOnce(function () {
            cc.director.loadScene("LevelSelectScene");
          }, 0.6);
        } else {
          self.setMessage("Please sign up or log in", true);
        }
      }).catch(function () {
        // Firebase not ready yet
      });
    }, 0.3);
  }

  // ─── button handlers ─────────────────────────────────────────────────────────

  onLoginClick () {
    const email    = this.emailInput    ? this.emailInput.string.trim() : "";
    const password = this.passwordInput ? this.passwordInput.string     : "";

    const err = this.validateLogin(email, password);
    if (err) { this.setMessage(err, true); return; }

    this.setLoading(true);
    this.setMessage("Logging in...", false);

    const self = this;
    Auth.login(email, password)
      .then(function (user) {
        self.setLoading(false);
        self.setMessage("Welcome, " + (user.username || user.email) + "!", false);
        self.scheduleOnce(function () {
          cc.director.loadScene("LevelSelectScene");
        }, 0.8);
      })
      .catch(function (e) {
        self.setLoading(false);
        self.setMessage(self.friendlyError(e), true);
      });
  }

  onSignUpClick () {
    const email    = this.emailInput    ? this.emailInput.string.trim()    : "";
    const username = this.usernameInput ? this.usernameInput.string.trim() : "";
    const password = this.passwordInput ? this.passwordInput.string        : "";

    const err = this.validateRegister(email, username, password);
    if (err) { this.setMessage(err, true); return; }

    this.setLoading(true);
    this.setMessage("Creating account...", false);

    const self = this;
    Auth.register(email, username, password)
      .then(function (user) {
        self.setLoading(false);
        self.setMessage("Account created! Welcome, " + user.username + "!", false);
        self.scheduleOnce(function () {
          cc.director.loadScene("LevelSelectScene");
        }, 0.8);
      })
      .catch(function (e) {
        self.setLoading(false);
        self.setMessage(self.friendlyError(e), true);
      });
  }

  // ─── validation ──────────────────────────────────────────────────────────────

  private validateLogin (email: string, password: string): string | null {
    if (!email)                    return "Email is required.";
    if (!this.isValidEmail(email)) return "Invalid email format.";
    if (!password)                 return "Password is required.";
    return null;
  }

  private validateRegister (email: string, username: string, password: string): string | null {
    if (!email)                    return "Email is required.";
    if (!this.isValidEmail(email)) return "Invalid email format.";
    if (!username)                 return "Username is required.";
    if (username.length < 2)       return "Username must be at least 2 characters.";
    if (username.length > 20)      return "Username cannot exceed 20 characters.";
    if (!password)                 return "Password is required.";
    if (password.length < 6)       return "Password must be at least 6 characters.";
    return null;
  }

  private isValidEmail (email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ─── UI helpers ──────────────────────────────────────────────────────────────

  private setMessage (msg: string, isError: boolean) {
    if (!this.messageLabel) return;
    this.messageLabel.string = msg;
    this.messageLabel.node.color = isError
      ? new cc.Color(255, 80,  80,  255)
      : new cc.Color(80,  200, 100, 255);
  }

  private setLoading (loading: boolean) {
    if (this.loginButton)  this.loginButton.interactable  = !loading;
    if (this.signUpButton) this.signUpButton.interactable = !loading;
    if (loading && this.messageLabel) {
      this.messageLabel.node.color = new cc.Color(180, 180, 180, 255);
    }
  }

  // ─── Firebase error → friendly message ───────────────────────────────────────

  private friendlyError (err: any): string {
    const map: { [key: string]: string } = {
      "auth/email-already-in-use":   "This email is already registered.",
      "auth/invalid-email":          "Invalid email address.",
      "auth/user-not-found":         "No account found with this email.",
      "auth/wrong-password":         "Incorrect password.",
      "auth/invalid-credential":     "Incorrect email or password.",
      "auth/weak-password":          "Password is too weak (min 6 characters).",
      "auth/too-many-requests":      "Too many attempts. Please try again later.",
      "auth/network-request-failed": "Network error. Check your connection.",
      "auth/user-disabled":          "This account has been disabled.",
    };
    const code: string = err && err.code ? err.code : "";
    if (map[code]) return map[code];
    return (err && err.message) ? err.message : "An error occurred. Please try again.";
  }
}
