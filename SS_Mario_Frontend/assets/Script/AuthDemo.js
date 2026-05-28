// Attach to any node in a scene to verify Firebase user registration works.
// Fill in email / username / password in the inspector, then tick `runRegister`
// (or `runLogin`) before entering play mode. Results are logged to the console.

const Auth = require("Auth");

cc.Class({
  extends: cc.Component,

  properties: {
    email: "",
    username: "tester",
    password: "",
    runRegister: false,
    runLogin: false,
  },

  start: function () {
    const self = this;
    (async function () {
      try {
        if (self.runRegister) {
          const user = await Auth.register(self.email, self.username, self.password);
          cc.log("[Auth] registered:", JSON.stringify(user));
        }
        if (self.runLogin) {
          const user = await Auth.login(self.email, self.password);
          cc.log("[Auth] logged in:", JSON.stringify(user));
        }
        const current = await Auth.currentUser();
        cc.log("[Auth] current user:", JSON.stringify(current));
      } catch (e) {
        cc.error("[Auth] error:", (e && e.message) ? e.message : e);
      }
    })();
  },
});
