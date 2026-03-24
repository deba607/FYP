# Complete Chatbot Booking System - User Guide

## 🎯 Overview

The Bharat Museum chatbot can now handle **complete end-to-end ticket booking** through natural conversation! Users can book tickets by simply chatting with the bot.

## ✨ Features

### Conversational Booking Flow
The chatbot guides users through a complete booking process:

1. **Date Selection** - When would you like to visit?
2. **Time Slot** - Choose from available time slots
3. **Ticket Quantity** - How many tickets (1-10)?
4. **Visitor Type** - Adult, Child, Senior, or Student
5. **Contact Information** - Name and email for confirmation
6. **Booking Confirmation** - Submit and receive booking ID

### Smart Natural Language Understanding

The chatbot understands multiple ways to express the same thing:

#### Date Formats
- **ISO Format**: "2025-12-20", "2025-01-15"
- **Natural Language**: "December 20", "Dec 20", "20 December"
- **Relative**: "today", "tomorrow"

#### Time Preferences
- **Specific**: "10 AM", "12 PM", "2 PM", "4 PM"
- **General**: "morning", "afternoon", "evening"
- **Numeric**: "10", "12", "2", "4"

#### Ticket Quantity
- **Numbers**: "2", "5", "10"
- **Words**: "one", "two", "three", "four", "five"

#### Visitor Types
- **Adult**: "adult", "regular", "grown-up"
- **Child**: "child", "kid", "minor"
- **Senior**: "senior", "elderly", "old age"
- **Student**: "student", "college", "school"

## 🎫 How to Book Tickets

### Step-by-Step Example

1. **Start Booking**
   ```
   You: "I want to book tickets"
   Bot: "I'd be happy to help you book tickets! 🎫
         When would you like to visit? Please provide a date..."
   ```

2. **Provide Date**
   ```
   You: "December 25, 2025"
   Bot: "Great! I've noted 2025-12-25 as your visit date. 📅
         Which time slot would you prefer?
         • 10:00 AM
         • 12:00 PM
         • 2:00 PM
         • 4:00 PM"
   ```

3. **Choose Time**
   ```
   You: "2 PM"
   Bot: "Perfect! ⏰ 2:00 PM time slot selected.
         How many tickets would you like to book? (1-10)"
   ```

4. **Specify Quantity**
   ```
   You: "3 tickets"
   Bot: "Noted! 🎫 3 ticket(s).
         What type of visitor are you?
         • Adult (₹200)
         • Child (₹100)
         • Senior (₹150)
         • Student (₹120)"
   ```

5. **Select Visitor Type**
   ```
   You: "Adult"
   Bot: "Excellent! 👤 Adult ticket(s) selected.
         💰 Total Amount: ₹600
         
         📋 Booking Summary:
         📅 Date: 2025-12-25
         🕐 Time: 2:00 PM
         🎫 Tickets: 3
         👤 Type: Adult
         💰 Total: ₹600
         
         Would you like to confirm this booking?"
   ```

6. **Confirm with Contact Info**
   
   A form appears asking for:
   - Full Name
   - Email Address
   
   Fill in your details and click "Confirm Booking"

7. **Booking Confirmed!**
   ```
   Bot: "🎉 Booking confirmed! Your booking ID is: BK-123456789
         You will receive a confirmation email at your@email.com. 
         See you at the museum!"
   ```
   
   🎊 Confetti animation plays!

## 💬 Sample Conversations

### Quick Booking
```
You: book tickets for tomorrow at 10 AM, 2 adult tickets
Bot: [Processes all info] Great! Let me confirm...
     [Shows booking summary]
```

### Casual Conversation
```
You: hey, can i visit the museum next week?
Bot: Of course! When would you like to visit?
You: how about Friday?
Bot: Could you provide the full date? (e.g., December 22, 2025)
You: December 22
Bot: Great! Which time slot? [Shows options]
```

### Information Queries
```
You: What are the ticket prices?
Bot: Ticket prices are: Adult ₹200, Child ₹100, Senior ₹150, Student ₹120.

You: When is the museum open?
Bot: The museum is open from 9 AM to 6 PM every day except Mondays.

You: I want to book tickets
Bot: I'd be happy to help! When would you like to visit?
```

## 🎨 UI Features

### Chat Interface
- **Auto-scroll** to latest message
- **Timestamps** on all messages
- **Loading indicators** ("Typing...")
- **Multi-line messages** with proper formatting
- **Emoji support** 🎫📅⏰

### Contact Form
- Appears automatically when booking info is complete
- **Name validation** - Required field
- **Email validation** - Must be valid format
- **Visual feedback** - Icons and colors
- **Disabled state** - Prevents double submission

### Reset Function
- **Clear conversation** - Start fresh
- **Reset booking data** - Clear all collected info
- **New session** - Generate new session ID
- Click the refresh icon (↻) in the header

## 🔧 Technical Details

### API Integration
- **Backend Proxy**: Node.js server forwards requests
- **Chatbot Engine**: Python Flask with ChatterBot
- **Session Management**: Unique session IDs in browser storage
- **Booking API**: Submits to existing booking endpoint

### Data Flow
```
User Input
    ↓
React UI (BookingWithChatBot.tsx)
    ↓
Chat Service (chatService.ts)
    ↓
Node.js Backend (/api/chat/message)
    ↓
Python Chatbot Engine (ChatterBot)
    ↓
Booking Handler (Extract info)
    ↓
Response back through chain
    ↓
UI displays message + form
    ↓
User confirms with contact info
    ↓
Submit Booking API (/api/bookings)
    ↓
MongoDB + Firestore storage
    ↓
Confirmation with Booking ID
```

### Session Persistence
- **SessionStorage**: Maintains session ID during browser tab lifetime
- **Booking Context**: Tracks collected information across messages
- **State Management**: React hooks manage UI state

## 🚀 Access the Chatbot

1. **Navigate to**: http://localhost:5174/booking/chat
2. **Or click**: "Ticket Booking With ChatBot" card on booking page

## 🐛 Troubleshooting

### Bot not responding
- Check all three services are running:
  - Python chatbot: Port 5001
  - Node.js server: Port 5002
  - React client: Port 5174
- Check browser console for errors
- Try resetting the conversation

### Booking not submitting
- Verify name and email are filled
- Check email format is valid (contains @ and .)
- Check backend server logs
- Ensure MongoDB is running

### Date not recognized
- Use clear format: "2025-12-25" or "December 25"
- Avoid ambiguous formats
- Try "tomorrow" for next day

### Session lost
- Don't close browser tab during booking
- Session resets when clicking reset button
- Complete booking in one session

## 💡 Tips for Best Experience

1. **Be specific** - "2 adult tickets for December 25 at 2 PM" works great
2. **Use numbers** - "2" is clearer than "couple"
3. **Include year** - "December 25, 2025" is better than just "December 25"
4. **One thing at a time** - Let the bot guide you through each step
5. **Read messages** - Bot provides clear instructions at each step

## 📊 Pricing

- **Adult**: ₹200 per ticket
- **Child**: ₹100 per ticket
- **Senior**: ₹150 per ticket
- **Student**: ₹120 per ticket

## 🎯 Future Enhancements

- [ ] Group booking discounts
- [ ] Special exhibition packages
- [ ] Multi-language support
- [ ] Voice input/output
- [ ] Image recognition for visitor type
- [ ] Calendar integration
- [ ] WhatsApp/SMS notifications
- [ ] Payment gateway integration
- [ ] Guided tour bookings

## ✅ Summary

The chatbot provides a **complete, user-friendly booking experience** that:
- ✅ Understands natural language
- ✅ Guides users step-by-step
- ✅ Collects all required information
- ✅ Validates user inputs
- ✅ Confirms bookings with unique IDs
- ✅ Stores in database (MongoDB + Firestore)
- ✅ Works alongside traditional booking form

**Start chatting and book your museum visit today!** 🎨🏛️
