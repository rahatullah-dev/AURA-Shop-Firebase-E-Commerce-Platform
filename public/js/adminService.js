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
export async function requireAdmin(redirectUrl = 'login.html') {
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

// ══════════════════════════════════════════════════════════
// ADVANCED ANALYTICS (Phase 1, 2, 3)
// ══════════════════════════════════════════════════════════

export async function getAdvancedAnalytics() {
  const [usersSnap, productsSnap, ordersSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'orders'))
  ]);

  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Helper to parse Firebase timestamp
  const parseDate = (val) => val && val.toDate ? val.toDate() : new Date(val);

  // 1. Customers Data
  const totalCustomers = users.length;
  let newCustomersThisMonth = 0;
  users.forEach(u => {
    if (u.createdAt) {
      const d = parseDate(u.createdAt);
      if (d >= startOfMonth) newCustomersThisMonth++;
    }
  });

  // 2. Revenue Data
  let todaysRevenue = 0;
  let monthlyRevenue = 0;
  
  // Chart Aggregation Map
  const chartData = {
    daily: { labels: [], data: [] },
    weekly: { labels: [], data: [] },
    monthly: { labels: [], data: [] }
  };
  
  // Prepare Daily (Last 7 days)
  for(let i=6; i>=0; i--) {
    let d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    chartData.daily.labels.push(d.toLocaleDateString('en-US', {weekday: 'short'}));
    chartData.daily.data.push(0);
  }

  // Prepare Weekly (Last 4 weeks)
  for(let i=3; i>=0; i--) {
    chartData.weekly.labels.push(`Week ${i === 0 ? 'Current' : '-' + i}`);
    chartData.weekly.data.push(0);
  }
  
  // Prepare Monthly (Last 6 months)
  for(let i=5; i>=0; i--) {
    let d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    chartData.monthly.labels.push(d.toLocaleDateString('en-US', {month: 'short'}));
    chartData.monthly.data.push(0);
  }

  // Orders Aggregation
  const validOrders = orders.filter(o => o.status !== 'cancelled');
  
  validOrders.forEach(o => {
    if (!o.createdAt) return;
    const d = parseDate(o.createdAt);
    const amount = o.total || 0;
    
    if (d >= startOfDay) todaysRevenue += amount;
    if (d >= startOfMonth) monthlyRevenue += amount;
    
    // Daily
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < 7) {
      chartData.daily.data[6 - diffDays] += amount;
    }

    // Weekly
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks >= 0 && diffWeeks < 4) {
      chartData.weekly.data[3 - diffWeeks] += amount;
    }
    
    // Monthly
    const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (diffMonths >= 0 && diffMonths < 6) {
      chartData.monthly.data[5 - diffMonths] += amount;
    }
  });
  
  // 3. Top Products
  const productSales = {};
  validOrders.forEach(o => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(item => {
        const id = item.productId || item.id;
        if (!productSales[id]) productSales[id] = { qty: 0, revenue: 0, name: item.name, image: item.image || item.thumbnail };
        productSales[id].qty += item.quantity || 1;
        productSales[id].revenue += (item.price || 0) * (item.quantity || 1);
      });
    }
  });
  
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 4);

  // 4. Activity Feed
  const activities = [];
  orders.forEach(o => {
    if (o.createdAt) {
      activities.push({
        type: 'order',
        date: parseDate(o.createdAt),
        title: 'New Order Created',
        desc: `Order #${o.id.substring(0,8)} by ${o.customer?.name || 'Customer'}`
      });
    }
    if (o.updatedAt && o.status) {
      activities.push({
        type: 'status',
        date: parseDate(o.updatedAt),
        title: 'Order Status Changed',
        desc: `Order #${o.id.substring(0,8)} status updated to ${o.status}`
      });
    }
  });
  
  products.forEach(p => {
    if (p.createdAt) {
      activities.push({
        type: 'product',
        date: parseDate(p.createdAt),
        title: 'Product Added',
        desc: `New product: ${p.name}`
      });
    }
  });
  
  const recentActivity = activities
    .sort((a, b) => b.date - a.date)
    .slice(0, 4);

  return {
    totalCustomers,
    newCustomersThisMonth,
    todaysRevenue,
    monthlyRevenue,
    chartData,
    topProducts,
    recentActivity
  };
}
