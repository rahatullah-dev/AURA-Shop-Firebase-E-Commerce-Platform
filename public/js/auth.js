// ════════════════════════════════════════════════
// AURA – Auth Service  |  js/auth.js
// Centralized authentication utilities for all pages
// ════════════════════════════════════════════════

import { auth, db } from "../firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Re-export for pages that import { auth, db } from auth.js
export { auth, db };

// ── SIGN UP ────────────────────────────────────
export async function signUp(email, password, displayName) {
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCred.user, { displayName });
  await createUserDoc(userCred.user, displayName);
  return userCred.user;
}

// ── SIGN IN ────────────────────────────────────
export async function signIn(email, password) {
  const userCred = await signInWithEmailAndPassword(auth, email, password);
  return userCred.user;
}

// ── GOOGLE AUTH ────────────────────────────────
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  // Only create user doc if it doesn't exist yet (prevents overwriting on re-login)
  const userDocRef = doc(db, "users", cred.user.uid);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) {
    await createUserDoc(cred.user, cred.user.displayName);
  }
  return cred.user;
}

// ── PASSWORD RESET ─────────────────────────────
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ── ACCOUNT SETTINGS ───────────────────────────
export async function changeUserPassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error('NOT_LOGGED_IN');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export async function deleteUserAccount(currentPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error('NOT_LOGGED_IN');
  // Re-authenticate
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  // Delete doc in firestore
  await deleteDoc(doc(db, "users", user.uid));
  // Delete auth user
  await deleteUser(user);
}

// ── LOGOUT ─────────────────────────────────────
export async function logout(redirectUrl = 'auth/login.html') {
  await signOut(auth);
  // Clear any localStorage auth artifacts
  localStorage.removeItem('aura_user');
  
  if (redirectUrl === 'auth/login.html' && window.location.pathname.includes('/admin/')) {
    redirectUrl = '../auth/login.html';
  }
  
  window.location.href = redirectUrl;
}

// ── AUTH GUARD ──────────────────────────────────
// Returns a promise that resolves with the current user (or null)
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// Redirects unauthenticated users to login
export async function requireAuth(redirectUrl = "/auth/login.html") {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = redirectUrl;
    return null;
  }
  return user;
}

/**
 * Retrieves the role of the currently signed‑in user.
 * Returns "admin", "user", or null if not logged in.
 * Normalizes the role string (trim + lower‑case) to match the guard logic.
 */
export async function getCurrentUserRole() {
  const user = await getCurrentUser();
  if (!user) return null;
  const snap = await getDoc(doc(db, "users", user.uid));
  const raw = snap?.data()?.role ?? 'user';
  return raw.toString().trim().toLowerCase();
}

// ── USER PROFILE (Firestore) ───────────────────
async function createUserDoc(user, name) {
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    name: name || user.displayName || "",
    email: user.email,
    photoURL: user.photoURL || "",
    role: "user",
    phone: "",
    address: "",
    city: "",
    createdAt: serverTimestamp(),
    wishlist: [],
    addresses: []
  });
}

export async function getUserProfile(uid) {
  const docSnap = await getDoc(doc(db, "users", uid));
  if (docSnap.exists()) return docSnap.data();
  return null;
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
}

// ── FRIENDLY ERROR MESSAGES ────────────────────
export function friendlyError(code) {
  const map = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Try again.',
    'auth/invalid-credential': 'Invalid email or password. Please try again.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled.',
    'auth/missing-email': 'Please enter your email address.'
  };
  return map[code] || 'Something went wrong. Please try again.';
}