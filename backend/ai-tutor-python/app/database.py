from motor.motor_asyncio import AsyncIOMotorClient
from .config import get_settings

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    """Create the MongoDB motor client."""
    global _client
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.mongodb_uri)
    # Verify connection
    await _client.admin.command("ping")
    print("✅ Connected to MongoDB")


async def close_db() -> None:
    """Close the MongoDB motor client."""
    global _client
    if _client:
        _client.close()
        print("🔌 Disconnected from MongoDB")


def get_db():
    """Return the database handle."""
    settings = get_settings()
    if _client is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")
    return _client[settings.db_name]
