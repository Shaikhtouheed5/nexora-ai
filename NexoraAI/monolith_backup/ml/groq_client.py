import os
import random
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Get API keys from environment
api_keys_str = os.getenv("GROQ_API_KEYS", "")
api_keys = [key.strip() for key in api_keys_str.split(",") if key.strip()]

# If old key exists, add it to the pool
old_key = os.getenv("GROQ_API_KEY")
if old_key and old_key not in api_keys:
    api_keys.append(old_key)

_clients = [Groq(api_key=key) for key in api_keys] if api_keys else []

def get_groq_client():
    """Returns a Groq client, load-balanced across available keys."""
    if not _clients:
        return None
    return random.choice(_clients)

def get_model_name():
    """Returns the preferred model name."""
    return "llama-3.3-70b-versatile"
