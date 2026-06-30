// ════════════════════════════════════════════════════════════
// AURA – Auth Gate Service  |  js/authGate.js
// Handles authentication requirements for cart/wishlist actions
// ════════════════════════════════════════════════════════════

import { getCurrentUser } from './auth.js';

const PENDING_ACTION_KEY = 'aura_pending_action';

/**
 * Stores a pending action that requires authentication
 * @param {string} actionType - 'addToCart', 'addToWishlist', 'buyNow', etc.
 * @param {Object} actionData - Data needed to execute the action
 */
export function setPendingAction(actionType, actionData) {
  const pendingAction = {
    type: actionType,
    data: actionData,
    timestamp: Date.now()
  };
  sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(pendingAction));
  console.log('[AuthGate] Pending action stored:', pendingAction);
}

/**
 * Retrieves and clears the pending action
 * @returns {Object|null} The pending action or null
 */
export function getPendingAction() {
  const stored = sessionStorage.getItem(PENDING_ACTION_KEY);
  if (!stored) return null;
  
  try {
    const action = JSON.parse(stored);
    // Check if action is not too old (30 minutes max)
    if (Date.now() - action.timestamp > 30 * 60 * 1000) {
      clearPendingAction();
      return null;
    }
    return action;
  } catch (error) {
    console.error('[AuthGate] Error parsing pending action:', error);
    clearPendingAction();
    return null;
  }
}

/**
 * Clears the pending action from storage
 */
export function clearPendingAction() {
  sessionStorage.removeItem(PENDING_ACTION_KEY);
  console.log('[AuthGate] Pending action cleared');
}

/**
 * Checks if user is authenticated, shows login modal if not
 * @param {string} actionType - The action that requires authentication
 * @param {Object} actionData - Data for the action
 * @param {string} message - Message to show in the login modal
 * @returns {Promise<boolean>} True if authenticated, false if not
 */
export async function requireAuth(actionType, actionData, message) {
  const user = await getCurrentUser();
  
  if (user) {
    console.log('[AuthGate] User authenticated, proceeding with action');
    return true;
  }
  
  console.log('[AuthGate] User not authenticated, storing pending action and showing modal');
  
  // Store pending action
  setPendingAction(actionType, actionData);
  
  // Show auth modal with custom message
  showAuthModal(message);
  
  return false;
}

/**
 * Shows the authentication modal
 * @param {string} message - Custom message to display
 */
function showAuthModal(message) {
  const modal = document.getElementById('authGateModal');
  const messageEl = document.getElementById('authGateMessage');
  
  if (!modal) {
    console.error('[AuthGate] Auth modal not found in DOM');
    // Fallback to redirect
    window.location.href = `auth/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return;
  }
  
  if (messageEl && message) {
    messageEl.textContent = message;
  }
  
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

/**
 * Closes the authentication modal
 */
export function closeAuthModal() {
  const modal = document.getElementById('authGateModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

/**
 * Executes a pending action after successful login
 * @param {Function} addToCartFn - Function to add item to cart
 * @param {Function} addToWishlistFn - Function to add item to wishlist
 * @returns {Promise<boolean>} True if action was executed, false if no pending action
 */
export async function executePendingAction(addToCartFn, addToWishlistFn) {
  const pendingAction = getPendingAction();
  
  if (!pendingAction) {
    console.log('[AuthGate] No pending action to execute');
    return false;
  }
  
  console.log('[AuthGate] Executing pending action:', pendingAction.type);
  
  try {
    switch (pendingAction.type) {
      case 'addToCart':
        if (addToCartFn) {
          await addToCartFn(pendingAction.data);
          console.log('[AuthGate] Cart action executed successfully');
        }
        break;
        
      case 'addToWishlist':
        if (addToWishlistFn) {
          await addToWishlistFn(pendingAction.data);
          console.log('[AuthGate] Wishlist action executed successfully');
        }
        break;
        
      case 'buyNow':
        // Redirect to checkout with product data
        const params = new URLSearchParams(pendingAction.data);
        window.location.href = `payment.html?${params.toString()}`;
        break;
        
      default:
        console.warn('[AuthGate] Unknown pending action type:', pendingAction.type);
    }
    
    clearPendingAction();
    return true;
  } catch (error) {
    console.error('[AuthGate] Error executing pending action:', error);
    clearPendingAction();
    throw error;
  }
}

/**
 * Initialize auth gate listeners on a page
 * Should be called after DOM is loaded
 */
export function initAuthGateListeners() {
  // Close modal when clicking outside
  const modal = document.getElementById('authGateModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeAuthModal();
      }
    });
  }
  
  // Close button
  const closeBtn = document.getElementById('authGateClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeAuthModal);
  }
  
  console.log('[AuthGate] Listeners initialized');
}
