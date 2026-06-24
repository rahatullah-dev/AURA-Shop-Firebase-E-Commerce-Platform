// ════════════════════════════════════════════════════════════
// AURA – Cart & Coupon Service  |  js/cartService.js
// Handles localStorage cart, Firestore sync, and Coupon validation
// ════════════════════════════════════════════════════════════

import { db } from '../firebase-config.js';
import { getCurrentUser } from './auth.js';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, writeBatch, query, where
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const CART_KEY = 'aura_cart';

// ── LOCAL STORAGE CART ─────────────────────────────────────
export function getLocalCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}

export function saveLocalCart(cartItems) {
  localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
  // Dispatch custom event so UI (like nav badge) can update immediately
  window.dispatchEvent(new Event('cart_updated'));
}

export function clearLocalCart() {
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event('cart_updated'));
}

export function getCartTotal() {
  const items = getLocalCart();
  return items.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

// ── FIRESTORE SYNC ─────────────────────────────────────────
/**
 * Merges localStorage cart with Firestore cart.
 * If there's local items, push them to Firestore.
 * Finally, returns the full synced cart.
 */
export async function syncCartToFirestore() {
  const user = await getCurrentUser();
  if (!user) return getLocalCart(); // Stay local if guest

  const uid = user.uid;
  const localCart = getLocalCart();
  const cartRef = collection(db, `cart/${uid}/items`);
  
  // 1. Get Firestore cart
  const snap = await getDocs(cartRef);
  const firestoreCart = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 2. Merge logic
  let merged = [...firestoreCart];
  let needsUpload = false;

  for (const localItem of localCart) {
    if (!localItem.cartItemId) localItem.cartItemId = localItem.id || Math.random().toString(36).substring(7);
    const existingIndex = merged.findIndex(i => i.cartItemId === localItem.cartItemId);
    if (existingIndex > -1) {
      // For simplicity, local overrides if different, or we can just keep firestore
      // Let's just add quantities if they both exist
      merged[existingIndex].qty = Math.max(merged[existingIndex].qty, localItem.qty);
      needsUpload = true;
    } else {
      merged.push(localItem);
      needsUpload = true;
    }
  }

  // 3. Upload merged to Firestore (batch)
  if (needsUpload) {
    const batch = writeBatch(db);
    // Ensure parent doc exists
    batch.set(doc(db, 'cart', uid), { userId: uid, updatedAt: new Date() }, { merge: true });
    
    merged.forEach(item => {
      // Use cartItemId as document ID in subcollection
      if (!item.cartItemId) item.cartItemId = item.id || Math.random().toString(36).substring(7);
      const itemRef = doc(db, `cart/${uid}/items`, item.cartItemId);
      batch.set(itemRef, item);
    });
    await batch.commit();
  }

  // 4. Save back to local storage so UI is in sync
  saveLocalCart(merged);
  return merged;
}

/**
 * Update quantity in both local and firestore (if logged in)
 */
export async function updateCartItemQuantity(cartItemId, newQty) {
  let cart = getLocalCart();
  const index = cart.findIndex(i => i.cartItemId === cartItemId);
  
  if (index > -1) {
    if (newQty <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].qty = newQty;
    }
    saveLocalCart(cart);

    const user = await getCurrentUser();
    if (user) {
      const itemRef = doc(db, `cart/${user.uid}/items`, cartItemId);
      if (newQty <= 0) {
        await deleteDoc(itemRef);
      } else {
        await setDoc(itemRef, { qty: newQty }, { merge: true });
      }
    }
  }
}

/**
 * Remove item from both local and firestore (if logged in)
 */
export async function removeCartItem(cartItemId) {
  await updateCartItemQuantity(cartItemId, 0);
}

/**
 * Clear the entire cart (e.g. after checkout)
 */
export async function clearCartFull() {
  clearLocalCart();
  const user = await getCurrentUser();
  if (user) {
    const snap = await getDocs(collection(db, `cart/${user.uid}/items`));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

// ── COUPON VALIDATION ──────────────────────────────────────
/**
 * Validate a coupon code against Firestore.
 * @returns {object|null} coupon details or throws error if invalid
 */
export async function validateCoupon(code) {
  if (!code) return null;
  code = code.trim().toUpperCase();

  const snap = await getDocs(
    query(collection(db, 'coupons'), where('code', '==', code), where('isActive', '==', true))
  );

  if (snap.empty) {
    throw new Error('Invalid or expired coupon code.');
  }

  const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() };

  // Check expiry
  if (coupon.expiresAt && coupon.expiresAt.toDate() < new Date()) {
    throw new Error('This coupon has expired.');
  }

  // Check min order amount
  const subtotal = getCartTotal();
  if (coupon.minOrderAmt && subtotal < coupon.minOrderAmt) {
    throw new Error(`Minimum order amount of $${coupon.minOrderAmt} required.`);
  }

  // Check usage limits
  if (coupon.maxUsesTotal !== null && coupon.usedCount >= coupon.maxUsesTotal) {
    throw new Error('This coupon has reached its usage limit.');
  }

  return coupon;
}

/**
 * Calculate the discount amount based on a validated coupon.
 */
export function calculateDiscount(subtotal, coupon) {
  if (!coupon) return 0;
  
  let discount = 0;
  if (coupon.type === 'fixed') {
    discount = coupon.value;
  } else if (coupon.type === 'percentage') {
    discount = subtotal * (coupon.value / 100);
    if (coupon.maxDiscount) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else if (coupon.type === 'free_shipping') {
    // Handled separately by shipping logic, but returning 0 for subtotal discount
    discount = 0; 
  }
  
  return discount;
}
