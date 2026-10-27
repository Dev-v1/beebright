from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "BeeBright API"
    merriam_webster_api_key: str = ""
    frontend_url: str = "http://localhost:5173"
    additional_frontend_urls: str = ""
    database_url: str = ""
    clerk_jwt_key: str = ""
    clerk_issuer_url: str = ""
    admin_clerk_user_ids: str = ""

    @property
    def frontend_origins(self) -> list[str]:
        origins = [
            "http://localhost:5173",
            self.frontend_url,
            *self.additional_frontend_urls.split(","),
        ]
        return list(dict.fromkeys(
            origin.strip().rstrip("/") for origin in origins if origin.strip()
        ))

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
