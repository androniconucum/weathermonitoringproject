// firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('./weatherstation-474f2-firebase-adminsdk-qfjdp-34e17889e5.json'); // You need to download the service account JSON from Firebase Console

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://weatherstation-474f2-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database(); // Reference to Firebase Realtime Database

module.exports = db;
