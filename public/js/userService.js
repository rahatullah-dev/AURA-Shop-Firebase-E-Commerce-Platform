// ════════════════════════════════════════════════════════════
// AURA – User Service  |  js/userService.js
// User management operations for admin panel
// ════════════════════════════════════════════════════════════

import { db } from '../firebase-config.js';
import {
  collection, doc, getDoc, getDocs, updateDoc,
  query, where, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ══════════════════════════════════════════════════════════
// USER FETCHING
// ══════════════════════════════════════════════════════════

/**
 * Fetches ALL users from Firestore
 */
export async function getAllUsers() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

/**
 * Get a single user by ID
 */
export async function getUserById(userId) {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

/**
 * Update user information (admin only)
 */
export async function updateUser(userId, data) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...data,
      updatedAt: new Date()
    });
    return true;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

/**
 * Block/Unblock a user
 */
export async function toggleUserBlock(userId, isBlocked) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isBlocked: isBlocked,
      updatedAt: new Date()
    });
    return true;
  } catch (error) {
    console.error('Error blocking/unblocking user:', error);
    throw error;
  }
}

// ══════════════════════════════════════════════════════════
// USER STATISTICS
// ══════════════════════════════════════════════════════════

/**
 * Calculate user statistics
 */
export async function getUserStats() {
  try {
    const users = await getAllUsers();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Calculate stats
    const totalUsers = users.length;
    const newUsersThisMonth = users.filter(u => {
      if (!u.createdAt) return false;
      const createdDate = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
      return createdDate >= startOfMonth;
    }).length;
    
    // Active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const activeUsers = users.filter(u => {
      if (!u.lastLogin) return false;
      const lastLoginDate = u.lastLogin.toDate ? u.lastLogin.toDate() : new Date(u.lastLogin);
      return lastLoginDate >= thirtyDaysAgo;
    }).length;
    
    // Blocked users
    const blockedUsers = users.filter(u => u.isBlocked === true).length;
    
    return {
      totalUsers,
      newUsersThisMonth,
      activeUsers,
      blockedUsers
    };
  } catch (error) {
    console.error('Error calculating user stats:', error);
    return {
      totalUsers: 0,
      newUsersThisMonth: 0,
      activeUsers: 0,
      blockedUsers: 0
    };
  }
}

/**
 * Get user's order statistics
 */
export async function getUserOrderStats(userId) {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('userId', '==', userId));
    const snap = await getDocs(q);
    
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    
    return {
      totalOrders,
      totalSpent
    };
  } catch (error) {
    console.error('Error fetching user order stats:', error);
    return {
      totalOrders: 0,
      totalSpent: 0
    };
  }
}

/**
 * Get user's recent orders
 */
export async function getUserRecentOrders(userId, limitCount = 5) {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching user recent orders:', error);
    return [];
  }
}
