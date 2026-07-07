import { db } from '../firebase-config.js';
import { getCurrentUser } from './auth.js';
import { 
  doc, getDoc, setDoc, deleteDoc, collection, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/**
 * Returns the current user's wishlist array (list of product IDs).
 * Reads from /wishlist/{userId}/items subcollection.
 * @returns {Promise<string[]>} Array of product IDs, or empty array if not logged in.
 */
export async function getWishlistIds() {
  const user = await getCurrentUser();
  if (!user) return [];

  const itemsRef = collection(db, 'wishlist', user.uid, 'items');
  const snap = await getDocs(itemsRef);
  return snap.docs.map(d => d.id);
}

/**
 * Toggles a product ID in the user's wishlist.
 * Writes to /wishlist/{userId}/items/{productId} which is permitted by Firestore rules.
 * @param {string} productId - The ID of the product to toggle.
 * @returns {Promise<boolean>} True if added, false if removed.
 * @throws Will throw if user is not logged in.
 */
export async function toggleWishlist(productId) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('NOT_LOGGED_IN');
  }

  const itemRef = doc(db, 'wishlist', user.uid, 'items', productId);
  const snap = await getDoc(itemRef);

  if (snap.exists()) {
    // Remove from wishlist
    await deleteDoc(itemRef);
    return false;
  } else {
    // Add to wishlist
    await setDoc(itemRef, { addedAt: new Date().toISOString() });
    return true;
  }
}

/**
 * Retrieves the full product details for all items in the user's wishlist.
 * @returns {Promise<Object[]>} Array of full product objects.
 */
export async function getWishlistProducts() {
  const ids = await getWishlistIds();
  if (!ids || ids.length === 0) return [];

  const promises = ids.map(id => getDoc(doc(db, 'products', id)));
  const snapshots = await Promise.all(promises);

  const products = [];
  snapshots.forEach(snap => {
    if (snap.exists()) {
      products.push({ id: snap.id, ...snap.data() });
    }
  });

  return products;
}
