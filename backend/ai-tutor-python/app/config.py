from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    mongodb_uri: str
    db_name: str = "tutorsgyan_prod"
    secret_key: str
    openai_api_key: str
    cors_origins: str = "http://localhost:3000"
    
    # Auth
    google_client_id: str
    google_client_secret: str
    jwt_secret: str = "" # Fallback mapped in init if empty
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7 # 7 days
    frontend_url: str = "http://localhost:3000"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.jwt_secret:
            self.jwt_secret = self.secret_key


    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
