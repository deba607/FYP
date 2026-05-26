from typing import Dict, Any, List
import re
from chatterbot import ChatBot
from chatterbot.trainers import ListTrainer
from .intent_classifier import IntentClassifier
from .booking_handler import BookingHandler
import os
import csv
import requests
import json

class MuseumAssistant:
    def __init__(self):
        # Create ChatterBot instance with minimal dependencies
        self.chatbot = ChatBot(
            'MuseumBot',
            storage_adapter='chatterbot.storage.SQLStorageAdapter',
            database_uri='sqlite:///museum_bot.db',
            logic_adapters=[
                {
                    'import_path': 'chatterbot.logic.BestMatch',
                    'default_response': 'I am here to help you with museum information and ticket bookings. Could you please rephrase your question?',
                    'maximum_similarity_threshold': 0.70
                }
            ],
            read_only=True  # Prevent writing after training
        )
        
        # Load museum data from CSV
        self.museums_data = self.load_museums_from_csv()
        
        # Train the bot with museum-specific conversations
        self.train_bot()
        
        self.sessions = {}
        self.intent_classifier = IntentClassifier()
        self.booking_handler = BookingHandler()
        # Simple in-memory user store for chatbot-driven signup/signin (development use only)
        self.users = {}

    def load_museums_from_csv(self):
        """Load museum data from CSV file"""
        museums = []
        csv_path = os.path.join(os.path.dirname(__file__), 'indian museum dataset.csv')

        def make_id(name: str, idx: int) -> str:
            if not name:
                return f"museum_{idx}"
            slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
            return slug or f"museum_{idx}"

        try:
            with open(csv_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for i, row in enumerate(reader, start=1):
                    name = (row.get('Museum Name') or row.get('Museum') or '').strip()
                    location = (row.get('City/Location') or row.get('City') or row.get('Location') or '').strip()
                    state = (row.get('State/UT') or row.get('State') or '').strip()
                    category = (row.get('Category/Type') or row.get('Category') or '').strip()
                    # Price may not exist in the CSV; fall back to sensible default
                    price_raw = (row.get('Price') or row.get('price') or '').strip()
                    try:
                        price = float(price_raw) if price_raw else 200.0
                    except ValueError:
                        price = 200.0

                    museum = {
                        'museum_id': make_id(name, i),
                        'name': name,
                        'state': state,
                        'location': location,
                        'category': category,
                        'price': price,
                        'raw': row
                    }
                    museums.append(museum)
        except FileNotFoundError:
            print(f"Warning: CSV file not found at {csv_path}")

        return museums

    def train_bot(self):
        """Train the chatbot with museum-specific conversations"""
        trainer = ListTrainer(self.chatbot)
        
        # Museum hours training
        trainer.train([
            "What are the museum timings?",
            "The museum is open from 9 AM to 6 PM every day except Mondays.",
            "When does the museum open?",
            "The museum opens at 9 AM.",
            "What time does the museum close?",
            "The museum closes at 6 PM.",
            "Is the museum open on Monday?",
            "No, the museum is closed on Mondays."
        ])
        
        # Location training
        trainer.train([
            "Where is the museum located?",
            "Bharat Museum is located at National Museum Complex, New Delhi.",
            "What is the museum address?",
            "Our address is National Museum Complex, New Delhi.",
            "How to reach the museum?",
            "We are located at National Museum Complex in New Delhi. You can reach us by metro or taxi."
        ])
        
        # Ticket prices training
        trainer.train([
            "What are the ticket prices?",
            "Ticket prices are: Adult ₹200, Child ₹100, Senior ₹150, Student ₹120.",
            "How much does a ticket cost?",
            "Adult tickets cost ₹200, Child tickets are ₹100, Senior tickets are ₹150, and Student tickets are ₹120.",
            "What is the price for children?",
            "Child tickets cost ₹100.",
            "What is the adult ticket price?",
            "Adult tickets cost ₹200.",
            "Do you have student discounts?",
            "Yes! Student tickets are available for ₹120.",
            "How much for senior citizens?",
            "Senior citizen tickets cost ₹150."
        ])
        
        # Exhibits training
        trainer.train([
            "What exhibits do you have?",
            "We have a rich collection of Indian art, historical artifacts, sculptures, paintings, and cultural heritage items spanning centuries.",
            "Tell me about the collections",
            "Our museum showcases Indian art collections, ancient civilizations artifacts, and cultural heritage exhibits.",
            "What can I see at the museum?",
            "You can explore art collections, historical artifacts, sculptures, paintings, and various cultural exhibitions."
        ])
        
        # Train with Indian Museums data
        self.train_indian_museums_data(trainer)
        
        # General queries
        trainer.train([
            "Hello",
            "Hello! Welcome to Bharat Museum. How can I assist you today?",
            "Hi",
            "Hi! I'm here to help you with museum information and ticket bookings. What would you like to know?",
            "Thank you",
            "You're welcome! Feel free to ask if you need anything else.",
            "Thanks",
            "My pleasure! Is there anything else I can help you with?"
        ])
        
        # Booking related
        trainer.train([
            "I want to book tickets",
            "I'd be happy to help you book tickets! Let me collect some information. What date would you like to visit? Please provide the date in YYYY-MM-DD format.",
            "Can I book tickets online?",
            "Yes! I can help you book tickets right here. Would you like to proceed with a booking?",
            "How do I book tickets?",
            "I can help you book tickets through our conversation. Just let me know when you'd like to visit!"
        ])

        # Signup / Signin training
        trainer.train([
            "I want to sign up",
            "Sure — I can help create an account. What's your email address?",
            "I want to register",
            "No problem. To register, please provide your email address.",
            "I want to sign in",
            "Okay — please provide your email to sign in.",
            "I want to log in",
            "Please provide your email and password to log in."
        ])

        # Search tickets / museums
        trainer.train([
            "Find a ticket for National Museum",
            "I found National Museum in New Delhi. Would you like details or to book tickets?",
            "Search ticket for Salar Jung Museum",
            "Salar Jung Museum is in Hyderabad. Would you like to know timings, price, or book tickets?",
            "Show me tickets",
            "Which museum or city are you interested in?"
        ])

        # Payment / confirmation training
        trainer.train([
            "How do I pay",
            "You can pay online here. Would you like to proceed to payment now?",
            "Pay now",
            "I'll take you to the payment step. Please confirm the booking to proceed.",
            "Confirm booking",
            "Please confirm and I'll initiate the payment flow for your booking."
        ])

    def train_indian_museums_data(self, trainer):
        """Train chatbot with Indian museums data from CSV"""
        
        # Group museums by state
        states = {}
        categories = {}
        
        for museum in self.museums_data:
            state = museum.get('state', '') or museum.get('State/UT', '')
            name = museum.get('name', '') or museum.get('Museum Name', '')
            city = museum.get('location', '') or museum.get('City/Location', '')
            category = museum.get('category', '') or museum.get('Category/Type', '')
            
            if state not in states:
                states[state] = []
            states[state].append((name, city, category))
            
            if category not in categories:
                categories[category] = []
            categories[category].append((name, city, state))
        
        # Train state-wise queries
        for state, museums_list in list(states.items())[:20]:  # Train first 20 states
            if museums_list:
                museum_names = ", ".join([m[0] for m in museums_list[:3]])
                trainer.train([
                    f"What museums are in {state}?",
                    f"In {state}, we have museums like {museum_names}."
                ])
                trainer.train([
                    f"Museums in {state}",
                    f"Notable museums in {state} include {museum_names}."
                ])
        
        # Train category-wise queries
        category_samples = {
            'Art': 'We have several art museums across India including galleries in major cities.',
            'Archaeology': 'Archaeological museums showcase ancient artifacts and historical treasures.',
            'Science': 'Science museums offer interactive exhibits and learning experiences.',
            'History': 'History museums preserve our rich cultural heritage and past.',
            'Military': 'Military museums display India\'s defense heritage and valor.'
        }
        
        for cat, response in category_samples.items():
            trainer.train([
                f"Tell me about {cat} museums",
                response
            ])
            trainer.train([
                f"Do you have {cat} museums?",
                f"Yes! {response}"
            ])
        
        # Train with popular museums
        popular_museums = [
            ("National Museum", "New Delhi", "History/Art", "The National Museum in New Delhi is one of the largest museums in India with collections spanning 5,000 years of Indian history."),
            ("Indian Museum", "Kolkata", "Multi-purpose", "The Indian Museum in Kolkata is the oldest museum in India, established in 1814."),
            ("Salar Jung Museum", "Hyderabad", "Art/Antiques", "Salar Jung Museum in Hyderabad houses one of the world's largest one-man collections of antiques."),
            ("Chhatrapati Shivaji Maharaj Vastu Sangrahalaya", "Mumbai", "History/Art", "CSMVS in Mumbai is a premier museum showcasing art, archaeology and natural history."),
            ("Victoria Memorial Hall", "Kolkata", "History/Art", "Victoria Memorial Hall in Kolkata is a magnificent marble building housing British Raj era artifacts.")
        ]
        
        for name, city, cat, desc in popular_museums:
            trainer.train([
                f"Tell me about {name}",
                desc
            ])
            trainer.train([
                f"What is {name}?",
                f"{name} is located in {city}. {desc}"
            ])

        # Train QA pairs per museum to improve knowledge and booking prompts
        for museum in self.museums_data:
            name = museum.get('name', '').strip()
            city = museum.get('location', '').strip()
            state = museum.get('state', '').strip()
            category = museum.get('category', '').strip()
            price = museum.get('price', 200)
            if not name:
                continue

            # Short description
            desc = f"{name} is located in {city}, {state}. It is categorized as {category}."

            # Knowledge responses
            trainer.train([
                f"Tell me about {name}",
                desc
            ])
            trainer.train([
                f"Where is {name} located?",
                f"{name} is located in {city}, {state}."
            ])
            trainer.train([
                f"What is the category of {name}?",
                f"{name} is a {category} museum."
            ])
            trainer.train([
                f"How much is a ticket for {name}?",
                f"A general ticket for {name} costs ₹{int(price)}. Discounts may apply for students and seniors."
            ])

            # Booking prompts
            trainer.train([
                f"I want to book tickets for {name}",
                f"Sure — I can help you book tickets for {name}. What date would you like to visit? Please provide the date in YYYY-MM-DD format."
            ])
            trainer.train([
                f"Book tickets for {name}",
                f"Okay, how many tickets would you like for {name}, and which visitor category (Adult, Student, Senior, Children)?"
            ])

    def get_or_create_session(self, session_id: str):
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "booking_data": {},
                "in_booking_flow": False
            }
        return self.sessions[session_id]

    def process_message(self, message: str, session_id: str = "default") -> Dict[str, Any]:
        session = self.get_or_create_session(session_id)
        
        # Classify intent
        intent = self.intent_classifier.classify(message)
        # --- Signup flow ---
        if intent == "signup" or session.get("in_signup_flow"):
            # Start signup
            if not session.get("in_signup_flow"):
                session["in_signup_flow"] = True
                session["temp_user"] = {}
                return {"message": "Great — let's create your account. What's your email address?", "intent": "signup", "booking_data": session.get("booking_data", {})}

            temp = session.get("temp_user", {})
            # If email not provided yet
            if not temp.get("email"):
                email_match = re.search(r"[\w\.-]+@[\w\.-]+", message)
                if email_match:
                    temp["email"] = email_match.group()
                    session["temp_user"] = temp
                    return {"message": "Thanks. Now please provide a password for your new account.", "intent": "signup", "booking_data": session.get("booking_data", {})}
                else:
                    return {"message": "I couldn't detect an email. Please send your email address (e.g., you@example.com).", "intent": "signup", "booking_data": session.get("booking_data", {})}

            # If password not provided
            if not temp.get("password"):
                # very simple password capture (dev only)
                pwd = message.strip()
                if len(pwd) < 4:
                    return {"message": "Please provide a password with at least 4 characters.", "intent": "signup", "booking_data": session.get("booking_data", {})}
                temp["password"] = pwd
                # Try to create user via server API
                api_base = os.environ.get('CHATBOT_API_URL') or 'http://localhost:3000'
                try:
                    resp = requests.post(f"{api_base}/api/auth/signup", json={"name": temp.get("email",""), "email": temp["email"], "password": pwd, "phone": ""}, timeout=10)
                    data = resp.json()
                    if resp.status_code in (200,201) and data.get('success'):
                        token = data.get('token')
                        session["user"] = {"email": temp["email"], "token": token}
                        session["in_signup_flow"] = False
                        session.pop("temp_user", None)
                        return {"message": f"Account created successfully for {temp['email']}. You are now signed in.", "intent": "signup", "booking_data": session.get("booking_data", {})}
                    else:
                        # server-side error
                        session["in_signup_flow"] = False
                        session.pop("temp_user", None)
                        msg = data.get('message') or 'Signup failed on server.'
                        return {"message": msg, "intent": "signup", "booking_data": session.get("booking_data", {})}
                except Exception:
                    # fallback to local store
                    self.users[temp["email"]] = temp["password"]
                    session["user"] = {"email": temp["email"]}
                    session["in_signup_flow"] = False
                    session.pop("temp_user", None)
                    return {"message": f"Account created locally for {temp['email']}. You are now signed in.", "intent": "signup", "booking_data": session.get("booking_data", {})}

        # --- Signin flow ---
        if intent == "signin" or session.get("in_signin_flow"):
            if not session.get("in_signin_flow"):
                session["in_signin_flow"] = True
                session["temp_user"] = {}
                return {"message": "Sure — please provide your email to sign in.", "intent": "signin", "booking_data": session.get("booking_data", {})}

            temp = session.get("temp_user", {})
            if not temp.get("email"):
                email_match = re.search(r"[\w\.-]+@[\w\.-]+", message)
                if email_match:
                    temp["email"] = email_match.group()
                    session["temp_user"] = temp
                    return {"message": "Please provide your password.", "intent": "signin", "booking_data": session.get("booking_data", {})}
                else:
                    return {"message": "I couldn't detect an email. Please send your email address.", "intent": "signin", "booking_data": session.get("booking_data", {})}

            if not temp.get("password"):
                pwd = message.strip()
                temp["password"] = pwd
                # Try server-side login first
                api_base = os.environ.get('CHATBOT_API_URL') or 'http://localhost:3000'
                try:
                    resp = requests.post(f"{api_base}/api/auth/login", json={"email": temp.get("email"), "password": pwd}, timeout=10)
                    data = resp.json()
                    session["in_signin_flow"] = False
                    session.pop("temp_user", None)
                    if resp.status_code == 200 and data.get('success'):
                        token = data.get('token')
                        session["user"] = {"email": temp.get("email"), "token": token}
                        return {"message": f"Signed in successfully as {temp['email']}.", "intent": "signin", "booking_data": session.get("booking_data", {})}
                    else:
                        # fallback to local check
                        stored = self.users.get(temp["email"])
                        if stored and stored == pwd:
                            session["user"] = {"email": temp["email"]}
                            return {"message": f"Signed in locally as {temp['email']}.", "intent": "signin", "booking_data": session.get("booking_data", {})}
                        return {"message": data.get('message') or 'Sign in failed — email or password incorrect.', "intent": "signin", "booking_data": session.get("booking_data", {})}
                except Exception:
                    # fallback to local validate
                    session["in_signin_flow"] = False
                    session.pop("temp_user", None)
                    stored = self.users.get(temp["email"])
                    if stored and stored == pwd:
                        session["user"] = {"email": temp["email"]}
                        return {"message": f"Signed in locally as {temp['email']}.", "intent": "signin", "booking_data": session.get("booking_data", {})}
                    return {"message": "Sign in failed — unable to reach auth server and local credentials not available.", "intent": "signin", "booking_data": session.get("booking_data", {})}

        # --- Search ticket / museum ---
        if intent == "search_ticket":
            results = self.find_museums(message)
            if not results:
                return {"message": "I couldn't find matching museums. Try using a museum name or city.", "intent": "search_ticket", "booking_data": session.get("booking_data", {})}
            # Build response with top 3
            lines = []
            for m in results[:5]:
                lines.append(f"{m['name']} — {m['location']}, {m['state']} — ₹{int(m.get('price',200))}")
            return {"message": "\n".join(lines), "intent": "search_ticket", "booking_data": session.get("booking_data", {})}

        # --- Confirm / Payment ---
        if intent in ["confirm_booking", "payment"]:
            booking = session.get("booking_data", {})
            if booking.get("ready_to_confirm"):
                # Attempt to create booking via server API
                api_base = os.environ.get('CHATBOT_API_URL') or 'http://localhost:3000'
                payload = {
                    "name": booking.get("name") or session.get("user", {}).get("email") or booking.get("email") or "Guest",
                    "email": booking.get("email") or session.get("user", {}).get("email") or "",
                    "phone": booking.get("phone") or "",
                    "visitDate": booking.get("date") or booking.get("visitDate") or booking.get("visit_date"),
                    "timeSlot": booking.get("time_slot") or booking.get("timeSlot"),
                    "numberOfTickets": int(booking.get("tickets") or booking.get("numberOfTickets") or 1),
                    "visitorType": booking.get("visitor_type") or booking.get("visitorType") or "Adult",
                    "museumName": booking.get("museumName") or booking.get("museum_name") or None,
                    "museumLocation": booking.get("museumLocation") or booking.get("museum_location") or None
                }

                headers = {"Content-Type": "application/json"}
                token = session.get("user", {}).get("token")
                if token:
                    headers["Authorization"] = f"Bearer {token}"

                try:
                    resp = requests.post(f"{api_base}/api/bookings", json=payload, headers=headers, timeout=10)
                    data = resp.json()
                    if resp.status_code in (200,201) and data.get('success'):
                        session["booking_data"] = data.get('booking') or {}
                        return {"message": f"Payment successful ✅. Your booking id is {data.get('booking', {}).get('bookingId', 'N/A')}. Enjoy your visit!", "intent": "payment", "booking_data": session.get('booking_data')}
                    else:
                        # If server returns an error, gracefully fallback to a local simulated booking
                        import time
                        booking_id = f"BK{int(time.time())}"
                        booking = session.get('booking_data', {}) or {}
                        booking["booking_id"] = booking_id
                        booking["confirmed"] = False
                        session["booking_data"] = booking
                        server_msg = data.get('message') if isinstance(data, dict) else None
                        msg_detail = f" Server message: {server_msg}." if server_msg else ""
                        return {"message": f"Payment simulated ✅. Your booking id is {booking_id}.{msg_detail} (Server booking failed)", "intent": "payment", "booking_data": session.get('booking_data')}
                except Exception:
                    # Fallback to local simulated booking id
                    import time
                    booking_id = f"BK{int(time.time())}"
                    booking["booking_id"] = booking_id
                    booking["confirmed"] = True
                    session["booking_data"] = booking
                    return {"message": f"Payment simulated ✅. Your booking id is {booking_id}. (Server unavailable)", "intent": "payment", "booking_data": booking}
            else:
                return {"message": "There is no booking ready to confirm. Would you like to start a booking?", "intent": "payment", "booking_data": session.get("booking_data", {})}
        
        # Check if we're in booking flow or starting one
        if intent in ["book_ticket", "check_availability"] or session["in_booking_flow"]:
            session["in_booking_flow"] = True
            
            booking_response = self.booking_handler.handle(
                message, 
                session["booking_data"]
            )
            
            if booking_response.get("complete"):
                # Booking data is complete
                session["in_booking_flow"] = False
                response = f"{booking_response['message']}\n\n{self.format_booking_summary(session['booking_data'])}\n\nWould you like to confirm this booking?"
                session["booking_data"]["ready_to_confirm"] = True
            else:
                response = booking_response["message"]
                session["booking_data"] = booking_response.get("booking_data", {})
        else:
            # Use ChatterBot for general queries
            response = str(self.chatbot.get_response(message))
        
        return {
            "message": response,
            "intent": intent,
            "booking_data": session.get("booking_data", {})
        }

    def format_booking_summary(self, booking_data: Dict) -> str:
        """Format booking data into a readable summary"""
        summary = "📋 Booking Summary:\n"
        if booking_data.get("date"):
            summary += f"📅 Date: {booking_data['date']}\n"
        if booking_data.get("time_slot"):
            summary += f"🕐 Time: {booking_data['time_slot']}\n"
        if booking_data.get("tickets"):
            summary += f"🎫 Tickets: {booking_data['tickets']}\n"
        if booking_data.get("visitor_type"):
            summary += f"👤 Type: {booking_data['visitor_type']}\n"
            # Calculate price
            prices = {"Adult": 200, "Child": 100, "Senior": 150, "Student": 120}
            total = prices.get(booking_data['visitor_type'], 200) * int(booking_data['tickets'])
            summary += f"💰 Total: ₹{total}\n"
        return summary

    def reset_session(self, session_id: str):
        """Reset a specific session"""
        if session_id in self.sessions:
            del self.sessions[session_id]

    def find_museums(self, query: str) -> List[Dict[str, Any]]:
        """Simple fuzzy search over loaded museum data"""
        q = query.lower()
        results = []
        for m in self.museums_data:
            name = (m.get('name') or '').lower()
            city = (m.get('location') or '').lower()
            state = (m.get('state') or '').lower()
            category = (m.get('category') or '').lower()
            score = 0
            if q in name:
                score += 5
            if q in city:
                score += 3
            if q in state:
                score += 2
            # keyword matches
            for token in q.split():
                if token in name:
                    score += 1
                if token in category:
                    score += 1

            if score > 0:
                results.append((score, m))

        # sort by score desc
        results.sort(key=lambda x: x[0], reverse=True)
        return [r[1] for r in results]
