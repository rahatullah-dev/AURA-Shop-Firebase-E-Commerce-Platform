import { getAllOrders, getAllProducts } from './adminService.js';
import { db } from '../firebase-config.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getCurrentUser } from './auth.js';

let currentAdminId = null;

/**
 * Initialize the current admin user ID
 */
async function initCurrentAdmin() {
  if (!currentAdminId) {
    const user = await getCurrentUser();
    if (user) {
      currentAdminId = user.uid;
    }
  }
  return currentAdminId;
}

/**
 * Get notification read state from Firebase
 */
async function getNotificationReadState() {
  try {
    const adminId = await initCurrentAdmin();
    if (!adminId) return {};
    
    const docRef = doc(db, 'adminNotificationState', adminId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data().readNotifications || {};
    }
    return {};
  } catch (error) {
    console.error('Error getting notification read state:', error);
    return {};
  }
}

/**
 * Save notification read state to Firebase
 */
async function saveNotificationReadState(readNotifications) {
  try {
    const adminId = await initCurrentAdmin();
    if (!adminId) return;
    
    const docRef = doc(db, 'adminNotificationState', adminId);
    await setDoc(docRef, {
      readNotifications: readNotifications,
      lastUpdated: new Date()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving notification read state:', error);
  }
}

/**
 * Derives notifications from existing collections.
 * @returns {Promise<Array>} Array of notification objects
 */
export async function fetchDerivedNotifications() {
  const notifications = [];
  try {
    // We only fetch a limited set, but getAllOrders/getAllProducts might fetch all.
    // In a real production environment with huge data, we would use queries.
    // For this UI implementation, we'll fetch them and sort in memory.
    const [orders, products] = await Promise.all([
      getAllOrders(),
      getAllProducts()
    ]);

    // Generate from orders
    orders.forEach(o => {
      if (o.createdAt) {
        notifications.push({
          id: `order_new_${o.id}`,
          type: 'order',
          title: 'New Order Received',
          message: `Order #${o.id.substring(0,8)} by ${o.customer?.name || 'Customer'}`,
          timestamp: new Date(o.createdAt.seconds ? o.createdAt.seconds * 1000 : o.createdAt).getTime(),
          read: false
        });
      }
      if (o.updatedAt && o.status && o.status !== 'pending') {
        notifications.push({
          id: `order_status_${o.id}_${o.status}`,
          type: 'status',
          title: 'Order Status Changed',
          message: `Order #${o.id.substring(0,8)} is now ${o.status}`,
          timestamp: new Date(o.updatedAt.seconds ? o.updatedAt.seconds * 1000 : o.updatedAt).getTime(),
          read: false
        });
      }
    });

    // Generate from products
    products.forEach(p => {
      if (p.createdAt) {
        notifications.push({
          id: `product_new_${p.id}`,
          type: 'product',
          title: 'Product Added',
          message: `New product: ${p.name}`,
          timestamp: new Date(p.createdAt.seconds ? p.createdAt.seconds * 1000 : p.createdAt).getTime(),
          read: false
        });
      }
      // Low stock alert
      if (p.trackStock && p.stock <= (p.lowStockAt || 5)) {
        notifications.push({
          id: `product_stock_${p.id}`,
          type: 'stock',
          title: 'Low Stock Alert',
          message: `${p.name} has only ${p.stock} left in stock.`,
          timestamp: Date.now(), // Real-time alert
          read: false
        });
      }
    });

    // Sort descending by timestamp
    notifications.sort((a, b) => b.timestamp - a.timestamp);
    
    return notifications.slice(0, 15); // Keep recent 15
  } catch (err) {
    console.error('Error fetching derived notifications:', err);
    return [];
  }
}

/**
 * Loads notifications into the UI and handles Firebase persistence.
 */
export async function loadNotifications() {
  try {
    console.log('[Notifications] Loading notifications...');
    
    // Get stored read state from Firebase
    const readStateMap = await getNotificationReadState();
    console.log('[Notifications] Read state from Firebase:', readStateMap);
    
    // Fetch fresh notifications
    const freshNotifs = await fetchDerivedNotifications();
    console.log('[Notifications] Fresh notifications count:', freshNotifs.length);
    
    // Apply the stored read state to fresh notifications
    freshNotifs.forEach(fn => {
      // If we have a stored read state for this notification, use it
      if (readStateMap[fn.id] === true) {
        fn.read = true;
      }
      // Otherwise, it stays as false (new unread notification)
    });
    
    const unreadCount = freshNotifs.filter(n => !n.read).length;
    console.log('[Notifications] Unread count:', unreadCount);
    
    // Render the notifications
    renderNotifications(freshNotifs);
  } catch (error) {
    console.error('Error loading notifications:', error);
    renderNotifications([]);
  }
}

/**
 * Renders the notifications in the dropdown and updates badge.
 */
export function renderNotifications(notifications) {
  const dropdown = document.getElementById('notifDropdownList');
  const badge = document.getElementById('notifBadge');
  
  if (!dropdown || !badge) return;

  // Store notifications in a global variable for access by mark functions
  window.currentNotifications = notifications;

  const unreadCount = notifications.filter(n => !n.read).length;
  
  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }

  if (notifications.length === 0) {
    dropdown.innerHTML = '<div style="padding:16px;text-align:center;color:var(--admin-light);font-size:0.9rem;">No notifications</div>';
    return;
  }

  dropdown.innerHTML = notifications.map(n => {
    const iconColor = n.type === 'stock' ? 'var(--admin-red)' : 
                      n.type === 'order' ? 'var(--admin-accent)' : 
                      n.type === 'status' ? 'var(--admin-amber)' : 'var(--admin-green)';
                      
    const timeAgo = Math.floor((Date.now() - n.timestamp) / 60000);
    let timeStr = 'Just now';
    if (timeAgo > 0) {
      timeStr = timeAgo < 60 ? `${timeAgo}m ago` : 
                timeAgo < 1440 ? `${Math.floor(timeAgo/60)}h ago` : 
                `${Math.floor(timeAgo/1440)}d ago`;
    }

    return `
      <div class="notif-item ${n.read ? 'read' : ''}" data-id="${n.id}" style="display:flex; gap:12px; padding:14px 20px; border-bottom:1px solid #f1f5f9; cursor:pointer; transition:background 0.15s; background:${n.read ? '#f8fafc' : '#ffffff'};" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='${n.read ? '#f8fafc' : '#ffffff'}'">
        <div style="width:36px; height:36px; border-radius:50%; background:${iconColor}18; color:${iconColor}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <div style="width:8px;height:8px;border-radius:50%;background:currentColor;"></div>
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:0.88rem; font-weight:700; color:#0f172a; margin-bottom:3px; line-height:1.3;">${n.title}</div>
          <div style="font-size:0.8rem; color:#64748b; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.message}</div>
          <div style="font-size:0.72rem; color:#94a3b8; font-weight:500;">${timeStr}</div>
        </div>
        ${!n.read ? `<div style="width:8px; height:8px; border-radius:50%; background:${iconColor}; flex-shrink:0; margin-top:4px;"></div>` : ''}
      </div>
    `;
  }).join('');
  
  // Attach click events
  dropdown.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      markRead(el.dataset.id);
    });
  });
}

/**
 * Marks a specific notification as read.
 */
export async function markRead(id) {
  try {
    console.log('[Notifications] Marking as read:', id);
    
    // Get current notifications from global variable
    let notifs = window.currentNotifications || [];
    const item = notifs.find(n => n.id === id);
    
    if (item && !item.read) {
      item.read = true;
      
      // Build readState object from all notifications
      const readState = {};
      notifs.forEach(n => {
        if (n.read) {
          readState[n.id] = true;
        }
      });
      
      console.log('[Notifications] Saving read state:', readState);
      
      // Save to Firebase
      await saveNotificationReadState(readState);
      
      console.log('[Notifications] Saved successfully');
      
      // Re-render
      renderNotifications(notifs);
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

/**
 * Marks all notifications as read.
 */
export async function markAllRead() {
  try {
    // Get current notifications from global variable
    let notifs = window.currentNotifications || [];
    
    // Mark all as read
    notifs.forEach(n => n.read = true);
    
    // Build readState object
    const readState = {};
    notifs.forEach(n => {
      readState[n.id] = true;
    });
    
    // Save to Firebase
    await saveNotificationReadState(readState);
    
    // Re-render
    renderNotifications(notifs);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

/**
 * Removes all read (seen) notifications from the list.
 */
export async function clearReadNotifications() {
  try {
    // Get current notifications from global variable
    let notifs = window.currentNotifications || [];
    
    // Keep only unread
    const unread = notifs.filter(n => !n.read);
    
    // Build readState object (only unread ones will have their state preserved)
    // Read notifications are effectively "cleared" by not including them
    const readState = {};
    unread.forEach(n => {
      if (n.read) {
        readState[n.id] = true;
      }
    });
    
    // Save to Firebase
    await saveNotificationReadState(readState);
    
    // Re-render
    renderNotifications(unread);
  } catch (error) {
    console.error('Error clearing read notifications:', error);
  }
}
