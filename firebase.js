// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDJfnQ6vrtcx9aA0thMhWFQKrABtN1JWB8",
  authDomain: "royalbakes-96281.firebaseapp.com",
  projectId: "royalbakes-96281",
  storageBucket: "royalbakes-96281.firebasestorage.app",
  messagingSenderId: "999615919801",
  appId: "1:999615919801:web:d8d3af94bcaab94d5e8d68",
  measurementId: "G-HS02HS12EZ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
const analytics = getAnalytics(app); // Analytics initialized