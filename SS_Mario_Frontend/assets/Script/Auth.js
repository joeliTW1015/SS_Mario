// User auth API for the Mario frontend. Email/password is handled by Firebase
// Authentication (passwords are hashed + stored by Firebase, never written to the
// Realtime Database). The username + email profile is recorded under users/{uid}.
//
// Usage from any Cocos script:
//   const Auth = require("Auth");
//   const user = await Auth.register("a@b.com", "playerName", "secret123");
//   const user = await Auth.login("a@b.com", "secret123");
//   await Auth.logout();

const Firebase = require("Firebase");

const USERS_PATH = "users";
const MAX_NAME_LEN = 20;
const MIN_PASSWORD_LEN = 6; // Firebase Auth enforces this minimum too.

function normEmail(email) {
  return String(email == null ? "" : email).trim();
}

// Registers a new user with email + username + password.
// Resolves with { uid, email, username }.
async function register(email, username, password) {
  const mail = normEmail(email);
  const name = String(username == null ? "" : username).trim().slice(0, MAX_NAME_LEN);
  const pass = String(password == null ? "" : password);

  if (!mail) throw new Error("Email is required");
  if (!name) throw new Error("Username is required");
  if (pass.length < MIN_PASSWORD_LEN) {
    throw new Error("Password must be at least " + MIN_PASSWORD_LEN + " characters");
  }

  const firebase = await Firebase.init();
  const cred = await firebase.auth().createUserWithEmailAndPassword(mail, pass);
  const user = cred.user;

  await user.updateProfile({ displayName: name });
  await firebase.database().ref(USERS_PATH + "/" + user.uid).set({
    username: name,
    email: user.email,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
  });

  return { uid: user.uid, email: user.email, username: name };
}

// Signs an existing user in. Resolves with { uid, email, username }.
async function login(email, password) {
  const firebase = await Firebase.init();
  const cred = await firebase.auth().signInWithEmailAndPassword(normEmail(email), String(password));
  const user = cred.user;
  return { uid: user.uid, email: user.email, username: user.displayName };
}

// Signs the current user out.
async function logout() {
  const firebase = await Firebase.init();
  await firebase.auth().signOut();
}

// Returns the signed-in user as { uid, email, username }, or null if none.
async function currentUser() {
  const firebase = await Firebase.init();
  const user = firebase.auth().currentUser;
  if (!user) return null;
  return { uid: user.uid, email: user.email, username: user.displayName };
}

module.exports = {
  register: register,
  login: login,
  logout: logout,
  currentUser: currentUser,
};
