import os
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_app_initialized = False

def init_firebase_admin():
    global _app_initialized
    if _app_initialized:
        return True

    try:
        import firebase_admin
        from firebase_admin import credentials

        project_id = os.environ.get('FIREBASE_PROJECT_ID')
        client_email = os.environ.get('FIREBASE_CLIENT_EMAIL')
        private_key = os.environ.get('FIREBASE_PRIVATE_KEY')
        database_url = os.environ.get('FIREBASE_DATABASE_URL') or os.environ.get('NEXT_PUBLIC_FIREBASE_DATABASE_URL')

        if not (project_id and client_email and private_key):
            logger.debug('Firebase admin env vars missing; skipping Firebase admin init')
            return False

        # private_key may contain escaped newlines
        private_key = private_key.replace('\\n', '\n')

        cred_dict = {
            'type': 'service_account',
            'project_id': project_id,
            'private_key': private_key,
            'client_email': client_email,
        }

        cred = credentials.Certificate(cred_dict)
        options = {'databaseURL': database_url} if database_url else None
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred, options)
        _app_initialized = True
        logger.info('Firebase admin initialized')
        return True
    except Exception as e:
        logger.debug('Failed to initialize firebase admin: %s', e)
        return False


def get_firestore_client() -> Optional[Any]:
    try:
        if not init_firebase_admin():
            return None

        from firebase_admin import firestore

        return firestore.client()
    except Exception as e:
        logger.debug('Failed to create Firestore client: %s', e)
        return None


def push_chat_message(session_id: str, payload: Dict[str, Any]):
    try:
        from firebase_admin import db

        if not init_firebase_admin():
            return False

        database_url = os.environ.get('FIREBASE_DATABASE_URL') or os.environ.get('NEXT_PUBLIC_FIREBASE_DATABASE_URL')
        if not database_url:
            logger.debug('Firebase database URL missing; skipping RTDB chat log write')
            return False

        safe_session_id = str(session_id or 'default').strip() or 'default'
        safe_session_id = __import__('re').sub(r'[\.#$\[\]/]+', '_', safe_session_id)
        ref = db.reference(f'chat_messages/{safe_session_id}')
        ref.push(payload)
        return True
    except Exception as e:
        logger.debug('Failed to push chat message to RTDB: %s', e)
        return False
