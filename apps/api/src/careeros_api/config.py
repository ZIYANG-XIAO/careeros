from functools import lru_cache

from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    web_origin: AnyHttpUrl
    clerk_issuer_url: str
    openai_api_key: str | None = None
    openai_resume_parser_model: str = "gpt-5-mini"
    openai_job_parser_model: str = "gpt-5-mini"
    openai_job_matcher_model: str = "gpt-5-mini"
    openai_answer_classifier_model: str = "gpt-5-mini"
    resume_storage_dir: str = ".local/resume-assets"
    max_resume_size_bytes: int = 10 * 1024 * 1024

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
