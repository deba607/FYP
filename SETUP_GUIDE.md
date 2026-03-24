# Bharat Museum Tickets - Setup & Installation Guide

## 📋 Prerequisites

- Node.js (v18 or higher)
- Python (v3.8 or higher)
- npm or yarn
- Firebase account (with Firestore and Realtime Database enabled)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Bharat_Museum_Tickets
```

### 2. Setup Environment Variables

#### Client Setup
```bash
cd client
cp .env.example .env
```
Edit `.env` and add your Firebase Web SDK credentials from Firebase Console.

#### Server Setup
```bash
cd ../server
cp .env.example .env
```
Edit `.env` and:
1. Generate a strong JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Add Firebase Admin SDK credentials
3. Update other configuration values

#### Chatbot Engine Setup
```bash
cd ../chatbot-engine
cp .env.example .env
```
Edit `.env` as needed (defaults should work for development).

### 3. Install Dependencies

#### Client
```bash
cd client
npm install
```

#### Server
```bash
cd ../server
npm install
```

#### Chatbot Engine
```bash
cd ../chatbot-engine
pip install -r requirements.txt
```

### 4. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable Firestore Database
4. Enable Realtime Database
5. Enable Authentication (Email/Password and Google)
6. Download service account key (for server)
7. Get Web SDK config (for client)

### 5. Run the Application

Open **3 separate terminal windows**:

#### Terminal 1 - Client (React + Vite)
```bash
cd client
npm run dev
```
Runs on: http://localhost:5173

#### Terminal 2 - Server (Node.js + Express)
```bash
cd server
npm run dev
```
Runs on: http://localhost:5002

#### Terminal 3 - Chatbot Engine (Python + Flask)
```bash
cd chatbot-engine
python app.py
```
Runs on: http://localhost:5001

### 6. Access the Application

Open your browser and navigate to: http://localhost:5173

## 🔒 Security Notes

### Important: Before Production

1. **JWT Secret**: MUST be changed to a strong random value
2. **Firebase Credentials**: Keep service account keys secure
3. **Environment Variables**: Never commit `.env` files
4. **CORS**: Update `CLIENT_URL` in server `.env` to production URL
5. **Rate Limiting**: Review and adjust limits based on your needs

## 📦 Production Build

### Client Build
```bash
cd client
npm run build
```
Output in `client/dist/`

### Server Production
```bash
cd server
npm start
```

### Chatbot Production
```bash
cd chatbot-engine
# Set FLASK_ENV=production in .env
python app.py
```

## 🧪 Testing

### Test Rate Limiting
```bash
# Make rapid requests to any endpoint
curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```

### Test Validation
```bash
# Send invalid data
curl -X POST http://localhost:5002/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-email","tickets":0}'
```

## 📁 Project Structure

```
Bharat_Museum_Tickets/
├── client/              # React + TypeScript frontend
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components (lazy loaded)
│   │   ├── config/      # Firebase & API config
│   │   ├── services/    # API services
│   │   └── context/     # React context
│   └── .env.example     # Environment template
│
├── server/              # Node.js + Express backend
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Auth, validation, rate limiting
│   ├── routes/          # API routes
│   ├── config/          # Firebase Admin config
│   ├── utils/           # Utility functions
│   └── .env.example     # Environment template
│
├── chatbot-engine/      # Python + Flask chatbot
│   ├── chatbot/         # Chatbot logic
│   │   ├── museum_assistant.py
│   │   ├── intent_classifier.py
│   │   └── booking_handler.py
│   └── .env.example     # Environment template
│
└── OPTIMIZATION_SUMMARY.md  # Detailed optimization docs
```

## 🔧 Troubleshooting

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5173 | xargs kill -9
```

### Firebase Connection Issues
1. Check if credentials in `.env` are correct
2. Verify Firebase project is active
3. Check if Firestore/Realtime DB are enabled
4. Ensure Firebase Security Rules allow access

### Module Not Found Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Chatbot Errors
```bash
# Reinstall Python dependencies
pip install -r requirements.txt --force-reinstall
```

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev)
- [Express Documentation](https://expressjs.com)
- [Flask Documentation](https://flask.palletsprojects.com)

## 🆘 Support

For issues and questions:
1. Check `OPTIMIZATION_SUMMARY.md` for detailed documentation
2. Review error logs in terminal
3. Check Firebase Console for database/auth issues

## ✅ Completed Optimizations

- ✅ Security improvements (no hardcoded credentials)
- ✅ Environment variable validation
- ✅ Rate limiting on all endpoints
- ✅ Input validation middleware
- ✅ React lazy loading and code splitting
- ✅ Error boundaries for better UX
- ✅ Axios interceptors with timeout
- ✅ Comprehensive error handling
- ✅ CORS configuration
- ✅ Logging system

## 📝 License

[Your License Here]

---

**Happy Coding! 🎉**
