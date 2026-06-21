from typing import Dict, Any
import re
from datetime import datetime

MAX_TICKETS = 6

VISITOR_TYPES = ["Adult", "Child", "Senior Citizen", "Student", "Professor", "Researcher/Scientist"]
PRICES = {
    "Adult": 200,
    "Child": 100,
    "Senior Citizen": 150,
    "Student": 120,
    "Professor": 180,
    "Researcher/Scientist": 180,
}


class BookingHandler:
    def __init__(self):
        self.required_fields = ["date", "time_slot", "tickets", "visitor_type"]
        self.time_slots = ["10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM"]
        self.visitor_types = VISITOR_TYPES
        self.prices = PRICES

    def handle(self, message: str, booking_data: Dict) -> Dict[str, Any]:
        message_lower = message.lower()
        
        # Extract date
        if not booking_data.get("date"):
            date = self.extract_date(message)
            if date:
                booking_data["date"] = date
                return {
                    "message": f"Great! I've noted {date} as your visit date. 📅\n\nWhich time slot would you prefer?\n1. 10:00 AM\n2. 12:00 PM\n3. 2:00 PM\n4. 4:00 PM",
                    "booking_data": booking_data,
                    "complete": False
                }
            else:
                from datetime import timedelta
                now = datetime.now()
                dates_list = []
                for i in range(7):
                    d = now + timedelta(days=i)
                    date_str = d.strftime('%Y-%m-%d')
                    if i == 0:
                        label = f"{date_str} (Today)"
                    elif i == 1:
                        label = f"{date_str} (Tomorrow)"
                    else:
                        label = date_str
                    dates_list.append(f"{i+1}. {label}")
                
                dates_message = "\n".join(dates_list)
                return {
                    "message": f"I'd be happy to help you book tickets! 🎫\n\nWhen would you like to visit? Please select a date:\n{dates_message}",
                    "booking_data": booking_data,
                    "complete": False
                }
        
        # Extract time slot
        if not booking_data.get("time_slot"):
            time_slot = self.extract_time_slot(message)
            if time_slot:
                booking_data["time_slot"] = time_slot
                tickets_list = [f"{i}. {i}" for i in range(1, MAX_TICKETS + 1)]
                tickets_str = "\n".join(tickets_list)
                return {
                    "message": f"Perfect! ⏰ {time_slot} time slot selected.\n\nHow many tickets would you like to book? (1-{MAX_TICKETS}):\n{tickets_str}",
                    "booking_data": booking_data,
                    "complete": False
                }
            else:
                return {
                    "message": "Which time slot works best for you?\n1. 10:00 AM\n2. 12:00 PM\n3. 2:00 PM\n4. 4:00 PM",
                    "booking_data": booking_data,
                    "complete": False
                }
        
        # Extract number of tickets
        if not booking_data.get("tickets"):
            # Check if they specified multiple visitor types and counts directly
            parsed_combos = self.parse_multiple_visitor_types(message)
            if parsed_combos:
                total_tickets = sum(parsed_combos.values())
                if 1 <= total_tickets <= MAX_TICKETS:
                    booking_data["tickets"] = total_tickets
                    booking_data["visitor_combo"] = parsed_combos
                    booking_data["visitor_combo_remaining"] = 0
                    booking_data["visitor_combo_step"] = 0
                    return self._finalize_visitor_combo(booking_data)
                elif total_tickets > MAX_TICKETS:
                    tickets_list = [f"{i}. {i}" for i in range(1, MAX_TICKETS + 1)]
                    tickets_str = "\n".join(tickets_list)
                    return {
                        "message": f"Sorry, you can book a maximum of {MAX_TICKETS} tickets at once. Please specify a number between 1 and {MAX_TICKETS}:\n{tickets_str}",
                        "booking_data": booking_data,
                        "complete": False
                    }

            tickets = self.extract_number(message)
            if tickets and 1 <= tickets <= MAX_TICKETS:
                booking_data["tickets"] = tickets
                # Initialize visitor_combo tracking
                booking_data["visitor_combo"] = {}
                booking_data["visitor_combo_remaining"] = tickets
                booking_data["visitor_combo_step"] = 0
                return self._ask_next_visitor_combo(booking_data)
            elif tickets and tickets > MAX_TICKETS:
                tickets_list = [f"{i}. {i}" for i in range(1, MAX_TICKETS + 1)]
                tickets_str = "\n".join(tickets_list)
                return {
                    "message": f"Sorry, you can book a maximum of {MAX_TICKETS} tickets at once. Please specify a number between 1 and {MAX_TICKETS}:\n{tickets_str}",
                    "booking_data": booking_data,
                    "complete": False
                }
            else:
                tickets_list = [f"{i}. {i}" for i in range(1, MAX_TICKETS + 1)]
                tickets_str = "\n".join(tickets_list)
                return {
                    "message": f"How many tickets would you like to book? (1-{MAX_TICKETS}):\n{tickets_str}",
                    "booking_data": booking_data,
                    "complete": False
                }
        
        # Handle visitor combination flow
        if booking_data.get("visitor_combo_remaining") is not None and booking_data["visitor_combo_remaining"] > 0:
            return self._handle_visitor_combo_input(message, booking_data)

        # Extract visitor type (legacy fallback for single visitor type)
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
                    "message": "Please select a visitor type:\n1. Adult (₹200)\n2. Child (₹100)\n3. Senior Citizen (₹150)\n4. Student (₹120)\n5. Professor (₹180)\n6. Researcher/Scientist (₹180)",
                    "booking_data": booking_data,
                    "complete": False
                }
        
        return {
            "message": "All information collected! ✅",
            "booking_data": booking_data,
            "complete": True
        }

    def _ask_next_visitor_combo(self, booking_data: Dict) -> Dict[str, Any]:
        """Ask for the count of the next visitor category in the combo."""
        remaining = booking_data["visitor_combo_remaining"]
        combo = booking_data.get("visitor_combo", {})
        total_tickets = booking_data["tickets"]

        if remaining <= 0:
            # All assigned — finalize
            return self._finalize_visitor_combo(booking_data)

        # Build the available categories list with prices
        assigned_so_far = sum(combo.values())
        lines = [f"🎫 You have {remaining} ticket(s) left to assign (out of {total_tickets})."]
        if combo:
            combo_summary = ", ".join(f"{v}× {k}" for k, v in combo.items() if v > 0)
            lines.append(f"Assigned so far: {combo_summary}")
        lines.append("")
        lines.append("How many tickets for each visitor type? You can select one or multiple categories at a time:")
        for idx, vtype in enumerate(VISITOR_TYPES, 1):
            lines.append(f"{idx}. {vtype} (₹{PRICES[vtype]})")
        lines.append("")
        lines.append("Type the category name (or number) and count, e.g. \"2 Adult and 1 Child\", \"2 Adult, 1 Child\", or just the category name for 1 ticket.")

        return {
            "message": "\n".join(lines),
            "booking_data": booking_data,
            "complete": False
        }

    def _handle_visitor_combo_input(self, message: str, booking_data: Dict) -> Dict[str, Any]:
        """Parse visitor combo input like '2 Adult', 'Adult 2', 'Adult', '3', etc."""
        remaining = booking_data["visitor_combo_remaining"]
        combo = booking_data.get("visitor_combo", {})
        message_stripped = message.strip()

        # Try to parse multiple visitor types and counts
        parsed_combos = self.parse_multiple_visitor_types(message_stripped)
        
        if parsed_combos:
            total_requested = sum(parsed_combos.values())
            if total_requested > remaining:
                return {
                    "message": f"You only have {remaining} ticket(s) left to assign, but you specified {total_requested} ticket(s). Please try again with {remaining} or fewer tickets.",
                    "booking_data": booking_data,
                    "complete": False
                }
            
            # Check for invalid count
            for vt, cnt in parsed_combos.items():
                if cnt < 1:
                    return {
                        "message": f"Please enter at least 1 ticket. You have {remaining} ticket(s) left.",
                        "booking_data": booking_data,
                        "complete": False
                    }
            
            # Add all to combo
            for vt, cnt in parsed_combos.items():
                combo[vt] = combo.get(vt, 0) + cnt
                remaining -= cnt
            
            booking_data["visitor_combo"] = combo
            booking_data["visitor_combo_remaining"] = remaining
            
            if remaining <= 0:
                return self._finalize_visitor_combo(booking_data)
            else:
                return self._ask_next_visitor_combo(booking_data)

        # Try to parse "N <type>" or "<type> N" or just "<type>" (defaults to 1)
        count = None
        vtype = None

        # First try to extract a visitor type from the message
        vtype = self.extract_visitor_type(message_stripped)

        # Try to extract a number
        num = self.extract_number(message_stripped)

        if vtype and num:
            count = num
        elif vtype and not num:
            count = 1  # default: 1 ticket of that type
        elif num and not vtype:
            # User typed just a number — maybe they're selecting from the numbered list
            if 1 <= num <= len(VISITOR_TYPES):
                vtype = VISITOR_TYPES[num - 1]
                count = 1
            else:
                return {
                    "message": f"Please specify a visitor category. You have {remaining} ticket(s) left.\nType a category name like \"Adult\" or a number 1-{len(VISITOR_TYPES)} from the list, optionally with a count (e.g. \"2 Adult\").",
                    "booking_data": booking_data,
                    "complete": False
                }
        else:
            return {
                "message": f"I didn't understand that. You have {remaining} ticket(s) left to assign.\nPlease type a category (e.g. \"Adult\", \"2 Child\", \"3 Student\").\n\nAvailable categories:\n" +
                           "\n".join(f"{i}. {vt} (₹{PRICES[vt]})" for i, vt in enumerate(VISITOR_TYPES, 1)),
                "booking_data": booking_data,
                "complete": False
            }

        # Validate count
        if count > remaining:
            return {
                "message": f"You only have {remaining} ticket(s) left to assign. Please enter {remaining} or fewer for {vtype}.",
                "booking_data": booking_data,
                "complete": False
            }

        if count < 1:
            return {
                "message": f"Please enter at least 1 ticket. You have {remaining} ticket(s) left.",
                "booking_data": booking_data,
                "complete": False
            }

        # Add to combo
        combo[vtype] = combo.get(vtype, 0) + count
        booking_data["visitor_combo"] = combo
        booking_data["visitor_combo_remaining"] = remaining - count

        if booking_data["visitor_combo_remaining"] <= 0:
            return self._finalize_visitor_combo(booking_data)
        else:
            return self._ask_next_visitor_combo(booking_data)

    def _finalize_visitor_combo(self, booking_data: Dict) -> Dict[str, Any]:
        """Finalize the visitor combo, calculate total, and set visitor_type summary."""
        combo = booking_data.get("visitor_combo", {})

        # Calculate total
        total = 0
        combo_lines = []
        for vtype, count in combo.items():
            price = PRICES.get(vtype, 200)
            subtotal = price * count
            total += subtotal
            combo_lines.append(f"  {count}× {vtype} @ ₹{price} = ₹{subtotal}")

        # Build a visitor_type summary string
        visitor_summary = ", ".join(f"{count}× {vtype}" for vtype, count in combo.items() if count > 0)
        booking_data["visitor_type"] = visitor_summary

        # Also store the primary visitor type (the one with most tickets) for API compatibility
        primary_type = max(combo, key=combo.get) if combo else "Adult"
        booking_data["primary_visitor_type"] = primary_type
        booking_data["visitor_combo_remaining"] = 0

        summary = "\n".join(combo_lines)
        return {
            "message": f"Excellent! 👤 Visitor combination selected:\n{summary}\n\n💰 Total Amount: ₹{total}",
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
                if date_obj.date() >= datetime.now().date():
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
                        if date_obj.date() >= datetime.now().date():
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

    def parse_multiple_visitor_types(self, text: str) -> Dict[str, int]:
        text_lower = text.lower()
        # Clean specific punctuation to simplify matching
        clean_text = re.sub(r'[:\-=\?]', ' ', text_lower)
        
        # Regex to match: [count] [category] [count]
        pattern = r'\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)?\s*(?:tickets?\s*)?(?:for\s*|of\s*|each\s*|for\s*each\s*)?(adults?|grown\s*ups?|grown\-ups?|regular|child(?:ren)?|kids?|minors?|senior\s*citizens?|seniors?|elderly|old|students?|colleges?|schools?|professors?|teachers?|facult(?:y|ies)|researchers?|scientists?)\s*(one|two|three|four|five|six|seven|eight|nine|ten|\d+)?\b'
        
        matches = re.finditer(pattern, clean_text)
        parsed_combos = {}
        
        word_to_num = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10
        }
        
        for m in matches:
            g1, category_word, g3 = m.groups()
            
            vtype = None
            if any(x in category_word for x in ["adult", "grown", "regular"]):
                vtype = "Adult"
            elif any(x in category_word for x in ["child", "kid", "minor"]):
                vtype = "Child"
            elif any(x in category_word for x in ["senior", "elderly", "old"]):
                vtype = "Senior Citizen"
            elif any(x in category_word for x in ["student", "college", "school"]):
                vtype = "Student"
            elif any(x in category_word for x in ["professor", "teacher", "faculty"]):
                vtype = "Professor"
            elif any(x in category_word for x in ["research", "scientist", "researcher"]):
                vtype = "Researcher/Scientist"
                
            if not vtype:
                continue
                
            count = None
            count_str = g1 or g3
            if count_str:
                count_str = count_str.strip()
                if count_str.isdigit():
                    count = int(count_str)
                else:
                    count = word_to_num.get(count_str)
            
            if count is None:
                count = 1
                
            parsed_combos[vtype] = parsed_combos.get(vtype, 0) + count
            
        return parsed_combos
