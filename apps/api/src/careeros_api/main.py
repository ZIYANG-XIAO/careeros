import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from careeros_api.account import router as account_router
from careeros_api.answer_engine import router as answer_engine_router
from careeros_api.application import router as application_router
from careeros_api.application_contacts import router as application_contacts_router
from careeros_api.calendar_export import router as calendar_router
from careeros_api.career_brain import router as career_brain_router
from careeros_api.config import Settings, get_settings
from careeros_api.contact_info import router as contact_info_router
from careeros_api.education import router as education_router
from careeros_api.experience import router as experience_router
from careeros_api.health import router as health_router
from careeros_api.job import router as job_router
from careeros_api.job_intelligence import router as job_intelligence_router
from careeros_api.job_preferences import router as job_preferences_router
from careeros_api.job_search_goals import router as job_search_goals_router
from careeros_api.observability import RequestContextMiddleware
from careeros_api.project import router as project_router
from careeros_api.resume import router as resume_router
from careeros_api.reusable_answers import router as reusable_answers_router
from careeros_api.skill import router as skill_router
from careeros_api.user import router as user_router


def create_app(settings: Settings | None = None) -> FastAPI:
    application_settings = settings or get_settings()
    logging.basicConfig(level=application_settings.log_level.upper(), format="%(message)s")
    application = FastAPI(title="CareerOS API", version="0.1.0")
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[str(application_settings.web_origin).rstrip("/")],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Accept", "Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    # Added last so it wraps CORS and every response carries the request ID.
    application.add_middleware(RequestContextMiddleware)
    application.include_router(health_router)
    application.include_router(user_router)
    application.include_router(account_router)
    application.include_router(contact_info_router)
    application.include_router(job_preferences_router)
    application.include_router(job_search_goals_router)
    application.include_router(career_brain_router)
    application.include_router(education_router)
    application.include_router(experience_router)
    application.include_router(project_router)
    application.include_router(skill_router)
    application.include_router(resume_router)
    application.include_router(job_router)
    application.include_router(job_intelligence_router)
    application.include_router(answer_engine_router)
    application.include_router(reusable_answers_router)
    application.include_router(application_router)
    application.include_router(application_contacts_router)
    application.include_router(calendar_router)
    return application


app = create_app()
