from flask import Flask, request, jsonify
from flask_cors import CORS
from chatbot.museum_assistant import MuseumAssistant
from dotenv import load_dotenv
import os
import logging
import re
import requests
from firebase_admin_helper import push_chat_message


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)
CORS(app)

SUPPORTED_LANGUAGES = {"en", "hi", "bn", "ta"}

CHAT_TRANSLATIONS = {
    "hi": {
        "service_unavailable": "चैटबॉट सेवा अभी उपलब्ध नहीं है",
        "invalid_request": "अनुरोध का प्रारूप सही नहीं है",
        "message_required": "संदेश आवश्यक है",
        "message_too_long": "संदेश बहुत लंबा है (अधिकतम 1000 अक्षर)",
        "processing_error": "क्षमा करें, आपका संदेश प्रोसेस करते समय समस्या हुई। कृपया फिर से कोशिश करें।",
        "fallback": "मैं आपकी मदद के लिए तैयार हूं। कृपया अपना सवाल थोड़ा स्पष्ट करें।",
        "no_museums": "मिलते-जुलते संग्रहालय नहीं मिले। कृपया संग्रहालय का नाम या शहर लिखें।",
        "museum_results": "ये संग्रहालय मिले:\n{message}",
        "no_booking": "पुष्टि के लिए कोई बुकिंग तैयार नहीं है। क्या आप बुकिंग शुरू करना चाहते हैं?",
        "payment_success": "भुगतान सफल हुआ। आपकी बुकिंग आईडी {booking_id} है। यात्रा का आनंद लें!",
        "payment_simulated": "भुगतान सिम्युलेट किया गया। आपकी बुकिंग आईडी {booking_id} है।",
        "account_created": "{email} के लिए अकाउंट बन गया है। आप अब साइन इन हैं।",
        "signed_in": "आप {email} के रूप में साइन इन हो गए हैं।",
        "email_prompt": "कृपया अपना ईमेल पता भेजें।",
        "password_prompt": "कृपया अपना पासवर्ड भेजें।",
        "signup_start": "ठीक है, आपका अकाउंट बनाते हैं। आपका ईमेल पता क्या है?",
        "booking_confirm": "क्या आप इस बुकिंग की पुष्टि करना चाहते हैं?",
        "assistant_welcome": "नमस्ते! भारत संग्रहालय में आपका स्वागत है। मैं आपकी टिकट और संग्रहालय जानकारी में मदद के लिए यहाँ हूँ।"
    },
    "bn": {
        "service_unavailable": "চ্যাটবট পরিষেবা এখন উপলভ্য নয়",
        "invalid_request": "অনুরোধের ফরম্যাট সঠিক নয়",
        "message_required": "মেসেজ প্রয়োজন",
        "message_too_long": "মেসেজ খুব বড় (সর্বোচ্চ 1000 অক্ষর)",
        "processing_error": "দুঃখিত, আপনার মেসেজ প্রসেস করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।",
        "fallback": "আমি আপনাকে সাহায্য করতে প্রস্তুত। অনুগ্রহ করে আপনার প্রশ্নটি আরেকটু স্পষ্ট করে লিখুন।",
        "no_museums": "মিলে যাওয়া মিউজিয়াম পাওয়া যায়নি। মিউজিয়ামের নাম বা শহর লিখুন।",
        "museum_results": "এই মিউজিয়ামগুলো পাওয়া গেছে:\n{message}",
        "no_booking": "নিশ্চিত করার মতো কোনো বুকিং প্রস্তুত নেই। আপনি কি বুকিং শুরু করতে চান?",
        "payment_success": "পেমেন্ট সফল হয়েছে। আপনার বুকিং আইডি {booking_id}। ভ্রমণ উপভোগ করুন!",
        "payment_simulated": "পেমেন্ট সিমুলেট করা হয়েছে। আপনার বুকিং আইডি {booking_id}।",
        "account_created": "{email} এর জন্য অ্যাকাউন্ট তৈরি হয়েছে। আপনি এখন সাইন ইন করেছেন।",
        "signed_in": "আপনি {email} হিসেবে সাইন ইন করেছেন।",
        "email_prompt": "দয়া করে আপনার ইমেল ঠিকানা পাঠান।",
        "password_prompt": "দয়া করে আপনার পাসওয়ার্ড পাঠান।",
        "signup_start": "ঠিক আছে, আপনার অ্যাকাউন্ট তৈরি করি। আপনার ইমেল ঠিকানা কী?",
        "booking_confirm": "আপনি কি এই বুকিং নিশ্চিত করতে চান?",
        "assistant_welcome": "হ্যালো! ভারত মিউজিয়ামে স্বাগতম। টিকিট ও মিউজিয়াম তথ্যের জন্য আমি আপনাকে সহায়তা করতে পারি।"
    },
    "ta": {
        "service_unavailable": "சாட்பாட் சேவை தற்போது கிடைக்கவில்லை",
        "invalid_request": "கோரிக்கை வடிவம் சரியாக இல்லை",
        "message_required": "செய்தி அவசியம்",
        "message_too_long": "செய்தி மிக நீளமாக உள்ளது (அதிகபட்சம் 1000 எழுத்துகள்)",
        "processing_error": "மன்னிக்கவும், உங்கள் செய்தியை செயலாக்கும்போது பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.",
        "fallback": "நான் உங்களுக்கு உதவ தயாராக உள்ளேன். தயவுசெய்து உங்கள் கேள்வியை கொஞ்சம் தெளிவாக எழுதுங்கள்.",
        "no_museums": "பொருந்தும் அருங்காட்சியகங்கள் கிடைக்கவில்லை. அருங்காட்சியகத்தின் பெயர் அல்லது நகரத்தை எழுதுங்கள்.",
        "museum_results": "இந்த அருங்காட்சியகங்கள் கிடைத்தன:\n{message}",
        "no_booking": "உறுதிப்படுத்த தயாரான முன்பதிவு இல்லை. முன்பதிவை தொடங்க விரும்புகிறீர்களா?",
        "payment_success": "கட்டணம் வெற்றிகரமாக முடிந்தது. உங்கள் முன்பதிவு ஐடி {booking_id}. உங்கள் வருகையை மகிழுங்கள்!",
        "payment_simulated": "கட்டணம் சிமுலேட் செய்யப்பட்டது. உங்கள் முன்பதிவு ஐடி {booking_id}.",
        "account_created": "{email} க்கான கணக்கு உருவாக்கப்பட்டது. நீங்கள் இப்போது உள்நுழைந்துள்ளீர்கள்.",
        "signed_in": "நீங்கள் {email} ஆக உள்நுழைந்துள்ளீர்கள்.",
        "email_prompt": "தயவுசெய்து உங்கள் மின்னஞ்சல் முகவரியை அனுப்புங்கள்.",
        "password_prompt": "தயவுசெய்து உங்கள் கடவுச்சொல்லை அனுப்புங்கள்.",
        "signup_start": "சரி, உங்கள் கணக்கை உருவாக்கலாம். உங்கள் மின்னஞ்சல் முகவரி என்ன?",
        "booking_confirm": "இந்த முன்பதிவை உறுதிப்படுத்த விரும்புகிறீர்களா?",
        "assistant_welcome": "வணக்கம்! பாரத் அருங்காட்சியகத்திற்கு வரவேற்கிறோம். டிக்கெட் மற்றும் அருங்காட்சியக தகவல்களில் நான் உதவ முடியும்."
    }
}


def is_truthy(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def normalize_language(language: str) -> str:
    language_code = str(language or "en").strip().lower()
    return language_code if language_code in SUPPORTED_LANGUAGES else "en"


def translate_chat(language: str, key: str, **kwargs) -> str:
    if language == "en":
        english = {
            "service_unavailable": "Chatbot service is currently unavailable",
            "invalid_request": "Invalid request format",
            "message_required": "Message is required",
            "message_too_long": "Message too long (max 1000 characters)",
            "processing_error": "I apologize, but I encountered an error processing your message. Please try again.",
        }
        return english.get(key, key).format(**kwargs)

    template = CHAT_TRANSLATIONS.get(language, {}).get(key, key)
    return template.format(**kwargs)


def extract_email(message: str) -> str:
    match = re.search(r"[\w\.-]+@[\w\.-]+", message or "")
    return match.group(0) if match else ""


def extract_booking_id(message: str) -> str:
    match = re.search(r"\b(?:BM|BK)\d+\b", message or "", re.IGNORECASE)
    return match.group(0) if match else "N/A"


def localize_bot_message(message: str, language: str, intent: str = "") -> str:
    if language == "en" or not message:
        return message

    text = message.lower()
    email = extract_email(message)

    if "couldn't find matching museums" in text:
        return translate_chat(language, "no_museums")
    if (
        "welcome to bharat museum" in text
        or "i'm here to help" in text
        or "how can i assist you today" in text
    ):
        return translate_chat(language, "assistant_welcome")
    if intent == "search_ticket" and "\n" in message:
        return translate_chat(language, "museum_results", message=message)
    if "no booking ready to confirm" in text:
        return translate_chat(language, "no_booking")
    if "payment successful" in text:
        return translate_chat(language, "payment_success", booking_id=extract_booking_id(message))
    if "payment simulated" in text:
        return translate_chat(language, "payment_simulated", booking_id=extract_booking_id(message))
    if "account created" in text:
        return translate_chat(language, "account_created", email=email or "your email")
    if "signed in" in text:
        return translate_chat(language, "signed_in", email=email or "your email")
    if "provide your email" in text or "detect an email" in text:
        return translate_chat(language, "email_prompt")
    if "provide your password" in text or "provide a password" in text:
        return translate_chat(language, "password_prompt")
    if "create your account" in text:
        return translate_chat(language, "signup_start")
    if "would you like to confirm this booking" in text:
        return message.replace("Would you like to confirm this booking?", translate_chat(language, "booking_confirm"))

    return translate_chat(language, "fallback", message=message)


try:
    assistant = MuseumAssistant()
    logger.info("Museum assistant initialized successfully")
except Exception as err:
    logger.error("Failed to initialize museum assistant: %s", err)
    assistant = None


@app.route('/health', methods=['GET'])
def health_check():
    logger.info("Health check - assistant is None: %s", assistant is None)
    if assistant is None:
        return jsonify({
            "status": "unhealthy",
            "message": "Chatbot engine failed to initialize"
        }), 503

    return jsonify({
        "status": "healthy",
        "message": "Chatbot engine is running"
    })


@app.route('/chat', methods=['POST'])
def chat():
    try:
        if assistant is None:
            logger.error("Assistant not initialized")
            return jsonify({"error": translate_chat("en", "service_unavailable")}), 503

        if not request.is_json:
            return jsonify({"error": translate_chat("en", "invalid_request")}), 400

        data = request.get_json(silent=True) or {}
        user_message = str(data.get('message', '')).strip()
        session_id = str(data.get('session_id', 'default')).strip() or 'default'
        language = normalize_language(data.get('language', 'en'))

        if not user_message:
            return jsonify({"error": translate_chat(language, "message_required")}), 400

        if len(user_message) > 1000:
            return jsonify({"error": translate_chat(language, "message_too_long")}), 400

        if len(session_id) > 100:
            session_id = session_id[:100]

        logger.info("Processing message for session: %s", session_id)

        try:
            response = assistant.process_message(user_message, session_id, language)
            response["message"] = localize_bot_message(
                response.get("message", ""),
                language,
                response.get("intent", "")
            )
        except Exception as proc_err:
            logger.error("Error processing message: %s", proc_err)
            return jsonify({
                "response": translate_chat(language, "processing_error"),
                "intent": "error",
                "language": language,
                "booking_data": {}
            }), 200

        # Attempt to persist message logs to Firebase RTDB via Python SDK first
        try:
            push_payload = {
                'sender': 'user',
                'message': user_message,
                'timestamp': int(__import__('time').time() * 1000)
            }
            push_chat_message(session_id, push_payload)

            bot_payload = {
                'sender': 'bot',
                'message': response.get('message', ''),
                'intent': response.get('intent'),
                'language': language,
                'booking_data': response.get('booking_data', {}),
                'timestamp': int(__import__('time').time() * 1000)
            }
            push_chat_message(session_id, bot_payload)
        except Exception:
            logger.debug('Failed to write chat messages to RTDB via Python SDK, will try forwarding to Next.js store route')

        # If Python SDK failed or not configured, still try forwarding to Next.js store route (non-blocking)
        try:
            api_base = os.environ.get('CHATBOT_API_URL') or 'http://localhost:3000'
            store_payload = {
                'session_id': session_id,
                'user_message': user_message,
                'bot_message': response.get('message', ''),
                'intent': response.get('intent'),
                'language': language,
                'booking_data': response.get('booking_data', {})
            }
            try:
                requests.post(f"{api_base}/api/chat/store", json=store_payload, timeout=2)
            except Exception as _post_err:
                logger.debug("Failed to forward chat log to %s: %s", api_base, _post_err)
        except Exception:
            logger.debug("Skipping chat log forward due to environment or payload error")

        return jsonify({
            "response": response.get("message", "I'm sorry, I couldn't process that."),
            "intent": response.get("intent", "unknown"),
            "language": language,
            "booking_data": response.get("booking_data", {})
        }), 200
    except Exception as err:
        logger.error("Unexpected error in chat endpoint: %s", err)
        return jsonify({
            "error": "An unexpected error occurred",
            "details": str(err) if app.debug else None
        }), 500


@app.route('/reset', methods=['POST'])
def reset_session():
    try:
        if assistant is None:
            return jsonify({"error": "Chatbot service is currently unavailable"}), 503

        data = request.get_json(silent=True) or {}
        session_id = str(data.get('session_id', 'default')).strip() or 'default'
        if len(session_id) > 100:
            session_id = session_id[:100]

        assistant.reset_session(session_id)
        logger.info("Session reset: %s", session_id)

        return jsonify({"message": "Session reset successfully"}), 200
    except Exception as err:
        logger.error("Error resetting session: %s", err)
        return jsonify({"error": str(err)}), 500


@app.errorhandler(404)
def not_found(_error):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error("Internal server error: %s", error)
    return jsonify({"error": "Internal server error"}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', '5001'))
    debug_mode = is_truthy(os.getenv('DEBUG', 'false')) or os.getenv('FLASK_ENV', 'production') == 'development'

    logger.info("Starting chatbot engine on port %s", port)
    logger.info("Debug mode: %s", debug_mode)

    app.run(host='0.0.0.0', port=port, debug=debug_mode)
