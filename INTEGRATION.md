# Bharat Museum Tickets - Integration Guide

## Architecture

The system consists of three main components:

### 1. **Client** (React + TypeScript + Vite)
- **Port:** 5173 or 5174
- **Tech Stack:** React 18, TypeScript, Tailwind CSS, Vite
- **Location:** `/client`

### 2. **Server** (Node.js + Express)
- **Port:** 5000
- **Tech Stack:** Express, MongoDB, Mongoose
- **Location:** `/server`
- **Purpose:** Database operations, booking management, user authentication

### 3. **Chatbot Engine** (Python + Flask + LangChain)
- **Port:** 5001
- **Tech Stack:** Flask, LangChain, OpenAI GPT-3.5
- **Location:** `/chatbot-engine`
- **Purpose:** AI-powered conversational assistant for ticket booking

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+
- MongoDB (local or cloud)
- OpenAI API Key

### 1. Setup Client
```bash
cd client
npm install
npm run dev
```

### 2. Setup Server
```bash
cd server
npm install

# Configure .env file
# Edit server/.env and add:
# - MongoDB connection string
# - JWT secret
# - Chatbot engine URL

npm run dev
```

### 3. Setup Chatbot Engine
```bash
cd chatbot-engine
pip install -r requirements.txt

# Configure .env file
# Edit chatbot-engine/.env and add:
# - OpenAI API key
# - Server URL

python app.py
```

## Data Flow

```
User → Client (React)
        ↓
        sends message
        ↓
Client → Server (/api/chat/message)
        ↓
        forwards to chatbot
        ↓
Server → Chatbot Engine (/chat)
        ↓
        processes with AI
        ↓
Chatbot Engine → Server (response)
        ↓
        when booking complete
        ↓
Server → Database (creates booking)
        ↓
        confirmation
        ↓
Server → Client (booking details)
        ↓
Client → User (displays confirmation)
```

## API Endpoints

### Client → Server
- **POST** `/api/chat/message` - Send chat message
- **POST** `/api/chat/reset` - Reset chat session
- **POST** `/api/bookings` - Create new booking
- **GET** `/api/bookings` - Get all bookings
- **POST** `/api/bookings/check-availability` - Check ticket availability

### Server → Chatbot Engine
- **POST** `/chat` - Process chat message
- **POST** `/reset` - Reset session
- **GET** `/health` - Health check

## Environment Variables

### Client (.env)
```env
VITE_API_URL=http://localhost:5000
```

### Server (.env)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/bharat_museum
JWT_SECRET=your_secret_key_here
CHATBOT_ENGINE_URL=http://localhost:5001
```

### Chatbot Engine (.env)
```env
PORT=5001
OPENAI_API_KEY=your_openai_api_key_here
NODE_SERVER_URL=http://localhost:5000
```

## Features Implemented

✅ **Conversational Ticket Booking**
- Step-by-step data collection
- Natural language understanding
- Date, time slot, ticket count, visitor type extraction

✅ **Museum Information**
- Timings, prices, location
- Exhibits and collections info
- Discount information

✅ **Booking Management**
- Create bookings with unique IDs
- Check availability
- Store in MongoDB

✅ **User Authentication**
- JWT-based auth
- Signup/Login endpoints
- Password hashing with bcrypt

✅ **Real-time Chat Interface**
- Modal chat window
- Message history
- Loading states
- Quick suggestion buttons

## Ticket Pricing
- **Adult**: ₹200
- **Child**: ₹100
- **Senior**: ₹150
- **Student**: ₹120

## Time Slots
- Morning: 9 AM - 12 PM
- Afternoon: 12 PM - 3 PM
- Evening: 3 PM - 6 PM

## Capacity
- Maximum 100 tickets per time slot

## Testing the Integration

1. **Start all services** (Client, Server, Chatbot Engine)
2. Open browser to `http://localhost:5173` or `http://localhost:5174`
3. Click "Ask Museum Guide" or floating chat button
4. Try these test messages:
   - "I want to book tickets"
   - "What are the museum timings?"
   - "How much do tickets cost?"
   - "Book 2 adult tickets for tomorrow morning"

## Troubleshooting

### Client cannot connect to server
- Ensure server is running on port 5000
- Check CORS settings in server.js
- Verify API_BASE_URL in client/src/services/api.ts

### Server cannot connect to chatbot
- Ensure chatbot-engine is running on port 5001
- Check CHATBOT_ENGINE_URL in server/.env
- Verify Flask app is accessible

### Chatbot errors
- Check OpenAI API key is valid
- Ensure sufficient API credits
- Check Python dependencies are installed

### MongoDB connection issues
- Ensure MongoDB is running
- Check connection string in server/.env
- Verify database permissions

## Next Steps

1. ✅ Add OpenAI API key to chatbot-engine/.env
2. ✅ Set up MongoDB database
3. ✅ Test booking flow end-to-end
4. 🔲 Add payment gateway integration
5. 🔲 Add email confirmation for bookings
6. 🔲 Add booking history page
7. 🔲 Add admin dashboard
8. 🔲 Deploy to production
