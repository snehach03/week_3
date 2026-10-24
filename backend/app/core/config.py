import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "Tomorrow's Tray"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'tomorrows_tray.db'}")
    
    # Ollama / Gemma
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma2:2b")
    OLLAMA_TIMEOUT_SECONDS: float = 3.5
    
    # Forecasting defaults
    DEFAULT_CONFIDENCE_LEVEL: float = 0.80  # P10 to P90
    MIN_OBSERVATIONS_FOR_ML: int = 14
    MIN_OBSERVATIONS_FOR_INTERVALS: int = 7
    
    model_config = SettingsConfigDict(case_sensitive=True)

settings = Settings()
