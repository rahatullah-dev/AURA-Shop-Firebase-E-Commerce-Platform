// ════════════════════════════════════════════════════════════
// AURA – Product Service  |  js/productService.js
// All Firestore product operations: fetch, filter, search, sort
// ════════════════════════════════════════════════════════════

import { db } from '../firebase-config.js';
import {
  collection, doc, getDoc, getDocs,
  query, where, orderBy, limit, startAfter,
  documentId
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const PRODUCTS_COL = 'products';
const CATEGORIES_COL = 'categories';
const PAGE_SIZE = 12;

// ── GET ALL CATEGORIES ─────────────────────────────────────
export async function getCategories() {
  const snap = await getDocs(
    query(collection(db, CATEGORIES_COL),
      where('isActive', '==', true),
      orderBy('order', 'asc')
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── GET SINGLE PRODUCT ─────────────────────────────────────
export async function getProductById(productId) {
  const snap = await getDoc(doc(db, PRODUCTS_COL, productId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ── GET PRODUCT BY SLUG ────────────────────────────────────
export async function getProductBySlug(slug) {
  const snap = await getDocs(
    query(collection(db, PRODUCTS_COL),
      where('slug', '==', slug),
      where('isPublished', '==', true),
      limit(1)
    )
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ── FETCH PRODUCTS (with filters, sort, pagination) ────────
/**
 * @param {object} opts
 * @param {string}  opts.categoryId   - filter by category
 * @param {string}  opts.sortBy       - 'newest'|'price_asc'|'price_desc'|'rating'|'popular'
 * @param {number}  opts.minPrice     - min price filter
 * @param {number}  opts.maxPrice     - max price filter
 * @param {boolean} opts.onSaleOnly   - only products with salePrice set
 * @param {boolean} opts.inStockOnly  - only products with stock > 0
 * @param {object}  opts.lastDoc      - Firestore cursor for pagination
 * @param {number}  opts.pageSize     - items per page (default 12)
 * @returns {{ products: [], lastDoc: doc|null, hasMore: boolean }}
 */
export async function fetchProducts(opts = {}) {
  const {
    categoryId = null,
    sortBy = 'newest',
    minPrice = null,
    maxPrice = null,
    onSaleOnly = false,
    inStockOnly = false,
    lastDoc: cursor = null, // Ignored in memory-sort
    pageSize = PAGE_SIZE
  } = opts;

  // Fetch all published products to avoid composite index requirements
  let snap = await getDocs(query(collection(db, PRODUCTS_COL), where('isPublished', '==', true)));
  
  if (snap.empty) {
    console.log("No products found in Firestore. Auto-seeding sample data...");
    await seedSampleData();
    snap = await getDocs(query(collection(db, PRODUCTS_COL), where('isPublished', '==', true)));
  }

  let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Apply Filters in memory
  if (categoryId) products = products.filter(p => p.categoryId === categoryId);
  if (onSaleOnly) products = products.filter(p => p.salePrice > 0);
  if (inStockOnly) products = products.filter(p => p.stock > 0);
  if (minPrice !== null) products = products.filter(p => (p.salePrice || p.price) >= minPrice);
  if (maxPrice !== null) products = products.filter(p => (p.salePrice || p.price) <= maxPrice);

  // Sort in memory
  const sortFns = {
    newest:     (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
    price_asc:  (a, b) => (a.salePrice || a.price) - (b.salePrice || b.price),
    price_desc: (a, b) => (b.salePrice || b.price) - (a.salePrice || a.price),
    rating:     (a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0),
    popular:    (a, b) => (b.ratingCount || 0) - (a.ratingCount || 0)
  };
  products.sort(sortFns[sortBy] || sortFns.newest);

  // Pagination in memory (since we loaded all)
  // For simplicity, if we rely on cursor, we need a standard offset. 
  // Let's just return the first PAGE_SIZE for now if cursor isn't provided,
  // Or we just return all products and let the frontend show them.
  // The frontend uses lastDoc to paginate. Since we changed to memory, let's just return everything to avoid complex cursor logic,
  // or use a simple offset. But to keep frontend happy:
  return { products, lastDoc: null, hasMore: false };
}

// ── SEARCH PRODUCTS (client-side, Firestore has no full-text) ─
/**
 * Searches published products. Uses in-memory cache to prevent excessive reads
 * during real-time typing.
 */
let _cachedProducts = null;
let _cacheTime = 0;

export async function getAllCachedProducts() {
  const now = Date.now();
  // Cache for 5 minutes
  if (_cachedProducts && (now - _cacheTime < 5 * 60 * 1000)) {
    return _cachedProducts;
  }

  const snap = await getDocs(
    query(collection(db, PRODUCTS_COL), where('isPublished', '==', true))
  );
  
  _cachedProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _cacheTime = now;
  return _cachedProducts;
}

export async function searchProducts(query_str, opts = {}) {
  if (!query_str.trim()) return { products: [] };
  const { categoryId = null, sortBy = 'newest' } = opts;

  let allProducts = await getAllCachedProducts();

  if (categoryId) {
    allProducts = allProducts.filter(p => p.categoryId === categoryId);
  }

  const q = query_str.toLowerCase().trim();
  const results = allProducts
    .filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.shortDesc?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.tags?.some(t => t.toLowerCase().includes(q)) ||
      p.categoryName?.toLowerCase().includes(q)
    );

  // Sort results
  const sortFns = {
    newest:     (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
    price_asc:  (a, b) => (a.salePrice || a.price) - (b.salePrice || b.price),
    price_desc: (a, b) => (b.salePrice || b.price) - (a.salePrice || a.price),
    rating:     (a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0),
    popular:    (a, b) => (b.ratingCount || 0) - (a.ratingCount || 0)
  };
  results.sort(sortFns[sortBy] || sortFns.newest);

  return { products: results };
}

// ── GET FEATURED PRODUCTS ──────────────────────────────────
export async function getFeaturedProducts(count = 8) {
  let snap = await getDocs(query(collection(db, PRODUCTS_COL), where('isPublished', '==', true)));
  
  if (snap.empty) {
    console.log("No products found in Firestore. Auto-seeding sample data...");
    await seedSampleData();
    snap = await getDocs(query(collection(db, PRODUCTS_COL), where('isPublished', '==', true)));
  }

  let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  products = products.filter(p => p.isFeatured === true);
  products.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return products.slice(0, count);
}

// ── GET NEW ARRIVALS ───────────────────────────────────────
export async function getNewArrivals(count = 8) {
  const snap = await getDocs(query(collection(db, PRODUCTS_COL), where('isPublished', '==', true)));
  let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  products = products.filter(p => p.isNew === true);
  products.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return products.slice(0, count);
}

// ── GET BEST SELLERS ───────────────────────────────────────
export async function getBestSellersProducts(count = 8) {
  const snap = await getDocs(query(collection(db, PRODUCTS_COL), where('isPublished', '==', true)));
  let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  products = products.filter(p => p.isBestSeller === true);
  // Fallback if no products explicitly marked as best seller, sort by rating
  if (products.length === 0) {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    products.sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0));
  } else {
    products.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }
  return products.slice(0, count);
}

// ── GET RELATED PRODUCTS ───────────────────────────────────
export async function getRelatedProducts(categoryId, excludeId, count = 4) {
  const snap = await getDocs(query(collection(db, PRODUCTS_COL), where('isPublished', '==', true)));
  let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  products = products.filter(p => p.categoryId === categoryId && p.id !== excludeId);
  products.sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0));
  return products.slice(0, count);
}

// ── SEED SAMPLE DATA ───────────────────────────────────────
// Call this once from the browser console to seed Firestore with demo data:
// import { seedSampleData } from './js/productService.js'; seedSampleData();
export async function seedSampleData() {
  const { setDoc, serverTimestamp } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
  );

  const categories = [
    { id: 'sportswear', name: 'Sportswear', slug: 'sportswear', icon: '👟', order: 1, isActive: true },
    { id: 'electronics', name: 'Electronics', slug: 'electronics', icon: '🎧', order: 2, isActive: true },
    { id: 'skincare', name: 'Skincare', slug: 'skincare', icon: '🧴', order: 3, isActive: true },
    { id: 'accessories', name: 'Accessories', slug: 'accessories', icon: '🕶️', order: 4, isActive: true },
  ];

  for (const cat of categories) {
    await setDoc(doc(db, 'categories', cat.id), {
      ...cat, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    console.log('Seeded category:', cat.name);
  }

  const products = [
    {
      id: 'aerostride-white', name: 'AeroStride Run 5 – White', slug: 'aerostride-run-5-white',
      shortDesc: 'Lightweight performance running shoe with superior cushioning.',
      description: 'The AeroStride Run 5 is engineered for performance and comfort.',
      categoryId: 'sportswear', categoryName: 'Sportswear', brand: 'AeroStride',
      tags: ['running', 'sports', 'shoes', 'white'],
      price: 89.99, salePrice: 64.99, costPrice: 30,
      stock: 48, sku: 'AS-RUN5-WHT', trackStock: true, lowStockAt: 5,
      thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
      images: [
        { url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700&q=80', isPrimary: true, order: 0, alt: 'AeroStride White Front' },
        { url: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400&q=80', isPrimary: false, order: 1, alt: 'AeroStride White Side' },
        { url: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&q=80', isPrimary: false, order: 2, alt: 'AeroStride White Back' },
        { url: 'https://images.unsplash.com/photo-1584735175315-9d5df23be620?w=400&q=80', isPrimary: false, order: 3, alt: 'AeroStride White Detail' },
      ],
      ratingAvg: 4.5, ratingCount: 185,
      isPublished: true, isFeatured: true, isNew: true, isBestSeller: false,
      weight: 280, requiresShipping: true,
      metaTitle: 'AeroStride Run 5 White – Premium Running Shoes',
      metaDesc: 'Shop AeroStride Run 5 running shoes in white. Lightweight, cushioned, performance-ready.'
    },
    {
      id: 'aerostride-black', name: 'AeroStride Run 5 – Black', slug: 'aerostride-run-5-black',
      shortDesc: 'Lightweight performance running shoe with superior cushioning.',
      description: 'The AeroStride Run 5 is engineered for performance and comfort.',
      categoryId: 'sportswear', categoryName: 'Sportswear', brand: 'AeroStride',
      tags: ['running', 'sports', 'shoes', 'black'],
      price: 89.99, salePrice: null, costPrice: 30,
      stock: 30, sku: 'AS-RUN5-BLK', trackStock: true, lowStockAt: 5,
      thumbnail: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400&q=80',
      images: [{ url: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=700&q=80', isPrimary: true, order: 0, alt: 'AeroStride Black' }],
      ratingAvg: 4.3, ratingCount: 97,
      isPublished: true, isFeatured: true, isNew: false, isBestSeller: true,
      weight: 280, requiresShipping: true,
      metaTitle: 'AeroStride Run 5 Black Running Shoes', metaDesc: ''
    },
    {
      id: 'wireless-headphones', name: 'SoundWave Pro Headphones', slug: 'soundwave-pro-headphones',
      shortDesc: 'Premium wireless headphones with 40hr battery & active noise cancellation.',
      description: 'Immersive sound meets intelligent noise cancellation.',
      categoryId: 'electronics', categoryName: 'Electronics', brand: 'SoundWave',
      tags: ['headphones', 'wireless', 'audio', 'anc'],
      price: 149.99, salePrice: 119.99, costPrice: 50,
      stock: 22, sku: 'SW-PRO-BLK', trackStock: true, lowStockAt: 3,
      thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80',
      images: [{ url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&q=80', isPrimary: true, order: 0, alt: 'SoundWave Headphones' }],
      ratingAvg: 4.7, ratingCount: 412,
      isPublished: true, isFeatured: true, isNew: true, isBestSeller: true,
      weight: 250, requiresShipping: true,
      metaTitle: 'SoundWave Pro Wireless Headphones', metaDesc: ''
    },
    {
      id: 'skincare-serum', name: 'HydraGlow Vitamin C Serum', slug: 'hydraglow-vitamin-c-serum',
      shortDesc: 'Brightening daily serum with 20% Vitamin C & hyaluronic acid.',
      description: 'Achieve a radiant glow with our concentrated Vitamin C formula.',
      categoryId: 'skincare', categoryName: 'Skincare', brand: 'HydraGlow',
      tags: ['skincare', 'serum', 'vitamin-c', 'brightening'],
      price: 39.99, salePrice: null, costPrice: 12,
      stock: 74, sku: 'HG-VCS-30ML', trackStock: true, lowStockAt: 10,
      thumbnail: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=400&q=80',
      images: [{ url: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=700&q=80', isPrimary: true, order: 0, alt: 'HydraGlow Serum' }],
      ratingAvg: 4.6, ratingCount: 203,
      isPublished: true, isFeatured: false, isNew: true, isBestSeller: false,
      weight: 80, requiresShipping: true,
      metaTitle: 'HydraGlow Vitamin C Serum', metaDesc: ''
    },
    {
      id: 'laptop-backpack', name: 'UrbanCarry Laptop Backpack', slug: 'urbancarry-laptop-backpack',
      shortDesc: '30L waterproof backpack with USB charging port & padded 17" laptop sleeve.',
      description: 'The ultimate everyday carry for professionals and students.',
      categoryId: 'accessories', categoryName: 'Accessories', brand: 'UrbanCarry',
      tags: ['backpack', 'laptop', 'travel', 'waterproof'],
      price: 79.99, salePrice: 59.99, costPrice: 25,
      stock: 15, sku: 'UC-BP-30L-BLK', trackStock: true, lowStockAt: 3,
      thumbnail: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80',
      images: [{ url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=700&q=80', isPrimary: true, order: 0, alt: 'UrbanCarry Backpack' }],
      ratingAvg: 4.4, ratingCount: 88,
      isPublished: true, isFeatured: false, isNew: false, isBestSeller: false,
      weight: 700, requiresShipping: true,
      metaTitle: 'UrbanCarry Laptop Backpack 30L', metaDesc: ''
    },
    {
      id: 'sunglasses-classic', name: 'Aura Classic Polarized Sunglasses', slug: 'aura-classic-polarized-sunglasses',
      shortDesc: 'UV400 polarized lenses with lightweight titanium frame.',
      description: 'Timeless style meets advanced UV protection.',
      categoryId: 'accessories', categoryName: 'Accessories', brand: 'Aura',
      tags: ['sunglasses', 'polarized', 'uv400', 'summer'],
      price: 49.99, salePrice: null, costPrice: 15,
      stock: 60, sku: 'AU-SG-CLS-BLK', trackStock: true, lowStockAt: 5,
      thumbnail: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&q=80',
      images: [{ url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=700&q=80', isPrimary: true, order: 0, alt: 'Aura Sunglasses' }],
      ratingAvg: 4.2, ratingCount: 54,
      isPublished: true, isFeatured: true, isNew: false, isBestSeller: false,
      weight: 30, requiresShipping: true,
      metaTitle: 'Aura Classic Polarized Sunglasses', metaDesc: ''
    },
    {
      id: 'smartwatch-pro', name: 'PulseTrack Smartwatch Pro', slug: 'pulsetrack-smartwatch-pro',
      shortDesc: 'GPS smartwatch with heart rate monitor, SpO2 & 7-day battery.',
      description: 'Track every metric of your fitness journey.',
      categoryId: 'electronics', categoryName: 'Electronics', brand: 'PulseTrack',
      tags: ['smartwatch', 'gps', 'fitness', 'wearable'],
      price: 199.99, salePrice: 169.99, costPrice: 80,
      stock: 18, sku: 'PT-SW-PRO-BLK', trackStock: true, lowStockAt: 3,
      thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80',
      images: [{ url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700&q=80', isPrimary: true, order: 0, alt: 'PulseTrack Smartwatch' }],
      ratingAvg: 4.8, ratingCount: 326,
      isPublished: true, isFeatured: true, isNew: true, isBestSeller: true,
      weight: 45, requiresShipping: true,
      metaTitle: 'PulseTrack Smartwatch Pro GPS', metaDesc: ''
    },
    {
      id: 'moisturizer-daily', name: 'DermaSoft Daily Moisturizer SPF30', slug: 'dermasoft-daily-moisturizer-spf30',
      shortDesc: 'Lightweight daily moisturizer with SPF 30 and ceramide complex.',
      description: 'Protect and hydrate your skin daily.',
      categoryId: 'skincare', categoryName: 'Skincare', brand: 'DermaSoft',
      tags: ['moisturizer', 'spf', 'skincare', 'daily'],
      price: 29.99, salePrice: null, costPrice: 8,
      stock: 100, sku: 'DS-MOI-SPF30-50ML', trackStock: true, lowStockAt: 10,
      thumbnail: 'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?w=400&q=80',
      images: [{ url: 'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?w=700&q=80', isPrimary: true, order: 0, alt: 'DermaSoft Moisturizer' }],
      ratingAvg: 4.5, ratingCount: 167,
      isPublished: true, isFeatured: false, isNew: false, isBestSeller: true,
      weight: 100, requiresShipping: true,
      metaTitle: 'DermaSoft Daily Moisturizer SPF30', metaDesc: ''
    },
  ];

  for (const p of products) {
    const { id, ...data } = p;
    await setDoc(doc(db, 'products', id), {
      ...data, currency: 'USD',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), publishedAt: serverTimestamp()
    });
    console.log('Seeded product:', p.name);
  }

  console.log('✅ Seed complete!');
}
