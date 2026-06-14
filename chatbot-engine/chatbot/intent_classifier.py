class IntentClassifier:
    def __init__(self):
        self.intents = {
            "book_ticket": [
                "book", "booking", "reserve", "reservation",
                "buy tickets", "purchase", "get tickets", "want to visit",
                "\u091f\u093f\u0915\u091f", "\u092c\u0941\u0915", "\u0906\u0930\u0915\u094d\u0937\u0923",
                "\u099f\u09bf\u0995\u09bf\u099f", "\u09ac\u09c1\u0995", "\u09b0\u09bf\u099c\u09be\u09b0\u09cd\u09ad",
                "\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0bc6\u0b9f\u0bcd", "\u0baa\u0ba4\u0bbf\u0bb5\u0bc1", "\u0bae\u0bc1\u0ba9\u0bcd\u0baa\u0ba4\u0bbf\u0bb5\u0bc1"
            ],
            "signup": [
                "sign up", "signup", "register", "create account", "i want to register",
                "\u0930\u091c\u093f\u0938\u094d\u091f\u0930", "\u0916\u093e\u0924\u093e",
                "\u09b8\u09be\u0987\u09a8 \u0986\u09aa", "\u09b0\u09c7\u099c\u09bf\u09b8\u09cd\u099f\u09be\u09b0", "\u0985\u09cd\u09af\u09be\u0995\u09be\u0989\u09a8\u09cd\u099f",
                "\u0baa\u0ba4\u0bbf\u0bb5\u0bc1 \u0b9a\u0bc6\u0baf\u0bcd", "\u0b95\u0ba3\u0b95\u0bcd\u0b95\u0bc1"
            ],
            "signin": [
                "sign in", "signin", "log in", "login", "i want to sign in", "i want to login",
                "\u0932\u0949\u0917\u093f\u0928", "\u0938\u093e\u0907\u0928 \u0907\u0928",
                "\u09b2\u0997\u0987\u09a8", "\u09b8\u09be\u0987\u09a8 \u0987\u09a8",
                "\u0b89\u0bb3\u0bcd\u0ba8\u0bc1\u0bb4\u0bc8"
            ],
            "confirm_booking": [
                "confirm", "confirm booking", "yes confirm", "yes book", "confirm my booking",
                "\u092a\u0941\u0937\u094d\u091f\u093f", "\u0939\u093e\u0902",
                "\u09a8\u09bf\u09b6\u09cd\u099a\u09bf\u09a4", "\u09b9\u09cd\u09af\u09be\u0981",
                "\u0b89\u0bb1\u0bc1\u0ba4\u0bbf", "\u0b86\u0bae\u0bcd"
            ],
            "payment": [
                "pay", "payment", "pay now", "checkout", "make payment", "pay for",
                "\u092d\u0941\u0917\u0924\u093e\u0928", "\u092a\u0947\u092e\u0947\u0902\u091f",
                "\u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f", "\u099f\u09be\u0995\u09be",
                "\u0b95\u0b9f\u0bcd\u0b9f\u0ba3\u0bae\u0bcd", "\u0baa\u0ba3\u0bae\u0bcd"
            ],
            "search_ticket": [
                "search ticket", "find ticket", "find booking",
                "\u091f\u093f\u0915\u091f \u0916\u094b\u091c", "\u092c\u0941\u0915\u093f\u0902\u0917 \u0916\u094b\u091c",
                "\u099f\u09bf\u0995\u09bf\u099f \u0996\u09c1\u0981\u099c", "\u09ac\u09c1\u0995\u09bf\u0982 \u0996\u09c1\u0981\u099c",
                "\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0bc6\u0b9f\u0bcd \u0ba4\u0bc7\u0b9f\u0bc1", "\u0baa\u0ba4\u0bbf\u0bb5\u0bc1 \u0ba4\u0bc7\u0b9f\u0bc1"
            ],
            "my_tickets": [
                "my tickets", "show my tickets", "my bookings", "show my bookings",
                "ticket history", "booking history", "all tickets", "all my tickets",
                "my ticket"
            ],
            "show_ticket_by_id": [
                "show ticket", "ticket status", "booking status", "view ticket",
                "show booking", "view booking"
            ],
            "help": [
                "help", "what can you do", "services", "service", "actions",
                "commands", "menu", "options"
            ],
            "search_museums": [
                "list of museums", "museum list", "museums in", "find museums", "show museums",
                "search museums", "list museums", "museum directory", "list of museum", "museums list",
                "संग्रहालय सूची", "संग्रहालयों की सूची", "संग्रहालय कहाँ हैं",
                "জাদুঘরের তালিকা", "মিউজিয়ামের তালিকা", "জাদুঘর কোথায় আছে",
                "அருங்காட்சியக பட்டியல்", "அருங்காட்சியகம் எங்கே உள்ளது"
            ],
            "check_availability": [
                "available", "availability", "check", "slots", "time slots",
                "\u0909\u092a\u0932\u092c\u094d\u0927", "\u0938\u094d\u0932\u0949\u091f",
                "\u09aa\u09be\u0993\u09af\u09bc\u09be", "\u09b8\u09cd\u09b2\u099f",
                "\u0b95\u0bbf\u0b9f\u0bc8\u0b95\u0bcd\u0b95\u0bc1\u0bae\u0bcd", "\u0ba8\u0bc7\u0bb0\u0bae\u0bcd"
            ],
            "pricing": [
                "price", "cost", "how much", "fee", "rates", "charges",
                "\u0915\u0940\u092e\u0924", "\u092e\u0942\u0932\u094d\u092f", "\u0915\u093f\u0924\u0928\u093e",
                "\u09a6\u09be\u09ae", "\u09ae\u09c2\u09b2\u09cd\u09af", "\u0995\u09a4",
                "\u0bb5\u0bbf\u0bb2\u0bc8", "\u0b8e\u0bb5\u0bcd\u0bb5\u0bb3\u0bb5\u0bc1"
            ],
            "museum_info": [
                "information", "about", "location", "address", "hours",
                "opening time", "closing time", "exhibits", "collections",
                "\u091c\u093e\u0928\u0915\u093e\u0930\u0940", "\u0938\u094d\u0925\u093e\u0928", "\u092a\u0924\u093e", "\u0938\u092e\u092f",
                "\u09a4\u09a5\u09cd\u09af", "\u09a0\u09bf\u0995\u09be\u09a8\u09be", "\u09b8\u09ae\u09af\u09bc",
                "\u0b87\u0b9f\u0bae\u0bcd", "\u0bae\u0bc1\u0b95\u0bb5\u0bb0\u0bbf", "\u0ba8\u0bc7\u0bb0\u0bae\u0bcd"
            ],
            "discount": [
                "discount", "offer", "concession", "student", "senior",
                "\u091b\u0942\u091f", "\u091b\u093e\u0924\u094d\u0930",
                "\u09a1\u09bf\u09b8\u0995\u09be\u0989\u09a8\u09cd\u099f", "\u09b6\u09bf\u0995\u09cd\u09b7\u09be\u09b0\u09cd\u09a5\u09c0",
                "\u0ba4\u0bb3\u0bcd\u0bb3\u0bc1\u0baa\u0b9f\u0bbf", "\u0bae\u0bbe\u0ba3\u0bb5\u0bb0\u0bcd"
            ],
            "general": []
        }

    def classify(self, message: str) -> str:
        message_lower = message.lower()

        if __import__('re').search(r"\bBM\d+\b|\bBK\d+\b", message, __import__('re').IGNORECASE):
            return "show_ticket_by_id"

        my_ticket_phrases = (
            "show ticket", "show tickets", "show my ticket", "show my tickets",
            "my ticket", "my tickets", "all tickets", "all my tickets",
            "my bookings", "show my bookings", "ticket history", "booking history"
        )
        if any(phrase in message_lower for phrase in my_ticket_phrases):
            return "my_tickets"

        ticket_status_phrases = ("ticket status", "booking status", "view ticket", "view booking")
        if any(phrase in message_lower for phrase in ticket_status_phrases):
            return "show_ticket_by_id"

        # If there's an obvious booking intent, don't shortcut to search_museums
        booking_keywords = ("book", "ticket", "reserve", "buy", "purchase", "टिकट", "बुक", "টিকিট", "বুক", "டிக்கெட்", "முன்பதிவு")
        if any(keyword in message_lower for keyword in booking_keywords):
            pass
        else:
            museum_list_terms = ("list", "show", "find", "search", "directory", "near", "nearby", "in")
            has_list_term = any(
                __import__('re').search(r"\b" + __import__('re').escape(term) + r"\b", message_lower)
                for term in museum_list_terms
            )
            if ("museum" in message_lower or "museums" in message_lower) and has_list_term:
                return "search_museums"

        scores = {}
        for intent, keywords in self.intents.items():
            if intent == "general":
                continue
            score = sum(1 for keyword in keywords if keyword in message_lower)
            if score > 0:
                scores[intent] = score

        if scores:
            return max(scores, key=scores.get)

        return "general"
