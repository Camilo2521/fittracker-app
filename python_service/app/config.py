from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Base de datos (SQLite por defecto; reemplazar con PostgreSQL en producción)
    database_url:      str = "sqlite+aiosqlite:///./fittracker_lite.db"
    database_url_sync: str = "sqlite:///./fittracker_lite.db"

    # Seguridad interna Node ↔ Python
    internal_api_secret: str = "changeme"

    # LLM
    openai_api_key: str = ""

    # YOLO
    yolo_model_path: str = "yolov8n-pose.pt"

    # Feature flags
    feature_yolo_enabled: bool = True
    feature_rag_enabled:  bool = False

    environment: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
