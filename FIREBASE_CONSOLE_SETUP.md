# Firebase Console Setup Guide

## Critical Steps to Fix Current Errors

### 1. Add Authorized Domains (Fixes CORS Errors)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **bharat-museum-tickets**
3. Navigate to **Authentication** → **Settings** → **Authorized domains**
4. Add these domains:
   - `localhost`
   - `127.0.0.1`
   - `localhost:5173` (if needed)
5. Click **Add domain**

### 2. Enable Firestore Database (Fixes "Client Offline" Errors)
1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for development)
4. Select your preferred location (e.g., `us-central`)
5. Click **Enable**

**Test Mode Rules** (automatically set, valid for 30 days):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 1, 18);
    }
  }
}
```

### 3. Configure Google Sign-In
1. Go to **Authentication** → **Sign-in method**
2. Click on **Google** provider
3. Toggle **Enable**
4. Add your support email (required by Google)
5. Click **Save**

### 4. Verify Email/Password is Enabled
1. In **Authentication** → **Sign-in method**
2. Ensure **Email/Password** is enabled
3. If not, click on it and enable

### 5. Check API Restrictions
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **bharat-museum-tickets**
3. Navigate to **APIs & Services** → **Credentials**
4. Find your API key (starts with `AIzaSyB...`)
5. Click **Edit**
6. Under **Application restrictions**, select:
   - **HTTP referrers (web sites)**
   - Add: `http://localhost:5173/*`
   - Add: `http://127.0.0.1:5173/*`
7. Under **API restrictions**, ensure these are enabled:
   - Identity Toolkit API
   - Cloud Firestore API
8. Click **Save**

## After Configuration

1. **Restart your development server:**
   ```powershell
   cd client
   npm run dev
   ```

2. **Clear browser cache** or open in **Incognito mode** to avoid cached CORS errors

3. **Test authentication:**
   - Try Email/Password sign-up first (less restrictive)
   - Then test Google Sign-In

## Troubleshooting

### If CORS errors persist:
- Use the redirect method instead of popup:
  ```typescript
  import { signInWithGoogleRedirect } from './services/authService';
  
  // Use this instead of signInWithGoogle
  await signInWithGoogleRedirect();
  ```

### If "Client is offline" errors persist:
- Check browser console for Firestore initialization errors
- Verify your API key has Firestore API enabled
- Check network tab for failed requests

### If popup is blocked:
- Allow popups for localhost in browser settings
- Or use the redirect method (already implemented)

## Production Security Rules (Update before deploying)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Bookings collection
    match /bookings/{bookingId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
  }
}
```
