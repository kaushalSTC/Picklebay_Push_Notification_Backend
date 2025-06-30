const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase Admin if not already initialized
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Optional: Add your database URL if using Realtime Database
  // databaseURL: 'https://your-project-id-default-rtdb.firebaseio.com'
});

module.exports = admin;