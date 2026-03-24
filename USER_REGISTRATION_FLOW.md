# User Registration Flow

## Two-Step Registration Process

### Method 1: Google Sign-Up (Two Steps)

#### Step 1: Google Authentication
When user clicks "Continue with Google":
1. Firebase returns basic user data:
   - `uid` - Unique user ID
   - `email` - Google email
   - `displayName` - Full name from Google
   - `photoURL` - Profile picture URL
   - `emailVerified` - true

2. System creates initial user profile in Firestore:
```javascript
{
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  photoURL: user.photoURL,
  role: 'user',
  profileComplete: false,  // ⚠️ Incomplete profile
  provider: 'google',
  createdAt: timestamp,
  lastLogin: timestamp
}
```

#### Step 2: Complete Profile
User is redirected to `/complete-profile` page to provide:
- **Phone Number** (required)
- **Gender** (required)
- **Age** (required)
- **Location** (required)

After submission, profile is updated:
```javascript
{
  phoneNumber: "1234567890",
  gender: "male",
  age: 25,
  location: "Mumbai",
  profileComplete: true  // ✅ Profile complete
}
```

---

### Method 2: Email Sign-Up (One Step)

User provides all information in single form:
- Full Name
- Email
- Phone Number
- Gender
- Age
- Location
- Password
- Confirm Password

System creates complete profile immediately:
```javascript
{
  uid: user.uid,
  email: user.email,
  displayName: displayName,
  phoneNumber: phoneNumber,
  gender: gender,
  age: age,
  location: location,
  role: 'user',
  profileComplete: true,  // ✅ Already complete
  provider: 'email',
  createdAt: timestamp,
  lastLogin: timestamp
}
```

---

## User Entity Attributes (Firestore Database)

Based on your ER diagram, the complete User document includes:

| Field | Type | Source | Required |
|-------|------|--------|----------|
| uid | string | Firebase Auth | Yes |
| email | string | Firebase Auth / Form | Yes |
| displayName | string | Google / Form | Yes |
| photoURL | string | Google (optional) | No |
| phoneNumber | string | User Input | Yes |
| gender | string | User Input | Yes |
| age | number | User Input | Yes |
| location | string | User Input | Yes |
| role | string | System (default: 'user') | Yes |
| profileComplete | boolean | System | Yes |
| provider | string | System ('google' or 'email') | Yes |
| createdAt | timestamp | Firestore | Yes |
| lastLogin | timestamp | Firestore | Yes |

---

## Protected Routes Logic

The system checks profile completion before allowing access to protected routes:

```javascript
// Check in ProtectedRoute component (App.tsx)
if (user is logged in && profile is NOT complete && provider is 'google') {
  → Redirect to /complete-profile
}

if (user is NOT logged in) {
  → Redirect to /login
}

Otherwise {
  → Allow access to protected content
}
```

**Protected Routes:**
- `/booking/*` - All booking pages
- `/admin` - Admin dashboard

**Public Routes:**
- `/` - Landing page
- `/login` - Login page
- `/signup` - Sign up page
- `/features` - Features page
- `/pricing` - Pricing page
- `/contact` - Contact page
- `/about-us` - About us page

---

## User Journey Example

### Google Sign-Up Journey:
1. User visits `/login` or `/signup`
2. Clicks "Continue with Google"
3. Google authentication popup appears
4. User selects Google account
5. Firebase returns user data (email, name, photo)
6. System creates incomplete profile (`profileComplete: false`)
7. User is redirected to `/complete-profile`
8. User fills: Phone, Gender, Age, Location
9. User submits form
10. Profile updated with `profileComplete: true`
11. User redirected to `/` (home page)
12. Can now access all protected routes

### Email Sign-Up Journey:
1. User visits `/signup`
2. Fills all fields in single form
3. Submits registration
4. System creates complete profile (`profileComplete: true`)
5. User redirected to `/` (home page)
6. Can immediately access all protected routes

---

## Implementation Files

- **authService.ts** - Handles Firebase auth and Firestore operations
- **AuthContext.tsx** - Manages authentication state globally
- **CompleteProfile.tsx** - Profile completion page for Google users
- **SignUp.tsx** - Registration page with all fields for email users
- **Login.tsx** - Login page with Google/Email options
- **App.tsx** - Routes and ProtectedRoute logic
