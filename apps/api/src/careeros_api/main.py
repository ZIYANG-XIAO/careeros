from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from careeros_api.career_brain import router as career_brain_router
from careeros_api.config import Settings, get_settings
from careeros_api.education import router as education_router
from careeros_api.experience import router as experience_router
from careeros_api.health import router as health_router
from careeros_api.project import router as project_router
from careeros_api.skill import router as skill_router
from careeros_api.user import router as user_router


def create_app(settings: Settings | None = None) -> FastAPI:
    application_settings = settings or get_settings()
    application = FastAPI(title="CareerOS API", version="0.1.0")
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[str(application_settings.web_origin).rstrip("/")],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Accept", "Authorization", "Content-Type"],
    )
    application.include_router(health_router)
    application.include_router(user_router)
    application.include_router(career_brain_router)
    application.include_router(education_router)
    application.include_router(experience_router)
    application.include_router(project_router)
    application.include_router(skill_router)
    return application


app = create_app()
