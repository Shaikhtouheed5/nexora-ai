from supabase import create_client, Client
from core.config import settings
from utils.logger import get_logger

logger = get_logger("supabase_client")

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
        logger.info("Supabase client initialised.")
    return _client
