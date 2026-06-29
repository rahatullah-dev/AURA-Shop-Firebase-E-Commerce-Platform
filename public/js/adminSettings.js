import { auth } from '../firebase-config.js';
import { changeUserPassword } from './auth.js';
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/**
 * Changes the user's email address by re-authenticating first.
 * @param {string} currentPassword 
 * @param {string} newEmail 
 */
export async function changeUserEmail(currentPassword, newEmail) {
  const user = auth.currentUser;
  if (!user) throw new Error('NOT_LOGGED_IN');
  
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updateEmail(user, newEmail);
}

/**
 * Gets the last login time from the current user metadata.
 * @returns {string} Formatted date string or 'Unknown'
 */
export function getLastLoginTime() {
  const user = auth.currentUser;
  if (!user || !user.metadata || !user.metadata.lastSignInTime) return 'Unknown';
  return new Date(user.metadata.lastSignInTime).toLocaleString();
}
