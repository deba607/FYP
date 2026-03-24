# Firebase Setup Instructions

## Overview
Firebase is integrated for authentication (Google & Email/Password) and Firestore database for bookings.

## Setup Steps

### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name: `bharat-museum` (or your preferred name)
4. Disable Google Analytics (optional)
5. Click "Create Project"

### 2. Enable Authentication
1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Email/Password** provider
3. Enable **Google** provider
   - Add your support email
   - Add authorized domains (localhost is already included for development)

### 3. Create Firestore Database
1. Go to **Firestore Database** in Firebase Console
2. Click "Create database"
3. Select **Start in test mode** (for development)
4. Choose your Cloud Firestore location (closest to your users)
5. Click "Enable"

### 4. Get Firebase Configuration
1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps" section
3. Click the **Web** icon (</>)
4. Register your app with a nickname (e.g., "Bharat Museum Web")
5. Copy the `firebaseConfig` object

### 5. Configure Environment Variables
1. Open `client/.env.local` file
2. Replace the placeholder values with your actual Firebase config:

```env
VITE_FIREBASE_API_KEY=your_actual_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 6. Install Firebase SDK
```bash
cd client
npm install firebase
```

### 7. Firestore Security Rules (Optional - for production)
In Firebase Console, go to **Firestore Database** > **Rules** and update:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read/write their own bookings
    match /bookings/{bookingId} {
      allow read: if request.auth != null && 
                     (resource.data.userId == request.auth.uid || 
                      request.auth.token.admin == true);
      allow create: if request.auth != null && 
                       request.resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && 
                               resource.data.userId == request.auth.uid;
    }
  }
}
```

## Features Implemented

### Authentication
- ✅ Email/Password Sign Up
- ✅ Email/Password Sign In  
- ✅ Google Sign In
- ✅ Sign Out
- ✅ User Profile Storage in Firestore
- ✅ Auth State Management with React Context

### Database (Firestore)
- ✅ User profiles collection
- ✅ Bookings collection
- ✅ Create/Read bookings
- ✅ Check availability
- ✅ Update booking status
- ✅ Cancel bookings

## File Structure
```
client/src/
├── config/
│   └── firebase.ts              # Firebase initialization
├── context/
│   └── AuthContext.tsx          # Auth state management
├── services/
│   ├── authService.ts          # Auth functions
│   └── bookingService.ts       # Firestore booking functions
├── pages/
│   ├── Login.tsx               # Login page
│   └── SignUp.tsx              # Sign up page
└── .env.local                  # Environment variables
```

## Usage Examples

### Using Auth in Components
```tsx
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { currentUser, userProfile, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  
  if (!currentUser) return <div>Please sign in</div>;
  
  return <div>Welcome, {userProfile?.displayName}!</div>;
}
```

### Creating a Booking
```tsx
import { createBooking, generateBookingId } from '../services/bookingService';
import { useAuth } from '../context/AuthContext';

function BookingForm() {
  const { currentUser, userProfile } = useAuth();
  
  const handleSubmit = async (formData) => {
    const bookingId = await createBooking({
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: userProfile.displayName,
      visitDate: formData.date,
      timeSlot: formData.timeSlot,
      numberOfTickets: formData.tickets,
      visitorType: formData.visitorType,
      totalAmount: formData.total,
      bookingId: generateBookingId(),
      status: 'pending'
    });
    
    console.log('Booking created:', bookingId);
  };
}
```

## Testing

### Test Accounts
For development, you can create test accounts:
1. Sign Up with email: test@example.com, password: test123
2. Sign In with Google (use your personal Google account for testing)

### Test Firestore
1. Go to Firestore Database in Firebase Console
2. You should see collections automatically created when users sign up and create bookings
3. View user profiles in `users` collection
4. View bookings in `bookings` collection

## Production Checklist
- [ ] Update Firestore security rules
- [ ] Add Firebase app check
- [ ] Configure authorized domains in Firebase Console
- [ ] Use production Firebase project
- [ ] Set up environment variables in production
- [ ] Enable billing in Firebase (for production scale)
- [ ] Set up Firebase hosting (optional)
- [ ] Configure CORS settings

## Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"
- Make sure `.env.local` file exists with correct variables
- Restart the development server after updating `.env.local`

### "Permission denied" errors in Firestore
- Check your Firestore security rules
- Make sure user is authenticated before accessing data
- For development, you can use test mode (allows all reads/writes)

### Google Sign-In not working
- Verify Google provider is enabled in Firebase Console
- Check authorized domains in Firebase Authentication settings
- Ensure redirect URIs are configured correctly

## Support
For issues with Firebase setup, refer to:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Auth Guide](https://firebase.google.com/docs/auth/web/start)
- [Firestore Guide](https://firebase.google.com/docs/firestore/quickstart)
