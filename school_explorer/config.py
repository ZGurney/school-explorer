from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "postgresql://postgres:password@localhost:5432/school_explorer"
    data_raw_dir: Path = Path("./data/raw")
    force_download: bool = False
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:5173"]

    def raw_path(self, filename: str) -> Path:
        """Return the full path for a cached raw file, creating the dir if needed."""
        self.data_raw_dir.mkdir(parents=True, exist_ok=True)
        return self.data_raw_dir / filename


settings = Settings()
