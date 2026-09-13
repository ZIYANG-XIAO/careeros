from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from careeros_api.config import Settings, get_settings
from careeros_api.health import router as health_router


def create_app(settings: Settings | None = None) -> FastAPI:
    application_settings = settings or get_settings()
    application = FastAPI(title="CareerOS API", version="0.0.0")
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[str(application_settings.web_origin).rstrip("/")],
        allow_credentials=True,
        allow_methods=["GET"],
        allow_headers=["Accept", "Content-Type"],
    )
    application.include_router(health_router)
    return application


app = create_app()
