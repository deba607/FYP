# Chatbot Integration - Complete Setup

## ✅ Integration Status

All three tiers of the Bharat Museum Tickets system are now fully integrated:

### 1. **Python Chatbot Engine** (Port 5001)
- Flask server with ChatterBot
- Endpoint: `http://localhost:5001/chat`
- Handles natural language processing
- Maintains conversation sessions

### 2. **Node.js Backend Server** (Port 5002)
- Express server with Firebase integration
- Proxy endpoints:
  - `POST /api/chat/message` - Send messages to chatbot
  - `POST /api/chat/reset` - Reset chat session
- Forwards requests to Python chatbot engine
- API URL: `http://localhost:5002`

### 3. **React Client** (Port 5174)
- TypeScript/React with Vite
- Chatbot UI at `/booking/chat`
- Local: `http://localhost:5174/`

## 🔧 Architecture

```
Client (React)
    ↓ HTTP Request
Backend Server (Node.js/Express)
    ↓ Proxy Request
Chatbot Engine (Python/Flask)
    ↓ ChatterBot Processing
Backend Server
    ↓ JSON Response
Client (UI Update)
```

## 📁 New Files Created

### Client-Side
- **`client/src/services/chatService.ts`**
  - `sendChatMessage()` - Send messages to backend
  - `resetChatSession()` - Reset conversation
  - `getSessionId()` - Session management
  - Automatic error handling

### Updated Files
- **`client/src/booking/BookingWithChatBot.tsx`**
  - Real-time chat interface
  - Loading states and error handling
  - Auto-scroll to latest message
  - Session reset functionality
  - Timestamp display
  - Connected to backend API

## 🚀 How to Use

### Start All Services

1. **Start Chatbot Engine:**
   ```powershell
   cd chatbot-engine
   py app.py
   ```

2. **Start Backend Server:**
   ```powershell
   cd server
   node server.js
   ```

3. **Start Client:**
   ```powershell
   cd client
   npm run dev
   ```

### Test the Integration

1. Open browser: `http://localhost:5174/booking/chat`
2. Type a message like:
   - "What are the ticket prices?"
   - "What time does the museum open?"
   - "I want to book tickets for 2 adults"
3. The chatbot will respond through the integrated system

## 🔌 API Endpoints

### Backend Chatbot Proxy

**Send Message:**
```http
POST http://localhost:5002/api/chat/message
Content-Type: application/json

{
  "message": "What are the museum timings?",
  "session_id": "session_123"
}
```

**Response:**
```json
{
  "success": true,
  "response": "The museum is open from 10 AM to 6 PM daily...",
  "intent": "museum_timings",
  "booking_data": null
}
```

**Reset Session:**
```http
POST http://localhost:5002/api/chat/reset
Content-Type: application/json

{
  "session_id": "session_123"
}
```

## 🎨 Features

### Chat Interface
- ✅ Real-time message exchange
- ✅ Loading indicators
- ✅ Error handling
- ✅ Auto-scroll to latest message
- ✅ Message timestamps
- ✅ Session persistence
- ✅ Reset conversation button
- ✅ Disabled state during loading
- ✅ Enter key to send
- ✅ Responsive design

### Backend Integration
- ✅ Session management with unique IDs
- ✅ Automatic session storage
- ✅ Error recovery
- ✅ CORS enabled for local development
- ✅ Environment variable configuration

### Chatbot Engine
- ✅ ChatterBot integration
- ✅ Museum-specific training data
- ✅ Intent recognition
- ✅ Booking data extraction
- ✅ Multi-session support

## 🔍 Testing

### Quick Test via Terminal
```powershell
# Test chatbot engine directly
Invoke-RestMethod -Uri http://localhost:5001/chat -Method POST -ContentType "application/json" -Body '{"message":"Hello","session_id":"test"}'

# Test through backend proxy
Invoke-RestMethod -Uri http://localhost:5002/api/chat/message -Method POST -ContentType "application/json" -Body '{"message":"Hello","session_id":"test"}'
```

### Test via Browser Console
```javascript
// Test from browser console (on localhost:5174)
fetch('http://localhost:5002/api/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What are ticket prices?',
    session_id: 'test_123'
  })
})
.then(r => r.json())
.then(console.log);
```

## 🐛 Troubleshooting

### Chatbot not responding
- Check if Python chatbot is running on port 5001
- Verify `CHATBOT_ENGINE_URL` in server/.env
- Check browser console for errors

### CORS errors
- Ensure CORS is enabled in chatbot-engine/app.py
- Check backend server is proxying correctly
- Clear browser cache

### Session not persisting
- Check sessionStorage in browser DevTools
- Verify session_id is being sent in requests
- Check backend logs for session handling

## 📊 Environment Variables

### Client (.env.local)
```env
VITE_API_BASE_URL=http://localhost:5002/api
```

### Server (.env)
```env
CHATBOT_ENGINE_URL=http://localhost:5001
```

## 🎯 Next Steps

- [ ] Add typing indicator animation
- [ ] Add message delivery status
- [ ] Implement message history persistence
- [ ] Add file/image upload support
- [ ] Add voice input capability
- [ ] Implement chatbot suggestions/quick replies
- [ ] Add analytics for chat interactions

## ✨ Summary

The chatbot is now **fully integrated** with:
- ✅ Real Python ChatterBot backend processing
- ✅ Node.js proxy layer for API management
- ✅ React UI with modern chat interface
- ✅ Session management across all layers
- ✅ Error handling and loading states
- ✅ All three tiers communicating successfully

**Access the integrated chatbot at:** http://localhost:5174/booking/chat
