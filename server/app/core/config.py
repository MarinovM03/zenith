from functools import lru_cache

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: str = Field(default="development")
    log_level: str = Field(default="INFO")

    postgres_user: str = Field(default="zenith")
    postgres_password: str = Field(default="zenith_dev_password")
    postgres_db: str = Field(default="zenith")
    postgres_host: str = Field(default="localhost")
    postgres_port: int = Field(default=5432)

    redis_host: str = Field(default="localhost")
    redis_port: int = Field(default=6379)

    jwt_secret: str
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=15)
    refresh_token_expire_days: int = Field(default=7)
    cookie_secure: bool = Field(default=False)

    cors_origins: str = Field(default="http://localhost:4200")

    nasa_api_key: str = Field(default="DEMO_KEY")
    nasa_base_url: str = Field(default="https://api.nasa.gov")
    launch_library_base_url: str = Field(default="https://ll.thespacedevs.com/2.2.0")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/0"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
