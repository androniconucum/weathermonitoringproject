// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCaJXwzCGoqpJKgSv4TDxh0-CauoWj13Yc",
  authDomain: "weatherstation-474f2.firebaseapp.com",
  databaseURL: "https://weatherstation-474f2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "weatherstation-474f2",
  storageBucket: "weatherstation-474f2.firebasestorage.app",
  messagingSenderId: "315579475162",
  appId: "1:315579475162:web:73d7181416428c9c96f1e3",
  measurementId: "G-SQ61MJC5PG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);