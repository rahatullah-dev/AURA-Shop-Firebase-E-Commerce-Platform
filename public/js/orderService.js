// ════════════════════════════════════════════════════════════
// AURA – Order Service  |  js/orderService.js
// Handles Order creation, Stock deduction, and Transaction
// ════════════════════════════════════════════════════════════

import { db } from '../firebase-config.js';
import { getCurrentUser } from './auth.js';
import { clearCartFull } from './cartService.js';
import {
  collection, doc, runTransaction, serverTimestamp, setDoc, arrayUnion, increment, getDocs, query, where, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/**
 * Creates an order in Firestore and manages stock.
 * Runs in a transaction to ensure stock is accurately decremented.
 */
export async function createOrder(cartItems, orderDetails, coupon = null) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in to place an order.");

  const orderId = doc(collection(db, 'orders')).id;
  const orderNumber = generateOrderNumber();

  // 1. Transaction to check stock and write order
  await runTransaction(db, async (transaction) => {
    
    // Read all products in cart to check stock
    const productRefs = {};
    const productDocs = {};
    
    for (const item of cartItems) {
      if (!productRefs[item.id]) {
        const pRef = doc(db, 'products', item.id);
        productRefs[item.id] = pRef;
        productDocs[item.id] = await transaction.get(pRef);
      }
    }

    // Verify stock
    for (const item of cartItems) {
      const pDoc = productDocs[item.id];
      if (!pDoc.exists()) throw new Error(`Product ${item.name} no longer exists.`);
      
      const pData = pDoc.data();
      if (pData.trackStock) {
        if (pData.stock < item.qty) {
          throw new Error(`Not enough stock for ${item.name}. Only ${pData.stock} left.`);
        }
      }
    }

    // Deduct stock
    for (const item of cartItems) {
      const pDoc = productDocs[item.id];
      const pData = pDoc.data();
      if (pData.trackStock) {
        // Simple decrement (if multiple variants use same stock, this works safely in tx)
        transaction.update(productRefs[item.id], {
          stock: pData.stock - item.qty
        });
      }
    }

    // Prepare Order Document
    const orderData = {
      id: orderId,
      orderNumber,
      userId: user.uid,
      customer: {
        name: user.name || orderDetails.shipping.name,
        email: user.email,
        phone: orderDetails.shipping.phone || user.phone || ''
      },
      shippingAddress: orderDetails.shipping,
      items: cartItems.map(i => ({
        productId: i.id,
        variantId: null, // Simplified for demo
        name: i.name,
        thumbnail: i.thumbnail || '',
        sku: i.sku || '',
        options: i.options || {},
        qty: i.qty,
        unitPrice: i.price,
        totalPrice: i.price * i.qty
      })),
      subtotal: orderDetails.subtotal,
      discountAmt: orderDetails.discountAmt,
      shippingFee: orderDetails.shippingFee,
      tax: orderDetails.tax,
      total: orderDetails.total,
      couponCode: coupon ? coupon.code : null,
      couponId: coupon ? coupon.id : null,
      paymentMethod: orderDetails.paymentMethod,
      paymentStatus: orderDetails.paymentMethod === 'card' ? 'pending' : 'paid', // Set status based on method
      status: 'confirmed',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      confirmedAt: serverTimestamp()
    };

    // Write Order
    const orderRef = doc(db, 'orders', orderId);
    transaction.set(orderRef, orderData);

    // Update Coupon usage if applicable
    if (coupon) {
      const couponRef = doc(db, 'coupons', coupon.id);
      transaction.update(couponRef, {
        usedCount: increment(1),
        usedBy: arrayUnion(user.uid)
      });
    }

  }); // End Transaction

  // 2. Add Timeline Event (Outside transaction for simplicity, or could be batched)
  await setDoc(doc(db, `orders/${orderId}/timeline`, doc(collection(db, 'timeline')).id), {
    status: 'confirmed',
    message: 'Your order has been confirmed and is being processed.',
    actor: 'system',
    createdAt: serverTimestamp()
  });

  // 3. Clear Cart
  await clearCartFull();

  return { orderId, orderNumber };
}

function generateOrderNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000); // 5 digits
  return `#AUR-${year}-${rand}`;
}

/**
 * Fetches all orders for the currently logged in user.
 */
export async function getUserOrders() {
  const user = await getCurrentUser();
  if (!user) return [];

  const q = query(
    collection(db, 'orders'),
    where('userId', '==', user.uid),
    orderBy('createdAt', 'desc')
  );

  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
