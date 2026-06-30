# Deploy Firestore Rules - Required for Notification Persistence

## Problem
The notification badge count is not persisting because the Firestore security rules don't allow access to the `adminNotificationState` collection yet.

## Solution
You need to deploy the updated `firestore.rules` file to your Firebase project.

---

## Option 1: Deploy via Firebase Console (Easiest)

1. **Open Firebase Console**
   - Go to: https://console.firebase.google.com/
   - Select your project (AURA Shop)

2. **Navigate to Firestore Rules**
   - Click on **Firestore Database** in the left sidebar
   - Click on the **Rules** tab at the top

3. **Update the Rules**
   - Copy the contents of the `firestore.rules` file from your project
   - Paste it into the Firebase Console rules editor
   - Click **Publish** button

4. **Verify**
   - Refresh your admin panel
   - Mark some notifications as read
   - Refresh the page
   - The count should now persist!

---

## Option 2: Deploy via Firebase CLI

1. **Login to Firebase** (if not already logged in)
   ```bash
   firebase login
   ```

2. **Initialize Firebase** (if not already done)
   ```bash
   firebase init
   ```
   - Select your existing Firebase project
   - Choose Firestore when prompted
   - Use existing `firestore.rules` file

3. **Deploy Only Firestore Rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

4. **Verify**
   - Refresh your admin panel
   - Mark some notifications as read
   - Refresh the page
   - The count should now persist!

---

## What Changed

Added the following rule to `firestore.rules`:

```javascript
// ── ADMIN NOTIFICATION STATE ──────────────────────────────────────────────
match /adminNotificationState/{adminId} {
  // Admins can read and write their own notification state
  allow read, write: if isOwner(adminId) && isAdmin();
}
```

This allows admin users to save and retrieve their notification read states.

---

## Testing After Deployment

1. Open the admin panel: http://localhost:5000/admin/
2. Check the notification bell (should show a count, e.g., 15)
3. Open the browser console (F12)
4. Click on 2 notifications to mark them as read
5. Check the console logs - you should see:
   ```
   [Notifications] Marking as read: order_new_...
   [Notifications] Saving read state: {...}
   [Notifications] Saved successfully
   ```
6. Refresh the page (F5)
7. Check the console logs - you should see:
   ```
   [Notifications] Loading notifications...
   [Notifications] Read state from Firebase: {...}
   [Notifications] Fresh notifications count: 15
   [Notifications] Unread count: 13
   ```
8. The badge should show 13 (not 15) ✅

---

## Troubleshooting

### If you see "permission-denied" errors in console:
- Make sure you deployed the rules successfully
- Verify you're logged in as an admin user
- Check the Firebase Console Rules tab to confirm the new rule is there

### If count still resets after refresh:
- Open browser console (F12) and check for errors
- Look for the console logs mentioned above
- If you see "Error getting notification read state", the rules weren't deployed

### If nothing changes:
- Hard refresh the page (Ctrl + Shift + R or Cmd + Shift + R)
- Clear browser cache
- Check Firebase Console > Firestore Database > Data
  - You should see a new collection called `adminNotificationState`
  - Under it, your admin user ID with a document containing `readNotifications` object
