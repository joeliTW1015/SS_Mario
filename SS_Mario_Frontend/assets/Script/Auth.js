const Firebase = require("Firebase");

const USERS_PATH = "users";
const MAX_NAME_LEN = 20;
const MIN_PASSWORD_LEN = 6;

function normEmail(email) {
  return String(email == null ? "" : email).trim();
}

// Registers a new user. Resolves with { uid, email, username }.
function register(email, username, password) {
  const mail = normEmail(email);
  const name = String(username == null ? "" : username).trim().slice(0, MAX_NAME_LEN);
  const pass = String(password == null ? "" : password);

  if (!mail) return Promise.reject(new Error("Email is required"));
  if (!name) return Promise.reject(new Error("Username is required"));
  if (pass.length < MIN_PASSWORD_LEN) {
    return Promise.reject(new Error("Password must be at least " + MIN_PASSWORD_LEN + " characters"));
  }

  let _firebase;
  return Firebase.init()
    .then(function (firebase) {
      _firebase = firebase;
      return firebase.auth().createUserWithEmailAndPassword(mail, pass);
    })
    .then(function (cred) {
      const user = cred.user;
      return user.updateProfile({ displayName: name })
        .then(function () {
          return _firebase.database().ref(USERS_PATH + "/" + user.uid).set({
            username: name,
            email: user.email,
            createdAt: _firebase.database.ServerValue.TIMESTAMP,
          });
        })
        .then(function () {
          return { uid: user.uid, email: user.email, username: name };
        });
    });
}

// Signs an existing user in. Resolves with { uid, email, username }.
function login(email, password) {
  return Firebase.init()
    .then(function (firebase) {
      return firebase.auth().signInWithEmailAndPassword(normEmail(email), String(password));
    })
    .then(function (cred) {
      const user = cred.user;
      return { uid: user.uid, email: user.email, username: user.displayName };
    });
}

// Signs the current user out.
function logout() {
  return Firebase.init()
    .then(function (firebase) {
      return firebase.auth().signOut();
    });
}

// Returns the signed-in user as { uid, email, username }, or null if none.
function currentUser() {
  return Firebase.init()
    .then(function (firebase) {
      const user = firebase.auth().currentUser;
      if (!user) return null;
      return { uid: user.uid, email: user.email, username: user.displayName };
    });
}

module.exports = {
  register: register,
  login: login,
  logout: logout,
  currentUser: currentUser,
};
