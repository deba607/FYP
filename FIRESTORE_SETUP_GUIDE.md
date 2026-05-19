# 🔥 Fix: Cloud Firestore Database Setup

## ⚠️ The Error
```
Cloud Firestore database not found. Enable Firestore in Firebase console or set FIREBASE_DATABASE_ID correctly.
```

**Root Cause:** Cloud Firestore database has not been created in your Firebase project.

---

## ✅ SOLUTION - 3 Simple Steps

### Step 1: Open Firebase Console

Go to your Firebase project:
```
https://console.firebase.google.com/project/bharat-museum-tickets/firestore
```

You'll see one of these:
- "Get started" button
- "Create database" button
- An empty Firestore section

---

### Step 2: Create a Firestore Database

**Click "Create database"** (or "Get started")

You'll see these options:

#### **Option A: Production Mode (Recommended for this project)**
- Select: **Production mode**
- Rules file exists: ✅ `firestore.rules`

#### **Option B: Test Mode (Easier for development)**
- Select: **Test mode**
- Auto-generates test rules (expires in 30 days)

**Choose based on your preference** (we'll show both below)

---

### Step 3: Select Region

A dialog will ask: **"Where should we host your database?"**

**Choose the closest region to India:**
- **firebase-asia-south1** (Mumbai) ← BEST
- asia-southeast1 (Singapore)
- us-central1 (USA)

⚠️ **IMPORTANT**: Once created, region CANNOT be changed!

---

## 📋 Next: Deploy Security Rules

After database is created, deploy these rules:

### For Production Mode:
1. In Firebase Console, click **"Rules"** tab
2. Copy this content:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth.uid == userId;
       }
       match /bookings/{bookingId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
3. Click **"Publish"**
4. Done! ✅

### For Test Mode:
- Rules auto-generated (no action needed)
- Valid for 30 days, then requires manual setup

---

## 🧪 Test Your Setup

After Firestore is created:

### 1. Restart Development Server
```powershell
cd client
npm run dev
```

### 2. Visit Signup Page
```
http://localhost:3000/signup
```

### 3. Try Google Signup
- Click "Continue with Google"
- Complete profile details
- Submit form

### 4. Check for Success Message
You should see:
```
✅ Profile completed successfully. Redirecting to home...
```

### 5. Verify Data in Firebase
1. Go to Firebase Console → Firestore Database → Data
2. Should see collections like:
   - `users`
   - `bookings`
   - etc.

---

## 🔍 Verify Setup is Complete

### In Firebase Console:

**✅ Firestore Database tab should show:**
- Tabs: Data, Rules, Indexes, Usage
- A list of collections (users, bookings, etc.)
- NOT "Get started" or "Create database"

**✅ Rules tab should show:**
- Your security rules published
- Green status indicator

### In Browser Console:

1. Open browser DevTools (F12)
2. Go to Console tab
3. You should NOT see errors like:
   - "Firestore database not found"
   - "PERMISSION_DENIED"
   - "offline"

---

## 🚀 API Authorization Setup

Make sure these are enabled in Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **bharat-museum-tickets**
3. Navigate to **APIs & Services** → **APIs**
4. Ensure **enabled**:
   - Cloud Firestore API
   - Identity Toolkit API
   - Cloud Storage API

---

## 🆘 Troubleshooting

### "Still getting Firestore database not found error"
- [ ] Refresh browser (Ctrl + Shift + R)
- [ ] Check database exists in Firebase console
- [ ] Verify `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in `.env` is `bharat-museum-tickets`
- [ ] Wait 2-3 minutes after creating database
- [ ] Restart dev server: `npm run dev`

### "PERMISSION_DENIED" error
- [ ] Check security rules in Firebase console
- [ ] Make sure you're signed in with Google
- [ ] For test mode: confirm it's active (green indicator)

### "Cannot read properties of undefined (reading '_document')"
- [ ] Firestore database exists but not fully initialized
- [ ] Restart dev server
- [ ] Clear browser cache (Ctrl + Shift + Delete)

### "Quota exceeded" error
- [ ] You're in test mode and quota reset daily
- [ ] Switch to production mode with proper rules
- [ ] Or wait 24 hours for quota to reset

---

## 📊 Current Configuration

Your app is configured to use:

| Setting | Value |
|---------|-------|
| Project ID | `bharat-museum-tickets` |
| Region | `asia-south1` (Mumbai) |
| Database | `default` |
| Auth | Google + Email/Password |

---

## 🎯 What Happens After Setup

### User Flow:
1. ✅ User signs up with Google
2. ✅ Data saved to Firestore `users` collection
3. ✅ User completes profile details
4. ✅ Data updated in Firestore
5. ✅ Redirects to home page
6. ✅ On next login → goes directly home

### Database Structure:
```
firestore
├── users/
│   ├── {userId}
│   │   ├── name
│   │   ├── email
│   │   ├── phone
│   │   ├── address
│   │   ├── photoURL
│   │   └── profileCompleted
│   └── ...
├── bookings/
│   ├── {bookingId}
│   │   ├── userId
│   │   ├── visitDate
│   │   ├── numberOfTickets
│   │   └── ...
│   └── ...
```

---

## 💾 Save These Links

- **Firebase Console**: https://console.firebase.google.com/project/bharat-museum-tickets
- **Firestore**: https://console.firebase.google.com/project/bharat-museum-tickets/firestore
- **Authentication**: https://console.firebase.google.com/project/bharat-museum-tickets/authentication

---

## ✨ All Set!

After completing these steps, your Firestore database will be ready and all authentication flows will work perfectly.

**Questions?** Check the error message and match it to the troubleshooting section above.
