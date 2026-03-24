# 🔥 ENABLE FIRESTORE DATABASE

## The Error You're Seeing:
```
FirebaseError: Failed to get document because the client is offline.
Error code: unavailable
```

This error means **Firestore Database is NOT enabled** in your Firebase project.

## ✅ Solution - Enable Firestore Database:

### Step 1: Go to Firebase Console
Open this link in your browser:
```
https://console.firebase.google.com/project/bharat-museum-tickets/firestore
```

### Step 2: Create Database
You will see either:
- "Get Started" button, OR
- "Create Database" button

Click it!

### Step 3: Choose Start Mode
Select: **"Start in production mode"**
- We already have security rules in `firestore.rules`
- Don't worry about test mode

### Step 4: Select Location
Choose the closest region to India:
- **asia-south1** (Mumbai) - RECOMMENDED
- OR asia-southeast1 (Singapore)

⚠️ **IMPORTANT**: You CANNOT change the location later!

### Step 5: Click "Enable"
Wait 30-60 seconds for Firestore to be provisioned.

### Step 6: Publish Security Rules
After database is created:
1. Click on "Rules" tab
2. Replace all content with rules from `firestore.rules`
3. Click "Publish"

### Step 7: Test Again
1. Go back to http://localhost:5173/signup
2. Try signing up with Google again
3. Fill the form and submit
4. Check browser console for ✅ success messages

---

## 📋 Quick Checklist:
- [ ] Firestore Database created
- [ ] Region selected (asia-south1)
- [ ] Security rules published
- [ ] Tested sign-up flow

---

## 🆘 Still Having Issues?

**Check if Firestore is enabled:**
1. Go to Firebase Console → Firestore Database
2. You should see "Cloud Firestore" with tabs: Data, Rules, Indexes, Usage
3. NOT "Get Started" or "Create Database"

**Check your Firebase config:**
- Open browser DevTools (F12)
- Console should show:
  ```
  🔧 Firebase Config Check:
  API Key: ✅ Present
  Project ID: bharat-museum-tickets
  🔥 Firestore initialized: ✅
  ```

**Check authentication:**
- Make sure you signed in with Google successfully
- Check console for: "✅ Google authentication successful"
