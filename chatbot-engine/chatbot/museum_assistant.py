from typing import Dict, Any, List
import re
import difflib
from chatterbot import ChatBot
from chatterbot.trainers import ListTrainer
from .intent_classifier import IntentClassifier
from .booking_handler import BookingHandler
from .firestore_chat_service import FirestoreFirstChatbotService
import os
import requests
import logging
from pathlib import Path
import time

try:
    from firebase_admin_helper import get_firestore_client
except Exception:
    get_firestore_client = None


logger = logging.getLogger(__name__)

class MuseumAssistant:
    def __init__(self):
        self.db_path = Path(__file__).resolve().parent.parent / 'museum_bot_firestore.db'
        self.snapshot_enabled = False
        self.snapshot_disabled_reason = "Automatic ChatterBot retraining is disabled; Firestore is queried at request time"
        self.is_training = False
        self.last_snapshot_at = None
        self.last_trained_at = None
        self.last_error = None

        # Create ChatterBot instance with minimal dependencies
        self.chatbot = self._create_chatbot()
        
        # Museum data must come from Firestore at request time, not trained ChatterBot data.
        self.museums_data = []
        
        self.sessions = {}
        self.intent_classifier = IntentClassifier()
        self.booking_handler = BookingHandler()
        try:
            self.firestore_chat_service = FirestoreFirstChatbotService()
        except Exception as err:
            self.firestore_chat_service = None
            logger.warning("Firestore-first chatbot service disabled: %s", err)

    def _create_chatbot(self, db_path: Path = None) -> ChatBot:
        path = db_path or self.db_path
        db_uri = f"sqlite:///{path.as_posix()}"
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
        self._remove_database_files(self.db_path)

    def _remove_database_files(self, db_path: Path) -> None:
        for suffix in ("", "-wal", "-shm"):
            file_path = Path(f"{db_path}{suffix}")
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception as delete_err:
                logger.warning("Failed to remove chatbot DB file %s: %s", file_path, delete_err)

    def normalize_museum_record(self, row: Dict[str, Any], doc_id: str = "") -> Dict[str, Any]:
        name = str(row.get("name") or row.get("Museum Name") or "").strip()
        if not name:
            return {}

        price_raw = row.get("price", 200)
        try:
            price = float(price_raw)
        except (TypeError, ValueError):
            price = 200.0

        museum_id = str(row.get("museum_id") or row.get("id") or doc_id or "").strip()
        return {
            "id": str(row.get("id") or doc_id or museum_id).strip(),
            "museum_id": museum_id,
            "name": name,
            "state": str(row.get("state") or row.get("State/UT") or "").strip(),
            "location": str(row.get("location") or row.get("City/Location") or "").strip(),
            "category": str(row.get("category") or row.get("Category/Type") or "").strip(),
            "description": str(row.get("description") or "").strip(),
            "imageUrl": str(row.get("imageUrl") or row.get("image") or "").strip(),
            "price": price,
            "prices": row.get("prices") or {},
            "raw": row,
        }

    def load_museums_from_firestore(self) -> List[Dict[str, Any]]:
        """Load museums directly from Firestore, falling back to the Next.js API."""
        client = get_firestore_client() if get_firestore_client else None
        if not client:
            self.snapshot_disabled_reason = "Firebase Admin Firestore client unavailable; using /api/museums fallback"
            return self.load_museums_from_firestore_api()

        try:
            museums = []
            docs = client.collection("museums").stream()
            for doc in docs:
                record = self.normalize_museum_record(doc.to_dict() or {}, doc.id)
                if record:
                    museums.append(record)

            return sorted(museums, key=lambda m: ((m.get("location") or ""), (m.get("name") or "")))
        except Exception as err:
            self.snapshot_disabled_reason = f"Firestore load failed; using /api/museums fallback: {err}"
            logger.warning("Unable to load museums directly from Firestore: %s", err)
            return self.load_museums_from_firestore_api()

    def load_museums_from_firestore_api(self):
        """Load museum data from the Firestore-backed Next.js API."""
        museums = []
        api_base = os.environ.get('CHATBOT_API_URL') or 'http://localhost:3000'
        try:
            response = requests.get(f"{api_base}/api/museums", timeout=10)
            response.raise_for_status()
            payload = response.json()
            for row in payload.get("museums", []):
                record = self.normalize_museum_record(row, str(row.get("id") or ""))
                if record:
                    museums.append(record)
        except Exception as err:
            logger.warning("Unable to load Firestore museums from %s/api/museums: %s", api_base, err)

        return sorted(museums, key=lambda m: ((m.get("location") or ""), (m.get("name") or "")))

    def refresh_museums_from_firestore_api(self) -> None:
        """Refresh museum data so chatbot search reflects current Firestore records."""
        museums = self.load_museums_from_firestore_api()
        if museums:
            self.museums_data = museums

    def normalize_place_text(self, value: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()

    def clean_requested_place(self, value: str) -> str:
        text = self.normalize_place_text(value)
        text = re.sub(r"\b(the|city|state|please|museum|museums)\b", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    def train_bot(self, chatbot: ChatBot = None, museums_data: List[Dict[str, Any]] = None):
        """Train the chatbot with museum-specific conversations"""
        logger.info("ChatterBot training skipped. Live museum, FAQ, booking, pricing, and timing data is read from Firestore at request time.")
        return
        trainer = ListTrainer(chatbot or self.chatbot)
        museums_for_training = museums_data if museums_data is not None else self.museums_data
        
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
        self.train_indian_museums_data(trainer, museums_for_training)
        
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

        # Full-service action training. Deterministic handlers perform the real work.
        trainer.train([
            "What can you do?",
            "I can help you sign up, sign in, search museums, book tickets, confirm demo payment, show your tickets, and check ticket status by Booking ID.",
            "Show my tickets",
            "I can show all tickets linked with your logged-in account.",
            "Show ticket BM123456789",
            "I can show that ticket only if it belongs to your logged-in account.",
            "Ticket status",
            "Please provide your Booking ID, for example: show ticket BM123456789.",
            "Details of Indian Museum",
            "I can share museum details from the Firestore museum catalog."
        ])

    def train_indian_museums_data(self, trainer, museums_data: List[Dict[str, Any]] = None):
        """Train chatbot only with museums loaded from the Firestore-backed API."""
        logger.info("Museum-specific ChatterBot training skipped. Firestore is the source of truth.")
        return
        museums = museums_data if museums_data is not None else self.museums_data
        
        # Group museums by state
        states = {}
        categories = {}
        
        for museum in museums:
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
        for museum in museums:
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

    def sync_auth_context(self, session: Dict[str, Any], auth_context: Dict[str, Any]) -> None:
        if not auth_context:
            return

        if auth_context.get("email") or auth_context.get("token") or auth_context.get("userId"):
            session["user"] = {
                "email": auth_context.get("email") or session.get("user", {}).get("email", ""),
                "token": auth_context.get("token") or session.get("user", {}).get("token"),
                "id": auth_context.get("userId") or session.get("user", {}).get("id")
            }

    def is_authenticated(self, session: Dict[str, Any], auth_context: Dict[str, Any]) -> bool:
        return bool(
            auth_context.get("isLoggedIn") or
            auth_context.get("token") or
            auth_context.get("userId") or
            session.get("user", {}).get("token")
        )

    def auth_required_response(self, intent: str) -> Dict[str, Any]:
        return {
            "message": "Please sign in first to use this service. You can type \"login\" or \"sign up\" here in the chatbot.",
            "intent": intent,
            "booking_data": {},
            "action": {"type": "auth_required"}
        }

    def help_response(self, is_logged_in: bool) -> Dict[str, Any]:
        lines = [
            "I can help with these services:",
            "",
            "- Sign up or sign in",
            "- Search museums by city or state",
            "- Ask museum details, price, location, timings, and discounts"
        ]
        if is_logged_in:
            lines.extend([
                "- Book museum tickets",
                "- Confirm demo payment",
                "- Show all my tickets",
                "- Show ticket status by Booking ID"
            ])
        else:
            lines.append("- Login-required: book tickets, payment, my tickets, and ticket status")

        return {"message": "\n".join(lines), "intent": "help", "booking_data": {}}

    def extract_booking_id_from_text(self, text: str) -> str:
        match = re.search(r"\b(?:BM|BK)\d+\b", text or "", re.IGNORECASE)
        return match.group(0).upper() if match else ""

    def process_message(self, message: str, session_id: str = "default", language: str = "en", auth_context: Dict[str, Any] = None) -> Dict[str, Any]:
        session = self.get_or_create_session(session_id)
        session["language"] = language
        auth_context = auth_context or {}
        self.sync_auth_context(session, auth_context)
        is_logged_in = self.is_authenticated(session, auth_context)

        # Auto-refresh museum cache on first query if empty to support fuzzy/fallback queries
        if not self.museums_data:
            try:
                self.refresh_museums_from_firestore_api()
            except Exception as e:
                logger.warning("Auto-refreshing local museums cache failed: %s", e)

        if self.firestore_chat_service:
            live_response = self.firestore_chat_service.handle(
                message,
                {
                    **auth_context,
                    **(session.get("user") or {}),
                    "isLoggedIn": is_logged_in,
                },
                session.get("booking_data", {})
            )
            if live_response:
                return {
                    "message": live_response.get("message", ""),
                    "intent": live_response.get("intent", "unknown"),
                    "booking_data": session.get("booking_data", {}),
                    "action": live_response.get("action"),
                    "data": live_response.get("data", {}),
                }
        
        # Classify intent
        intent = self.intent_classifier.classify(message)
        if self.is_museum_list_query(message):
            intent = "search_museums"

        if intent == "help":
            return self.help_response(is_logged_in)

        if intent == "my_tickets":
            if not is_logged_in:
                return self.auth_required_response(intent)
            return {
                "message": "Here are the tickets linked with your logged-in account.",
                "intent": "my_tickets",
                "booking_data": session.get("booking_data", {}),
                "action": {"type": "show_my_tickets"}
            }

        if intent == "show_ticket_by_id":
            booking_id = self.extract_booking_id_from_text(message)
            if not booking_id:
                return {
                    "message": "Please provide your Booking ID, for example: show ticket BM123456789.",
                    "intent": "show_ticket_by_id",
                    "booking_data": session.get("booking_data", {})
                }
            if not is_logged_in:
                return self.auth_required_response(intent)
            return {
                "message": f"I will show ticket {booking_id} if it belongs to your logged-in account.",
                "intent": "show_ticket_by_id",
                "booking_data": session.get("booking_data", {}),
                "action": {"type": "show_ticket_by_id", "bookingId": booking_id}
            }

        if intent in ["museum_info", "pricing", "discount"]:
            museum = self.extract_museum_from_text(message)
            if museum:
                return {
                    "message": self.format_museum_details_response(museum),
                    "intent": "museum_info",
                    "booking_data": session.get("booking_data", {})
                }

        if intent == "general":
            museum = self.extract_museum_from_text(message)
            if museum:
                return {
                    "message": self.format_museum_details_response(museum),
                    "intent": "museum_info",
                    "booking_data": session.get("booking_data", {})
                }

        # --- Search Museums flow ---
        if intent == "search_museums" or session.get("in_search_museums_flow"):
            session["in_search_museums_flow"] = True
            loc = self.extract_location(message)
            if loc:
                results = self.search_museums_live(loc)
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
                    museum = self.extract_museum_from_text(message)
                    if museum:
                        session["in_search_museums_flow"] = False
                        session["waiting_for_location"] = False
                        return {
                            "message": self.format_museum_details_response(museum),
                            "intent": "museum_info",
                            "booking_data": session.get("booking_data", {})
                        }
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
                        user = data.get("user") or {}
                        session["user"] = {"email": user.get("email") or temp["email"], "token": token, "id": user.get("id")}
                        session["in_signup_flow"] = False
                        session.pop("temp_user", None)
                        return {
                            "message": f"Account created successfully for {temp['email']}. You are now signed in.",
                            "intent": "signup",
                            "booking_data": session.get("booking_data", {}),
                            "action": {"type": "auth_success"},
                            "auth_result": {
                                "token": token,
                                "firebaseCustomToken": data.get("firebaseCustomToken"),
                                "user": user
                            }
                        }
                    else:
                        # server-side error
                        session["in_signup_flow"] = False
                        session.pop("temp_user", None)
                        msg = data.get('message') or 'Signup failed on server.'
                        return {"message": msg, "intent": "signup", "booking_data": session.get("booking_data", {})}
                except Exception as err:
                    session["in_signup_flow"] = False
                    session.pop("temp_user", None)
                    logger.warning("Chatbot signup failed via API: %s", err)
                    return {"message": "Signup service is unavailable right now. Please try again in a moment.", "intent": "signup", "booking_data": session.get("booking_data", {})}

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
                        user = data.get("user") or {}
                        session["user"] = {"email": user.get("email") or temp.get("email"), "token": token, "id": user.get("id")}
                        return {
                            "message": f"Signed in successfully as {user.get('email') or temp['email']}.",
                            "intent": "signin",
                            "booking_data": session.get("booking_data", {}),
                            "action": {"type": "auth_success"},
                            "auth_result": {
                                "token": token,
                                "firebaseCustomToken": data.get("firebaseCustomToken"),
                                "user": user
                            }
                        }
                    else:
                        return {"message": data.get('message') or 'Sign in failed — email or password incorrect.', "intent": "signin", "booking_data": session.get("booking_data", {})}
                except Exception as err:
                    logger.warning("Chatbot signin failed via API: %s", err)
                    session["in_signin_flow"] = False
                    session.pop("temp_user", None)
                    return {"message": "Sign in service is unavailable right now. Please try again in a moment.", "intent": "signin", "booking_data": session.get("booking_data", {})}

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
            if not is_logged_in:
                return self.auth_required_response(intent)
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
            if not is_logged_in:
                return self.auth_required_response(intent)
            session["in_booking_flow"] = True
            
            if not session.get("booking_data"):
                session["booking_data"] = {}

            museum_prompt = self.ensure_booking_museum_details(session, message, language)
            if museum_prompt:
                return museum_prompt
            
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

    def get_training_status(self) -> Dict[str, Any]:
        return {
            "snapshotEnabled": self.snapshot_enabled,
            "snapshotDisabledReason": self.snapshot_disabled_reason or None,
            "cachedMuseumCount": len(self.museums_data),
            "isTraining": self.is_training,
            "lastSnapshotAt": self.last_snapshot_at,
            "lastTrainedAt": self.last_trained_at,
            "lastError": self.last_error,
            "sourceOfTruth": "firestore_request_time_queries",
            "chatterBotRole": "small_talk_fallback_only",
        }

    def format_museum_details_response(self, museum: Dict[str, Any]) -> str:
        price = museum.get("price") or 200
        try:
            price_text = f"INR {int(float(price))}"
        except (TypeError, ValueError):
            price_text = f"INR {price}"

        lines = [
            f"{museum.get('name') or 'Museum'} details:",
            f"Location: {museum.get('location') or 'Not available'}",
            f"State: {museum.get('state') or 'Not available'}",
            f"Category: {museum.get('category') or 'Not available'}",
            f"Base price: {price_text}",
        ]
        description = museum.get("description")
        if description:
            lines.append(f"Description: {description}")
        return "\n".join(lines)

    def search_museums_live(self, query: str) -> List[Dict[str, Any]]:
        results = []
        if self.firestore_chat_service:
            try:
                results = self.firestore_chat_service.museums.search(query)
            except Exception as err:
                logger.warning("Live Firestore museum search failed: %s", err)

        if not results:
            results = self.get_museums_by_location(query) or self.find_museums(query)

        deduped = []
        seen = set()
        for museum in results:
            key = str(museum.get("museum_id") or museum.get("id") or museum.get("name") or "").lower()
            if key and key not in seen:
                seen.add(key)
                deduped.append(museum)
        return deduped

    def ensure_booking_museum_details(self, session: Dict[str, Any], message: str, language: str = "en") -> Dict[str, Any]:
        """Require a Firestore museum before date/time/ticket collection continues."""
        booking_data = session.setdefault("booking_data", {})
        if booking_data.get("museum_name") or booking_data.get("museumName"):
            return None

        if not self.has_booking_museum_search_text(message):
            return {
                "message": "Which museum would you like to book? Please type the museum name or a city/location, for example: `book ticket in Kolkata`.",
                "intent": "book_ticket",
                "booking_data": booking_data,
            }

        matches = self.search_museums_for_booking(message)
        exact_match = self.find_exact_museum_match(message, matches)
        if exact_match:
            self.apply_museum_to_booking_data(booking_data, exact_match)
            return None

        if len(matches) == 1:
            self.apply_museum_to_booking_data(booking_data, matches[0])
            return None

        if len(matches) > 1:
            return {
                "message": self.format_booking_museum_choices(matches),
                "intent": "book_ticket",
                "booking_data": booking_data,
            }

        return {
            "message": "I could not find that museum in Firestore. Please enter a museum name or location from the museum collection.",
            "intent": "book_ticket",
            "booking_data": booking_data,
        }

    def apply_museum_to_booking_data(self, booking_data: Dict[str, Any], museum: Dict[str, Any]) -> None:
        """Store required museum fields using both backend and frontend-compatible names."""
        prices = museum.get("prices") if isinstance(museum.get("prices"), dict) else {}
        price = museum.get("price") or prices.get("Adult") or prices.get("adult") or 200
        museum_id = museum.get("museum_id") or museum.get("id") or ""
        name = museum.get("name") or "Museum ticket"
        location = museum.get("location") or ""
        state = museum.get("state") or ""
        category = museum.get("category") or ""

        booking_data.update({
            "museum_name": name,
            "museum_location": location,
            "museum_state": state,
            "museum_id": museum_id,
            "museum_category": category,
            "museum_prices": prices,
            "pricePerTicket": price,
            "museumName": name,
            "museumLocation": location,
            "museumState": state,
            "museumId": museum_id,
            "museumCategory": category,
        })

    def has_booking_museum_search_text(self, message: str) -> bool:
        """Return true only when the booking message contains a museum/location clue."""
        text = re.sub(r"[^a-z0-9 ]+", " ", str(message or "").lower())
        stop_words = {
            "book", "booking", "ticket", "tickets", "reserve", "reservation", "buy",
            "purchase", "please", "want", "need", "show", "check", "availability",
            "for", "to", "in", "at", "near", "of", "the", "a", "an", "my", "me",
            "one", "two", "three", "four", "five", "adult", "child", "student",
            "senior", "citizen", "professor", "researcher", "scientist",
        }
        tokens = [token for token in text.split() if len(token) >= 3 and token not in stop_words and not token.isdigit()]
        return bool(tokens)

    def search_museums_for_booking(self, message: str) -> List[Dict[str, Any]]:
        """Search live Firestore first, then local cached data if Firestore is unavailable."""
        return self.search_museums_live(message)

    def find_exact_museum_match(self, message: str, museums: List[Dict[str, Any]]) -> Dict[str, Any]:
        normalized_message = re.sub(r"[^a-z0-9 ]+", " ", str(message or "").lower())
        normalized_message = re.sub(r"\s+", " ", normalized_message).strip()
        exact = []
        contained = []
        for museum in museums:
            name = re.sub(r"[^a-z0-9 ]+", " ", str(museum.get("name") or "").lower())
            name = re.sub(r"\s+", " ", name).strip()
            if not name:
                continue
            if normalized_message == name:
                exact.append(museum)
            elif name in normalized_message:
                contained.append(museum)
        if len(exact) == 1:
            return exact[0]
        if len(contained) == 1:
            return contained[0]
        return None

    def format_booking_museum_choices(self, museums: List[Dict[str, Any]]) -> str:
        lines = ["I found multiple museums. Please choose one for this booking:"]
        for index, museum in enumerate(museums[:8], start=1):
            lines.append(f"{index}. {museum.get('name') or 'Unnamed museum'}")
            place = ", ".join([value for value in [museum.get("location"), museum.get("state")] if value])
            if place:
                lines.append(f"   {place}")
        lines.append("")
        lines.append("After you choose the museum, I will ask only for the required booking details.")
        return "\n".join(lines)

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
        requested_place = self.clean_requested_place(phrase_match.group(1)) if phrase_match else ""
        
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

        if self.firestore_chat_service:
            try:
                museum = self.firestore_chat_service.museums.resolve_museum(query=text)
                return {
                    "id": museum.get("id") or "",
                    "museum_id": museum.get("museum_id") or museum.get("id") or "",
                    "name": museum.get("name") or "",
                    "location": museum.get("location") or "",
                    "state": museum.get("state") or "",
                    "category": museum.get("category") or "",
                    "description": museum.get("description") or "",
                    "price": museum.get("price") or 200,
                    "prices": museum.get("prices") or {},
                    "raw": museum,
                }
            except Exception:
                pass

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
