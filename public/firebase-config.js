// ════════════════════════════════════════════════
// AURA – Firebase Configuration  |  firebase-config.js
// Centralized Firebase initialization for all pages
// ════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyB24BlPsRhtR3Xv__mWa7nKexRxwHJwxUI",
  authDomain: "aura-shop-41121.firebaseapp.com",
  projectId: "aura-shop-41121",
  storageBucket: "aura-shop-41121.firebasestorage.app",
  messagingSenderId: "56730161240",
  appId: "1:56730161240:web:2412153c2c789c31b6fa2d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);