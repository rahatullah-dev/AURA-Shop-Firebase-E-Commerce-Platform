import { getUserProfile, updateUserProfile } from './auth.js';
import { uploadImage } from './adminService.js';
import { auth } from '../firebase-config.js';

/**
 * Loads the current admin's profile data.
 * Reuses the existing getUserProfile from auth.js.
 * @returns {Promise<Object>} Profile data or null
 */
export async function loadAdminProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const profile = await getUserProfile(user.uid);
  return profile || {};
}

/**
 * Saves the admin profile data.
 * @param {Object} data - Profile fields to update
 */
export async function saveAdminProfile(data) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  await updateUserProfile(user.uid, data);
  
  // Dispatch custom event to notify UI components
  window.dispatchEvent(new CustomEvent('profileUpdated', { detail: data }));
}

/**
 * Uploads an avatar image to Cloudinary.
 * Reuses the existing uploadImage function from adminService.js.
 * Uses the 'products' folder since it matches the configured upload preset.
 * @param {File} file 
 * @param {Function} onProgress
 * @returns {Promise<string>} Cloudinary secure_url
 */
export async function uploadAvatar(file, onProgress) {
  return uploadImage(file, 'products', onProgress);
}
