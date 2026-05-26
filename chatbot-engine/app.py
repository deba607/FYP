from flask import Flask, request, jsonify
from flask_cors import CORS
from chatbot.museum_assistant import MuseumAssistant
from dotenv import load_dotenv
import os
import logging
from firebase_admin_helper import push_chat_message


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)
CORS(app)


def is_truthy(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


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
            return jsonify({"error": "Chatbot service is currently unavailable"}), 503

        if not request.is_json:
            return jsonify({"error": "Invalid request format"}), 400

        data = request.get_json(silent=True) or {}
        user_message = str(data.get('message', '')).strip()
        session_id = str(data.get('session_id', 'default')).strip() or 'default'

        if not user_message:
            return jsonify({"error": "Message is required"}), 400

        if len(user_message) > 1000:
            return jsonify({"error": "Message too long (max 1000 characters)"}), 400

        if len(session_id) > 100:
            session_id = session_id[:100]

        logger.info("Processing message for session: %s", session_id)

        try:
            response = assistant.process_message(user_message, session_id)
        except Exception as proc_err:
            logger.error("Error processing message: %s", proc_err)
            return jsonify({
                "response": "I apologize, but I encountered an error processing your message. Please try again.",
                "intent": "error",
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
