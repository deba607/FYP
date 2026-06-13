from typing import Dict, Any, List
import re
import difflib
from chatterbot import ChatBot
from chatterbot.trainers import ListTrainer
from .intent_classifier import IntentClassifier
from .booking_handler import BookingHandler
import os
import requests
import logging
from pathlib import Path
import time


logger = logging.getLogger(__name__)

class MuseumAssistant:
    def __init__(self):
        self.db_path = Path(__file__).resolve().parent.parent / 'museum_bot_firestore.db'

        # Create ChatterBot instance with minimal dependencies
        self.chatbot = self._create_chatbot()
        
        # Load museum data from the Next.js API, which reads Firestore museums.
        self.museums_data = self.load_museums_from_firestore_api()
        
        # Train the bot with museum-specific conversations
        try:
            self.train_bot()
        except Exception as err:
            if self._is_database_corruption_error(err):
                logger.warning("Detected corrupted chatbot database, rebuilding: %s", self.db_path)
                self._reset_chatbot_database()
                self.chatbot = self._create_chatbot()
                try:
                    self.train_bot()
                except Exception as second_err:
                    if not self._is_database_corruption_error(second_err):
                        raise

                    # If stale processes keep the old DB locked, switch to a fresh DB file.
                    recovered_name = f"museum_bot_recovered_{int(time.time())}.db"
                    self.db_path = self.db_path.with_name(recovered_name)
                    logger.warning("Using fresh chatbot database due to locked/corrupted DB files: %s", self.db_path)
                    self.chatbot = self._create_chatbot()
                    self.train_bot()
            else:
                raise
        
        self.sessions = {}
        self.intent_classifier = IntentClassifier()
        self.booking_handler = BookingHandler()
        # Simple in-memory user store for chatbot-driven signup/signin (development use only)
        self.users = {}

    def _create_chatbot(self) -> ChatBot:
        db_uri = f"sqlite:///{self.db_path.as_posix()}"
        return ChatBot(
            'MuseumBot',
            storage_adapter='chatterbot.storage.SQLStorageAdapter',
            database_uri=db_uri,
            logic_adapters=[
                {
                    'import_path': 'chatterbot.logic.BestMatch',
                    'default_response': 'I am here to help you with museum information and ticket bookings. Could you please rephrase your question?',
                    'maximum_similarity_threshold': 0.70
                }
            ],
            read_only=True  # Prevent writing after training
        )

    def _is_database_corruption_error(self, err: Exception) -> bool:
        error_text = str(err).lower()
        return "database disk image is malformed" in error_text or "malformed" in error_text

    def _reset_chatbot_database(self) -> None:
        for suffix in ("", "-wal", "-shm"):
            file_path = Path(f"{self.db_path}{suffix}")
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception as delete_err:
                logger.warning("Failed to remove corrupted DB file %s: %s", file_path, delete_err)

    def load_museums_from_firestore_api(self):
        """Load museum data from the Firestore-backed Next.js API."""
        museums = []
        api_base = os.environ.get('CHATBOT_API_URL') or 'http://localhost:3000'
        try:
            response = requests.get(f"{api_base}/api/museums", timeout=10)
            response.raise_for_status()
            payload = response.json()
            for row in payload.get("museums", []):
                name = str(row.get("name") or "").strip()
                if not name:
                    continue
                price_raw = row.get("price", 200)
                try:
                    price = float(price_raw)
                except (TypeError, ValueError):
                    price = 200.0
                museums.append({
                    "museum_id": str(row.get("museum_id") or row.get("id") or "").strip(),
                    "name": name,
                    "state": str(row.get("state") or "").strip(),
                    "location": str(row.get("location") or "").strip(),
                    "category": str(row.get("category") or "").strip(),
                    "description": str(row.get("description") or "").strip(),
                    "price": price,
                    "prices": row.get("prices") or {},
                    "raw": row,
                })
        except Exception as err:
            logger.warning("Unable to load Firestore museums from %s/api/museums: %s", api_base, err)

        return museums

    def refresh_museums_from_firestore_api(self) -> None:
        """Refresh museum data so chatbot search reflects current Firestore records."""
        museums = self.load_museums_from_firestore_api()
        if museums:
            self.museums_data = museums

    def normalize_place_text(self, value: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()

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
            "Please tell me the museum name, and I will look up its location from the Firestore museum catalog.",
            "What is the museum address?",
            "Please provide the museum name so I can share the address from the Firestore museum catalog.",
            "How to reach the museum?",
            "Please choose a museum from the catalog first, then I can help with its location details."
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
            "Find a ticket for a museum",
            "Please share the museum name or city. I will search only the Firestore museum catalog.",
            "Search ticket for a museum",
            "Please provide the museum name. I will check whether it exists in the Firestore museum catalog.",
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
        """Train chatbot only with museums loaded from the Firestore-backed API."""
        
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
        
        # Train category-wise queries using only categories present in Firestore.
        for category, museums_list in list(categories.items())[:20]:
            if not category or not museums_list:
                continue
            museum_names = ", ".join([m[0] for m in museums_list[:3] if m[0]])
            response = f"In the Firestore catalog, {category} museums include {museum_names}." if museum_names else f"I do not have named {category} museums in the Firestore catalog yet."
            trainer.train([
                f"Tell me about {category} museums",
                response
            ])
            trainer.train([
                f"Do you have {category} museums?",
                response
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

    def process_message(self, message: str, session_id: str = "default", language: str = "en") -> Dict[str, Any]:
        session = self.get_or_create_session(session_id)
        session["language"] = language
        self.refresh_museums_from_firestore_api()
        
        # Classify intent
        intent = self.intent_classifier.classify(message)
        if self.is_museum_list_query(message):
            intent = "search_museums"

        # --- Search Museums flow ---
        if intent == "search_museums" or session.get("in_search_museums_flow"):
            session["in_search_museums_flow"] = True
            loc = self.extract_location(message)
            if loc:
                results = self.get_museums_by_location(loc)
                session["in_search_museums_flow"] = False
                session["waiting_for_location"] = False
                if results:
                    lines = []
                    for m in results:
                        lines.append(f"{m['name']} — {m['location']}, {m['state']} — ₹{int(m.get('price', 200))}")
                    response = "\n".join(lines)
                    response = self.format_museum_list_response(loc, results, language)
                else:
                    response = "I couldn't find any museums in that location. Please specify a different city or state/UT in India."
                
                return {
                    "message": response,
                    "intent": "search_museums",
                    "booking_data": session.get("booking_data", {})
                }
            else:
                if session.get("waiting_for_location"):
                    session["in_search_museums_flow"] = False
                    session["waiting_for_location"] = False
                    response = "I couldn't find any museums in that location. Please specify a different city or state/UT in India."
                    return {
                        "message": response,
                        "intent": "search_ticket",
                        "booking_data": session.get("booking_data", {})
                    }
                else:
                    session["waiting_for_location"] = True
                    response = "Sure! Which city or state/UT would you like to search museums for?"
                    return {
                        "message": response,
                        "intent": "general",
                        "booking_data": session.get("booking_data", {})
                    }

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
                    "visitorType": booking.get("primary_visitor_type") or booking.get("visitor_type") or booking.get("visitorType") or "Adult",
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
            
            # Extract museum details if present in the message and not already set
            if not session.get("booking_data"):
                session["booking_data"] = {}
            if not session["booking_data"].get("museum_name"):
                museum = self.extract_museum_from_text(message)
                if museum:
                    session["booking_data"]["museum_name"] = museum["name"]
                    session["booking_data"]["museum_location"] = museum["location"]
                    session["booking_data"]["museum_state"] = museum["state"]
                    session["booking_data"]["museum_id"] = museum["museum_id"]
                    session["booking_data"]["museum_category"] = museum["category"]
                    session["booking_data"]["pricePerTicket"] = museum["price"]
                    # Also keep camelCase variants for frontend compatibility
                    session["booking_data"]["museumName"] = museum["name"]
                    session["booking_data"]["museumLocation"] = museum["location"]
                    session["booking_data"]["museumCategory"] = museum["category"]
            
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
        museum_name = booking_data.get("museumName") or booking_data.get("museum_name")
        if museum_name:
            summary += f"🏛️ Museum: {museum_name}\n"
        if booking_data.get("date"):
            summary += f"📅 Date: {booking_data['date']}\n"
        if booking_data.get("time_slot"):
            summary += f"🕐 Time: {booking_data['time_slot']}\n"
        if booking_data.get("tickets"):
            summary += f"🎫 Tickets: {booking_data['tickets']}\n"

        # Show visitor combo breakdown if available
        combo = booking_data.get("visitor_combo")
        if combo and isinstance(combo, dict) and any(v > 0 for v in combo.values()):
            prices = {
                "Adult": 200,
                "Child": 100,
                "Senior Citizen": 150,
                "Student": 120,
                "Professor": 180,
                "Researcher/Scientist": 180,
            }
            summary += "👤 Visitors:\n"
            total = 0
            for vtype, count in combo.items():
                if count > 0:
                    price = prices.get(vtype, 200)
                    subtotal = price * count
                    total += subtotal
                    summary += f"   {count}× {vtype} @ ₹{price} = ₹{subtotal}\n"
            summary += f"💰 Total: ₹{total}\n"
        elif booking_data.get("visitor_type"):
            summary += f"👤 Type: {booking_data['visitor_type']}\n"
            prices = {
                "Adult": 200,
                "Child": 100,
                "Senior Citizen": 150,
                "Student": 120,
                "Professor": 180,
                "Researcher/Scientist": 180,
            }
            price_per_ticket = booking_data.get("pricePerTicket") or booking_data.get("price") or prices.get(booking_data['visitor_type'], 200)
            total = int(price_per_ticket) * int(booking_data['tickets'])
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

    def is_museum_list_query(self, text: str) -> bool:
        """Detect location-based museum list requests before ChatterBot fallback."""
        normalized_text = text.lower()

        # If the user is expressing booking intent, it is NOT a museum list query
        booking_keywords = ("book", "ticket", "reserve", "buy", "purchase", "टिकट", "बुक", "টিকিট", "বুক", "டிக்கெட்", "முன்பதிவு")
        if any(keyword in normalized_text for keyword in booking_keywords):
            return False

        has_museum_word = "museum" in normalized_text or "museums" in normalized_text
        has_location = bool(self.extract_location(text))

        list_words = ("list", "show", "find", "search", "directory", "near", "nearby")
        if has_museum_word and (has_location or any(word in normalized_text for word in list_words)):
            return True

        if has_location and any(word in normalized_text for word in list_words):
            return True

        return bool(re.search(r"\bmuseums?\s+in\b|\bin\s+.+\bmuseums?\b", normalized_text))

    def extract_location(self, text: str) -> str:
        """Extract a valid city or state/UT name from the text using loaded museum data"""
        normalized_text = self.normalize_place_text(text)
        
        cities = set()
        states = set()
        for m in self.museums_data:
            if m.get('location'):
                cities.add(self.normalize_place_text(m['location']))
            if m.get('state'):
                states.add(self.normalize_place_text(m['state']))

        place_candidates = sorted([value for value in cities.union(states) if value], key=len, reverse=True)

        phrase_match = re.search(r"\b(?:in|near|at)\s+([a-z0-9 ]+?)(?:\s+museums?|\s+museum|\?|$)", normalized_text)
        requested_place = phrase_match.group(1).strip() if phrase_match else ""
        
        for state in sorted(states, key=len, reverse=True):
            if re.search(r'\b' + re.escape(state) + r'\b', normalized_text):
                return state
                
        for city in sorted(cities, key=len, reverse=True):
            if re.search(r'\b' + re.escape(city) + r'\b', normalized_text):
                return city
                
        for state in sorted(states, key=len, reverse=True):
            if len(state) >= 3 and state in normalized_text:
                return state
        for city in sorted(cities, key=len, reverse=True):
            if len(city) >= 3 and city in normalized_text:
                return city

        if requested_place:
            close = difflib.get_close_matches(requested_place, place_candidates, n=1, cutoff=0.74)
            if close:
                return close[0]
            return requested_place

        words = [word for word in normalized_text.split() if len(word) >= 3]
        for word in words:
            close = difflib.get_close_matches(word, place_candidates, n=1, cutoff=0.82)
            if close:
                return close[0]
                
        return ""

    def extract_museum_from_text(self, text: str) -> Dict[str, Any]:
        """Extract a museum from the text based on loaded museum names."""
        text_lower = text.lower().strip()
        if not text_lower:
            return None

        # Sort museums by name length descending so we match the most specific name first
        sorted_museums = sorted(self.museums_data, key=lambda m: len(m.get('name', '')), reverse=True)
        for m in sorted_museums:
            name = (m.get('name') or '').strip().lower()
            if name and name in text_lower:
                return m
        return None

    def get_museums_by_location(self, location: str) -> List[Dict[str, Any]]:
        loc = self.normalize_place_text(location)
        results = []
        for m in self.museums_data:
            city = self.normalize_place_text(m.get('location') or '')
            state = self.normalize_place_text(m.get('state') or '')
            searchable = [value for value in [city, state] if value]
            if (
                city == loc or
                state == loc or
                any(loc and (loc in value or value in loc) for value in searchable) or
                any(difflib.SequenceMatcher(None, loc, value).ratio() >= 0.82 for value in searchable)
            ):
                results.append(m)
        return sorted(results, key=lambda m: ((m.get('location') or ''), (m.get('name') or '')))

    def format_museum_list_response(self, location: str, museums: List[Dict[str, Any]], language: str = "en") -> str:
        """Format all museums found for the requested city/state."""
        location_label = self.localize_location_label(location, language)
        headings = {
            "en": f"Museums in {location_label}:",
            "hi": f"संग्रहालय सूची ({location_label}):",
            "bn": f"জাদুঘরের তালিকা ({location_label}):",
            "ta": f"அருங்காட்சியக பட்டியல் ({location_label}):",
        }
        lines = [headings.get(language, headings["en"]), ""]

        for index, museum in enumerate(museums, start=1):
            name = museum.get('name') or 'Unnamed Museum'
            lines.append(f"{index}. {name}")

        return "\n".join(lines)

    def localize_location_label(self, location: str, language: str) -> str:
        """Return a display label for common searched locations in the selected UI language."""
        labels = {
            "assam": {"hi": "असम", "bn": "অসম", "ta": "அசாம்"},
            "kolkata": {"hi": "कोलकाता", "bn": "কলকাতা", "ta": "கொல்கத்தா"},
            "west bengal": {"hi": "पश्चिम बंगाल", "bn": "पश्चिमবঙ্গ", "ta": "மேற்கு வங்காளம்"},
            "new delhi": {"hi": "नई दिल्ली", "bn": "নয়াদিল্লি", "ta": "புது தில்லி"},
            "delhi": {"hi": "दिल्ली", "bn": "दিল্লি", "ta": "தில்லி"},
            "mumbai": {"hi": "मुंबई", "bn": "মুম্বাই", "ta": "மும்பை"},
            "maharashtra": {"hi": "महाराष्ट्र", "bn": "মহারাষ্ট্র", "ta": "மகாராஷ்டிரா"},
            "chennai": {"hi": "चेन्नई", "bn": "চেন্নাই", "ta": "சென்னை"},
            "tamil nadu": {"hi": "तमिलनाडु", "bn": "তামিলநாড়ू", "ta": "தமிழ்நாடு"},
            "hyderabad": {"hi": "हैदराबाद", "bn": "हायदराबाद", "ta": "ஹைதராபாத்"},
            "telangana": {"hi": "तेलंगाना", "bn": "তেলেঙ্গানা", "ta": "தெலுங்கானா"},
        }
        normalized_location = location.lower().strip()
        return labels.get(normalized_location, {}).get(language, location.title())
