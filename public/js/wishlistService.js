import { db } from '../firebase-config.js';
import { getCurrentUser } from './auth.js';
import { 
  doc, getDoc, setDoc, arrayUnion, arrayRemove 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/**
 * Returns the current user's wishlist array (list of product IDs).
 * @returns {Promise<string[]>} Array of product IDs, or empty array if not logged in/no wishlist.
 */
export async function getWishlistIds() {
  const user = await getCurrentUser();
  if (!user) return [];

  const userDocRef = doc(db, 'users', user.uid);
  const userDocSnap = await getDoc(userDocRef);
  
  if (userDocSnap.exists()) {
    const data = userDocSnap.data();
    return data.wishlist || [];
  }
  return [];
}

/**
 * Toggles a product ID in the user's wishlist.
 * @param {string} productId - The ID of the product to toggle.
 * @returns {Promise<boolean>} True if added, false if removed.
 * @throws Will throw if user is not logged in.
 */
export async function toggleWishlist(productId) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('NOT_LOGGED_IN');
  }

  const userDocRef = doc(db, 'users', user.uid);
  const currentIds = await getWishlistIds();
  
  const isCurrentlySaved = currentIds.includes(productId);

  if (isCurrentlySaved) {
    // Remove from wishlist
    await setDoc(userDocRef, {
      wishlist: arrayRemove(productId)
    }, { merge: true });
    return false;
  } else {
    // Add to wishlist
    await setDoc(userDocRef, {
      wishlist: arrayUnion(productId)
    }, { merge: true });
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

  const products = [];
  
  // Since 'in' queries are limited to 10 items in Firestore, we'll fetch individually 
  // or use Promise.all. A user's wishlist usually isn't massive enough to break this.
  const promises = ids.map(id => getDoc(doc(db, 'products', id)));
  const snapshots = await Promise.all(promises);

  snapshots.forEach(snap => {
    if (snap.exists()) {
      products.push({ id: snap.id, ...snap.data() });
    }
  });

  return products;
}
