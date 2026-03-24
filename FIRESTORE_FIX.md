# Fix Firestore Data Storage Issues

## Problem
Cannot store data in Firestore database after Google sign-up.

## Common Causes & Solutions

### 1. **Firestore Rules Have Expired (Test Mode)**

If you set up Firestore in "Test Mode", the rules expire after 30 days.

**Solution: Update Firestore Security Rules**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `bharat-museum-tickets`
3. Navigate to **Firestore Database** → **Rules**
4. Replace the existing rules with the content from `firestore.rules` file:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null && (request.auth.uid == userId || request.auth.token.role == 'admin');
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.token.role == 'admin';
    }
    
    // Bookings collection
    match /bookings/{bookingId} {
      allow read: if request.auth != null && (
        resource.data.userId == request.auth.uid || 
        request.auth.token.role == 'admin'
      );
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update: if request.auth != null && resource.data.userId == request.auth.uid;
      allow delete: if request.auth != null && request.auth.token.role == 'admin';
    }
    
    // Chat messages
    match /chats/{chatId} {
      allow read, write: if request.auth != null;
    }
    
    // Museums (public read)
    match /museums/{museumId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.role == 'admin';
    }
  }
}
```

5. Click **Publish**

### 2. **Check Browser Console for Errors**

1. Open your browser DevTools (F12)
2. Go to **Console** tab
3. Try to sign up with Google
4. Look for error messages like:
   - `FirebaseError: Missing or insufficient permissions`
   - `FirebaseError: PERMISSION_DENIED`
   - `Network error`

### 3. **Verify Firebase Configuration**

Check `client/.env.local` has correct values:

```env
VITE_FIREBASE_API_KEY=AIzaSyBINITF1HODJnUErqiM7O1iIZIAwB7bmwY
VITE_FIREBASE_AUTH_DOMAIN=bharat-museum-tickets.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bharat-museum-tickets
VITE_FIREBASE_STORAGE_BUCKET=bharat-museum-tickets.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=812485322044
VITE_FIREBASE_APP_ID=1:812485322044:web:d5fef4b65f27daa2436a39
VITE_FIREBASE_DATABASE_URL=https://bharat-museum-tickets-default-rtdb.asia-southeast1.firebasedatabase.app/
```

### 4. **Test the Fix**

1. **Restart the development server:**
   ```bash
   cd client
   npm run dev
   ```

2. **Clear browser cache and cookies**

3. **Try Google sign-up:**
   - Click "Continue with Google"
   - Select your Google account
   - Check browser console for logs:
     ```
     Google sign-in successful: [user-id]
     Checking if user exists in Firestore...
     Creating new user profile...
     New user profile created successfully
     ```

4. **Check Firestore Database:**
   - Go to Firebase Console → Firestore Database
   - Look for `users` collection
   - Your user document should be there with:
     ```javascript
     {
       uid: "...",
       email: "...",
       displayName: "...",
       photoURL: "...",
       role: "user",
       profileComplete: false,
       provider: "google",
       createdAt: timestamp,
       lastLogin: timestamp
     }
     ```

### 5. **If Still Not Working**

Enable detailed error logging by checking browser console. The updated code now logs:
- When Google sign-in succeeds
- When checking Firestore
- When creating/updating user profile
- Detailed error messages with error codes

### 6. **Quick Test Command**

Run this in browser console after trying to sign up:

```javascript
// Check if Firestore is initialized
console.log('Firestore:', window.firebase?.firestore());

// Check current user
console.log('Current user:', window.firebase?.auth().currentUser);
```

## Expected Behavior After Fix

1. ✅ Google sign-up completes successfully
2. ✅ User data saved to Firestore `users` collection
3. ✅ User redirected to `/complete-profile` page
4. ✅ Additional info (phone, gender, age, location) saved on form submit
5. ✅ `profileComplete` flag updated to `true`
6. ✅ User can access protected routes

## Still Having Issues?

Share the error message from browser console for specific help.
