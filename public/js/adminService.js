// ════════════════════════════════════════════════════════════
// AURA – Admin Service  |  js/adminService.js
// All admin-specific Firestore operations
// ════════════════════════════════════════════════════════════

import { auth, db, storage } from '../firebase-config.js';
import { getCurrentUser } from './auth.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
// Cloudinary integration – no Firebase Storage needed
// Define Cloudinary credentials (replace with your actual values)
const CLOUDINARY_CLOUD_NAME = 'dsppay62o'; // e.g., 'myshop'
const CLOUDINARY_UPLOAD_PRESET = 'e-commerce'; // unsigned upload preset configured in Cloudinary


// ── ADMIN AUTH GUARD ───────────────────────────────────────
/**
 * Checks if current user is logged in AND has role 'admin'.
 * Redirects to admin login if not.
 * @returns {Promise<object>} user object with profile data
 */
export async function requireAdmin(redirectUrl = '/admin/login.html') {
  const user = await getCurrentUser();
  if (!user) {
    console.log('requireAdmin: No user, redirecting to login');
    window.location.href = redirectUrl;
    return null;
  }

  const profileSnap = await getDoc(doc(db, 'users', user.uid));
  const rawRole = profileSnap?.data()?.role ?? 'user';
  const role = rawRole.toString().trim().toLowerCase();
  console.log('requireAdmin: fetched role', { uid: user.uid, email: user.email, rawRole, normalized: role });
  if (!profileSnap.exists() || role !== 'admin') {
    console.log('requireAdmin: Role not admin, redirecting to login');
    window.location.href = redirectUrl;
    return null;
  }

  return { ...user, profile: profileSnap.data() };
}

// ══════════════════════════════════════════════════════════
// PRODUCT CRUD
// ══════════════════════════════════════════════════════════

/**
 * Fetches ALL products (published + unpublished) for admin view.
 */
export async function getAllProducts() {
  const snap = await getDocs(collection(db, 'products'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get a single product by ID.
 */
export async function getProductById(productId) {
  const snap = await getDoc(doc(db, 'products', productId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Creates a new product in Firestore.
 * @param {object} data - Product data
 * @returns {string} The new product's document ID
 */
export async function addProduct(data) {
  const id = data.slug || generateSlug(data.name);
  const productData = {
    name: data.name || '',
    slug: id,
    shortDesc: data.shortDesc || '',
    description: data.description || '',
    categoryId: data.categoryId || '',
    categoryName: data.categoryName || '',
    brand: data.brand || '',
    tags: data.tags || [],
    price: Number(data.price) || 0,
    salePrice: data.salePrice ? Number(data.salePrice) : null,
    costPrice: data.costPrice ? Number(data.costPrice) : null,
    stock: Number(data.stock) || 0,
    sku: data.sku || '',
    trackStock: data.trackStock !== false,
    lowStockAt: Number(data.lowStockAt) || 5,
    thumbnail: data.thumbnail || '',
    images: data.images || [],
    ratingAvg: 0,
    ratingCount: 0,
    isPublished: data.isPublished !== false,
    isFeatured: data.isFeatured || false,
    isNew: data.isNew || false,
    isBestSeller: data.isBestSeller || false,
    weight: Number(data.weight) || 0,
    requiresShipping: data.requiresShipping !== false,
    currency: 'USD',
    metaTitle: data.metaTitle || '',
    metaDesc: data.metaDesc || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: data.isPublished !== false ? serverTimestamp() : null
  };

  await setDoc(doc(db, 'products', id), productData);
  return id;
}

/**
 * Updates an existing product.
 */
export async function updateProduct(productId, data) {
  const updateData = { ...data, updatedAt: serverTimestamp() };
  // Clean undefined values
  Object.keys(updateData).forEach(k => {
    if (updateData[k] === undefined) delete updateData[k];
  });
  await updateDoc(doc(db, 'products', productId), updateData);
}

/**
 * Soft-deletes a product (sets isPublished to false).
 */
export async function softDeleteProduct(productId) {
  await updateDoc(doc(db, 'products', productId), {
    isPublished: false,
    updatedAt: serverTimestamp()
  });
}

/**
 * Hard-deletes a product document.
 */
export async function hardDeleteProduct(productId) {
  await deleteDoc(doc(db, 'products', productId));
}

// ══════════════════════════════════════════════════════════
// CATEGORY CRUD
// ══════════════════════════════════════════════════════════

/**
 * Fetches all categories (active + inactive) for admin.
 */
export async function getAllCategories() {
  const snap = await getDocs(
    query(collection(db, 'categories'), orderBy('order', 'asc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Add a new category.
 */
export async function addCategory(data) {
  const id = data.slug || generateSlug(data.name);
  await setDoc(doc(db, 'categories', id), {
    name: data.name || '',
    slug: id,
    icon: data.icon || '📦',
    order: Number(data.order) || 0,
    isActive: data.isActive !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return id;
}

/**
 * Update an existing category.
 */
export async function updateCategory(categoryId, data) {
  const updateData = { ...data, updatedAt: serverTimestamp() };
  Object.keys(updateData).forEach(k => {
    if (updateData[k] === undefined) delete updateData[k];
  });
  await updateDoc(doc(db, 'categories', categoryId), updateData);
}

/**
 * Delete a category.
 */
export async function deleteCategory(categoryId) {
  await deleteDoc(doc(db, 'categories', categoryId));
}

// ══════════════════════════════════════════════════════════
// IMAGE UPLOAD (Firebase Storage)
// ══════════════════════════════════════════════════════════

/**
 * Uploads an image file to Firebase Storage.
 * @param {File} file - The image file
 * @param {string} folder - Storage folder path (e.g. 'products')
 * @returns {Promise<string>} The download URL
 */
// Upload using Cloudinary unsigned preset with XHR for progress handling
export async function uploadImage(file, folder = 'products', onProgress) {
  return new Promise((resolve, reject) => {
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    if (folder) form.append('folder', folder);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    // Progress handling
    if (typeof onProgress === 'function') {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } catch (e) {
          console.error('Failed to parse Cloudinary response', e);
          reject(new Error('Invalid upload response'));
        }
      } else {
        console.error('Cloudinary upload error', xhr.status, xhr.responseText);
        reject(new Error('Image upload failed'));
      }
    };
    xhr.onerror = () => {
      console.error('Network error during Cloudinary upload');
      reject(new Error('Network error'));
    };
    xhr.send(form);
  });
}

// ══════════════════════════════════════════════════════════
// ORDERS MANAGEMENT
// ══════════════════════════════════════════════════════════

/**
 * Fetches all orders, optionally filtered by status.
 */
export async function getAllOrders(statusFilter = null) {
  let q;
  if (statusFilter) {
    q = query(
      collection(db, 'orders'),
      where('status', '==', statusFilter)
    );
  } else {
    q = query(collection(db, 'orders'));
  }

  const snap = await getDocs(q);
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Sort by createdAt descending (in memory to avoid composite index)
  orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return orders;
}

/**
 * Fetches a single order with its timeline events.
 */
export async function getOrderDetails(orderId) {
  const orderSnap = await getDoc(doc(db, 'orders', orderId));
  if (!orderSnap.exists()) return null;

  const timelineSnap = await getDocs(
    query(collection(db, `orders/${orderId}/timeline`))
  );
  const timeline = timelineSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

  return {
    id: orderSnap.id,
    ...orderSnap.data(),
    timeline
  };
}

/**
 * Updates order status and adds a timeline event.
 */
export async function updateOrderStatus(orderId, newStatus, note = '') {
  const statusMessages = {
    confirmed: 'Order has been confirmed.',
    processing: 'Order is being processed and prepared.',
    shipped: 'Order has been shipped.',
    delivered: 'Order has been delivered successfully.',
    cancelled: 'Order has been cancelled.'
  };

  const batch = writeBatch(db);

  // Update order status
  const orderRef = doc(db, 'orders', orderId);
  batch.update(orderRef, {
    status: newStatus,
    updatedAt: serverTimestamp()
  });

  // Add timeline event
  const timelineRef = doc(collection(db, `orders/${orderId}/timeline`));
  batch.set(timelineRef, {
    status: newStatus,
    message: note || statusMessages[newStatus] || `Status changed to ${newStatus}.`,
    actor: 'admin',
    createdAt: serverTimestamp()
  });

  await batch.commit();
}

// ══════════════════════════════════════════════════════════
// DASHBOARD STATS
// ══════════════════════════════════════════════════════════

/**
 * Fetches summary stats for the admin dashboard.
 */
export async function getDashboardStats() {
  const [productsSnap, ordersSnap] = await Promise.all([
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'orders'))
  ]);

  const products = productsSnap.docs.map(d => d.data());
  const orders = ordersSnap.docs.map(d => d.data());

  const totalRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const pendingOrders = orders.filter(o =>
    o.status === 'confirmed' || o.status === 'processing'
  ).length;

  const lowStockProducts = products.filter(p =>
    p.trackStock && p.stock <= (p.lowStockAt || 5) && p.stock > 0
  ).length;

  const outOfStockProducts = products.filter(p =>
    p.trackStock && p.stock === 0
  ).length;

  return {
    totalProducts: products.length,
    totalOrders: orders.length,
    pendingOrders,
    totalRevenue,
    lowStockProducts,
    outOfStockProducts
  };
}

// ══════════════════════════════════════════════════════════
// ADMIN PROMOTION (run from browser console)
// ══════════════════════════════════════════════════════════

/**
 * Promotes a user to admin role. Run from browser console:
 * import { promoteToAdmin } from './js/adminService.js';
 * promoteToAdmin('USER_UID_HERE');
 */
export async function promoteToAdmin(uid) {
  await updateDoc(doc(db, 'users', uid), { role: 'admin' });
  console.log(`✅ User ${uid} promoted to admin.`);
}

// ══════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}
