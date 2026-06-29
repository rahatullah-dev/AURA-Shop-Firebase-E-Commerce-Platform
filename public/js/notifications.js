import { getAllOrders, getAllProducts } from './adminService.js';

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
 * Loads notifications into the UI and handles localStorage persistence.
 */
export async function loadNotifications() {
  const localData = localStorage.getItem('adminNotifications');
  let currentNotifs = localData ? JSON.parse(localData) : [];
  
  // Fetch fresh ones and merge keeping the "read" state
  const freshNotifs = await fetchDerivedNotifications();
  
  freshNotifs.forEach(fn => {
    const existing = currentNotifs.find(cn => cn.id === fn.id);
    if (existing) {
      fn.read = existing.read;
    }
  });

  currentNotifs = freshNotifs;
  localStorage.setItem('adminNotifications', JSON.stringify(currentNotifs));
  
  renderNotifications(currentNotifs);
}

/**
 * Renders the notifications in the dropdown and updates badge.
 */
export function renderNotifications(notifications) {
  const dropdown = document.getElementById('notifDropdownList');
  const badge = document.getElementById('notifBadge');
  
  if (!dropdown || !badge) return;

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
      <div class="notif-item ${n.read ? 'read' : ''}" data-id="${n.id}" style="display:flex; gap:12px; padding:14px 20px; border-bottom:1px solid #f1f5f9; cursor:pointer; transition:background 0.15s; background:${n.read ? '#f8fafc' : '#ffffff'};">
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
export function markRead(id) {
  let notifs = JSON.parse(localStorage.getItem('adminNotifications') || '[]');
  const item = notifs.find(n => n.id === id);
  if (item) {
    item.read = true;
    localStorage.setItem('adminNotifications', JSON.stringify(notifs));
    renderNotifications(notifs);
  }
}

/**
 * Marks all notifications as read.
 */
export function markAllRead() {
  let notifs = JSON.parse(localStorage.getItem('adminNotifications') || '[]');
  notifs.forEach(n => n.read = true);
  localStorage.setItem('adminNotifications', JSON.stringify(notifs));
  renderNotifications(notifs);
}

/**
 * Removes all read (seen) notifications from the list.
 */
export function clearReadNotifications() {
  let notifs = JSON.parse(localStorage.getItem('adminNotifications') || '[]');
  const unread = notifs.filter(n => !n.read);
  localStorage.setItem('adminNotifications', JSON.stringify(unread));
  renderNotifications(unread);
}
