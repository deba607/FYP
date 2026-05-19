from typing import Dict, Any
import re
from datetime import datetime

class BookingHandler:
    def __init__(self):
        self.required_fields = ["date", "time_slot", "tickets", "visitor_type"]
        self.time_slots = ["10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM"]
        self.visitor_types = ["Adult", "Child", "Senior Citizen", "Student", "Professor", "Researcher/Scientist"]
        self.prices = {
            "Adult": 200,
            "Child": 100,
            "Senior Citizen": 150,
            "Student": 120,
            "Professor": 180,
            "Researcher/Scientist": 180,
        }

    def handle(self, message: str, booking_data: Dict) -> Dict[str, Any]:
        message_lower = message.lower()
        
        # Extract date
        if not booking_data.get("date"):
            date = self.extract_date(message)
            if date:
                booking_data["date"] = date
                return {
                    "message": f"Great! I've noted {date} as your visit date. 📅\n\nWhich time slot would you prefer?\n• 10:00 AM\n• 12:00 PM\n• 2:00 PM\n• 4:00 PM",
                    "booking_data": booking_data,
                    "complete": False
                }
            else:
                return {
                    "message": "I'd be happy to help you book tickets! 🎫\n\nWhen would you like to visit? Please provide a date (e.g., 2025-12-20 or December 20).",
                    "booking_data": booking_data,
                    "complete": False
                }
        
        # Extract time slot
        if not booking_data.get("time_slot"):
            time_slot = self.extract_time_slot(message)
            if time_slot:
                booking_data["time_slot"] = time_slot
                return {
                    "message": f"Perfect! ⏰ {time_slot} time slot selected.\n\nHow many tickets would you like to book? (1-10)",
                    "booking_data": booking_data,
                    "complete": False
                }
            else:
                return {
                    "message": "Which time slot works best for you?\n• 10:00 AM\n• 12:00 PM\n• 2:00 PM\n• 4:00 PM",
                    "booking_data": booking_data,
                    "complete": False
                }
        
        # Extract number of tickets
        if not booking_data.get("tickets"):
            tickets = self.extract_number(message)
            if tickets and 1 <= tickets <= 10:
                booking_data["tickets"] = tickets
                return {
                    "message": f"Noted! 🎫 {tickets} ticket(s).\n\nWhat type of visitor are you?\n• Adult (₹200)\n• Child (₹100)\n• Senior Citizen (₹150)\n• Student (₹120)\n• Professor (₹180)\n• Researcher/Scientist (₹180)",
                    "booking_data": booking_data,
                    "complete": False
                }
            elif tickets and tickets > 10:
                return {
                    "message": "Sorry, you can book a maximum of 10 tickets at once. Please specify a number between 1 and 10.",
                    "booking_data": booking_data,
                    "complete": False
                }
            else:
                return {
                    "message": "How many tickets would you like to book? (1-10)",
                    "booking_data": booking_data,
                    "complete": False
                }
        
        # Extract visitor type
        if not booking_data.get("visitor_type"):
            visitor_type = self.extract_visitor_type(message)
            if visitor_type:
                booking_data["visitor_type"] = visitor_type
                # Calculate total
                total = self.prices.get(visitor_type, 200) * booking_data["tickets"]
                return {
                    "message": f"Excellent! 👤 {visitor_type} ticket(s) selected.\n\n💰 Total Amount: ₹{total}",
                    "booking_data": booking_data,
                    "complete": True
                }
            else:
                return {
                    "message": "Please select a visitor type:\n• Adult (₹200)\n• Child (₹100)\n• Senior Citizen (₹150)\n• Student (₹120)\n• Professor (₹180)\n• Researcher/Scientist (₹180)",
                    "booking_data": booking_data,
                    "complete": False
                }
        
        return {
            "message": "All information collected! ✅",
            "booking_data": booking_data,
            "complete": True
        }

    def extract_date(self, text: str) -> str:
        # Match YYYY-MM-DD format
        pattern = r'\d{4}-\d{2}-\d{2}'
        match = re.search(pattern, text)
        if match:
            date_str = match.group()
            # Validate date
            try:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                if date_obj >= datetime.now():
                    return date_str
            except ValueError:
                pass
        
        # Match common date formats like "December 20", "Dec 20", "20 December"
        months = {
            "january": "01", "february": "02", "march": "03", "april": "04",
            "may": "05", "june": "06", "july": "07", "august": "08",
            "september": "09", "october": "10", "november": "11", "december": "12",
            "jan": "01", "feb": "02", "mar": "03", "apr": "04",
            "jun": "06", "jul": "07", "aug": "08", "sep": "09",
            "oct": "10", "nov": "11", "dec": "12"
        }
        
        for month, num in months.items():
            if month in text.lower():
                # Try to extract day and year
                numbers = re.findall(r'\d+', text)
                if len(numbers) >= 1:
                    day = numbers[0].zfill(2)
                    year = numbers[1] if len(numbers) >= 2 and len(numbers[1]) == 4 else "2025"
                    date_str = f"{year}-{num}-{day}"
                    try:
                        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                        if date_obj >= datetime.now():
                            return date_str
                    except ValueError:
                        pass
        
        # Handle relative dates like "today", "tomorrow"
        text_lower = text.lower()
        if "today" in text_lower:
            return datetime.now().strftime('%Y-%m-%d')
        elif "tomorrow" in text_lower:
            from datetime import timedelta
            return (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        return None

    def extract_time_slot(self, text: str) -> str:
        text_lower = text.lower()
        # Check for specific time mentions
        if "10" in text and ("am" in text_lower or "morning" in text_lower):
            return "10:00 AM"
        elif "12" in text and ("pm" in text_lower or "noon" in text_lower or "afternoon" in text_lower):
            return "12:00 PM"
        elif "2" in text and ("pm" in text_lower or "afternoon" in text_lower):
            return "2:00 PM"
        elif "4" in text and ("pm" in text_lower or "evening" in text_lower):
            return "4:00 PM"
        # General time periods
        elif "morning" in text_lower or "9" in text or "11" in text:
            return "10:00 AM"
        elif "afternoon" in text_lower or "1" in text or "3" in text:
            return "2:00 PM"
        elif "evening" in text_lower or "5" in text or "6" in text:
            return "4:00 PM"
        return None

    def extract_number(self, text: str) -> int:
        numbers = re.findall(r'\d+', text)
        if numbers:
            return int(numbers[0])
        
        word_to_num = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10
        }
        
        for word, num in word_to_num.items():
            if word in text.lower():
                return num
        
        return None

    def extract_visitor_type(self, text: str) -> str:
        text_lower = text.lower()
        if "adult" in text_lower or "grown" in text_lower or "regular" in text_lower:
            return "Adult"
        elif "child" in text_lower or "kid" in text_lower or "minor" in text_lower:
            return "Child"
        elif "senior" in text_lower or "elderly" in text_lower or "old" in text_lower:
            return "Senior Citizen"
        elif "student" in text_lower or "college" in text_lower or "school" in text_lower:
            return "Student"
        elif "professor" in text_lower or "teacher" in text_lower or "faculty" in text_lower:
            return "Professor"
        elif "research" in text_lower or "scientist" in text_lower or "researcher" in text_lower:
            return "Researcher/Scientist"
        return None
