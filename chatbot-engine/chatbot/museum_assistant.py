from typing import Dict, Any, List
from chatterbot import ChatBot
from chatterbot.trainers import ListTrainer
from .intent_classifier import IntentClassifier
from .booking_handler import BookingHandler
import os
import csv

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

    def load_museums_from_csv(self):
        """Load museum data from CSV file"""
        museums = []
        csv_path = os.path.join(os.path.dirname(__file__), 'indian museum dataset.csv')
        
        try:
            with open(csv_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    museums.append(row)
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

    def train_indian_museums_data(self, trainer):
        """Train chatbot with Indian museums data from CSV"""
        
        # Group museums by state
        states = {}
        categories = {}
        
        for museum in self.museums_data:
            state = museum.get('State/UT', '')
            name = museum.get('Museum Name', '')
            city = museum.get('City/Location', '')
            category = museum.get('Category/Type', '')
            
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
