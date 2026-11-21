"""Application configuration using Pydantic Settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "Hedgile"
    debug: bool = False

    # Database
    database_url: str = "sqlite+aiosqlite:///./hedgile.db"

    # LaimonID OAuth2
    laimonid_client_id: str = ""
    laimonid_client_secret: str = ""
    laimonid_authorize_url: str = "https://auth.laimonade.com/authorize"
    laimonid_token_url: str = "https://auth.laimonade.com/token"
    laimonid_userinfo_url: str = "https://auth.laimonade.com/userinfo"

    # Security
    secret_key: str = "change-me-in-production-use-secrets"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Seed organisation
    seed_organisation_name: str = "Hedgile"


# Create settings instance
settings = Settings()
