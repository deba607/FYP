from typing import Dict, List
import re

class IntentClassifier:
    def __init__(self):
        self.intents = {
            "book_ticket": [
                "book", "booking", "reserve", "reservation", "ticket",
                "buy tickets", "purchase", "get tickets", "want to visit"
            ],
            "check_availability": [
                "available", "availability", "check", "slots", "time slots"
            ],
            "pricing": [
                "price", "cost", "how much", "fee", "rates", "charges"
            ],
            "museum_info": [
                "information", "about", "location", "address", "hours",
                "opening time", "closing time", "exhibits", "collections"
            ],
            "discount": [
                "discount", "offer", "concession", "student", "senior"
            ],
            "general": []
        }

    def classify(self, message: str) -> str:
        message_lower = message.lower()
        
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
