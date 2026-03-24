# Database Migration Guide

## Overview

The application has been migrated to use Firebase services exclusively:

- **Firestore Database**: Stores user data and booking information
- **Realtime Database**: Stores chatbot conversation data

MongoDB is no longer required for this application.

## Database Architecture

### Firestore Collections (User & Booking Data)

#### 1. Users Collection (`users`)
```javascript
{
  userId: "user_1234567890_abc123",
  name: "John Doe",
  email: "john@example.com",
  password: "hashed_password",
  phone: "+1234567890",
  dateOfBirth: "1990-01-01",
  role: "user", // 'user' | 'admin' | 'museum'
  createdAt: "2026-01-14T10:30:00.000Z",
  updatedAt: "2026-01-14T10:30:00.000Z",
  lastLogin: "2026-01-14T10:30:00.000Z"
}
```

#### 2. Bookings Collection (`bookings`)
```javascript
{
  bookingId: "BM1736849400123",
  userId: "user_1234567890_abc123",
  userEmail: "john@example.com",
  userName: "John Doe",
  phone: "+1234567890",
  visitDate: "2026-02-15",
  timeSlot: "10:00 AM - 12:00 PM",
  numberOfTickets: 3,
  visitorType: "Adult", // 'Adult' | 'Child' | 'Senior' | 'Student'
  totalAmount: 600,
  status: "confirmed", // 'pending' | 'confirmed' | 'cancelled'
  createdAt: "2026-01-14T10:30:00.000Z",
  updatedAt: "2026-01-14T10:30:00.000Z"
}
```

### Realtime Database Structure (Chatbot Data)

```javascript
chatSessions/
  session_1234567890_abc123/
    messages/
      -Nx1234567890/
        from: "user"
        text: "I want to book tickets"
        timestamp: 1736849400000
      -Nx1234567891/
        from: "bot"
        text: "Sure! When would you like to visit?"
        intent: "booking_intent"
        booking_data: {...}
        timestamp: 1736849401000
    metadata/
      lastUpdated: 1736849401000
      messageCount: 2
```

## Changes Made

### Client-Side Changes

1. **Firebase Configuration** ([client/src/config/firebase.ts](client/src/config/firebase.ts))
   - Added Realtime Database import and initialization
   - Added `VITE_FIREBASE_DATABASE_URL` environment variable

2. **Chat Service** ([client/src/services/chatService.ts](client/src/services/chatService.ts))
   - Integrated Realtime Database for storing chat messages
   - Added `getChatHistory()` function to retrieve chat history
   - Messages are automatically saved to Realtime Database

3. **Auth Service** ([client/src/services/authService.ts](client/src/services/authService.ts))
   - Already using Firestore (no changes needed)

4. **Booking Service** ([client/src/services/bookingService.ts](client/src/services/bookingService.ts))
   - Already using Firestore (no changes needed)

5. **Environment Variables** ([client/.env.local](client/.env.local))
   - Added `VITE_FIREBASE_DATABASE_URL`

### Server-Side Changes

1. **Firebase Configuration** ([server/config/firebase.js](server/config/firebase.js))
   - Added Realtime Database initialization
   - Added `getRealtimeDatabase()` function
   - Added `databaseURL` to Firebase Admin initialization

2. **Auth Controller** ([server/controllers/authController.js](server/controllers/authController.js))
   - Migrated from MongoDB to Firestore
   - User registration and login now use Firestore

3. **Booking Controller** ([server/controllers/bookingController.js](server/controllers/bookingController.js))
   - Migrated from MongoDB to Firestore
   - All booking operations now use Firestore

4. **Chat Controller** ([server/controllers/chatController.js](server/controllers/chatController.js))
   - Integrated Realtime Database for chat history
   - Chat sessions are stored in Realtime Database

5. **Server Configuration** ([server/server.js](server/server.js))
   - Removed MongoDB connection
   - Removed mongoose dependency

6. **Environment Variables** ([server/.env](server/.env))
   - Removed `MONGODB_URI`
   - Added `FIREBASE_DATABASE_URL`

## Firebase Console Setup

### 1. Enable Firestore Database

1. Go to Firebase Console → Build → Firestore Database
2. Click "Create database"
3. Choose production mode (or test mode for development)
4. Select your preferred location
5. Click "Enable"

### 2. Enable Realtime Database

1. Go to Firebase Console → Build → Realtime Database
2. Click "Create database"
3. Choose production mode (or test mode for development)
4. Select your preferred location (should be same as Firestore)
5. Click "Enable"

### 3. Set Security Rules

#### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Bookings collection
    match /bookings/{bookingId} {
      allow read: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
    }
  }
}
```

#### Realtime Database Security Rules

```json
{
  "rules": {
    "chatSessions": {
      "$sessionId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

## Environment Variables Setup

### Client (.env.local)

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com
VITE_API_BASE_URL=http://localhost:5002/api
```

### Server (.env)

```env
PORT=5002
JWT_SECRET=your_jwt_secret_key_here
CHATBOT_ENGINE_URL=http://localhost:5001

FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account@your_project_id.iam.gserviceaccount.com
FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

## Migration Steps

### If You Have Existing MongoDB Data

1. **Export MongoDB Data**
   ```bash
   mongoexport --db bharat_museum --collection users --out users.json
   mongoexport --db bharat_museum --collection bookings --out bookings.json
   ```

2. **Import to Firestore**
   - Use Firebase Admin SDK or Firestore import tool
   - Or manually create a migration script

3. **Verify Data**
   - Check Firestore console to ensure all data is migrated

### Fresh Installation

1. Set up Firebase project (follow FIREBASE_SETUP.md)
2. Enable Firestore and Realtime Database
3. Configure environment variables
4. Install dependencies and run the application

## Benefits of This Architecture

1. **Firestore for User & Booking Data**
   - Strong consistency
   - Complex queries with indexes
   - ACID transactions
   - Better for structured data with relationships

2. **Realtime Database for Chatbot Data**
   - Real-time synchronization
   - Lower latency
   - Better for temporary session data
   - Simpler data structure for chat messages

3. **No MongoDB Required**
   - Reduced infrastructure complexity
   - No need to manage separate database server
   - Unified Firebase ecosystem
   - Better scaling with Firebase

## Troubleshooting

### Common Issues

1. **Firestore Rules Error**
   - Ensure security rules are properly configured
   - Check that authenticated users have proper permissions

2. **Realtime Database Connection Error**
   - Verify `FIREBASE_DATABASE_URL` is correct
   - Check Firebase console to ensure Realtime Database is enabled

3. **Authentication Issues**
   - Ensure Firebase Admin SDK credentials are correct
   - Check that `FIREBASE_PRIVATE_KEY` is properly escaped

## Support

For issues or questions, refer to:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Guide](https://firebase.google.com/docs/firestore)
- [Realtime Database Guide](https://firebase.google.com/docs/database)
