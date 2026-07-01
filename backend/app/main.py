import redis
import os

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from contextlib import asynccontextmanager

from app.database import Base, SessionLocal, engine, get_db
from app.models.role import Role
from app.repositories.role_repository import get_role_by_name
from app.repositories.user_repository import create_user, get_user_by_email
from app.routers.analytics import router as analytics_router
from app.routers.announcements import (
    announcement_router,
    event_router as event_announcement_router,
)
from app.routers.admin import router as admin_router
from app.routers.audit_logs import router as audit_logs_router
from app.routers.auth_router import router as auth_router
from app.routers.events import router as events_router
from app.routers.registrations import (
    event_participants_router,
    event_registration_router,
    me_router as registrations_me_router,
)
from app.routers.teams import event_teams_router, teams_router
from app.routers.challenges import (
    challenges_router,
    event_challenges_router,
)
from app.routers.leaderboard import router as leaderboard_router
from app.routers.resources import (
    event_resource_router,
    resource_router,
)
from app.routers.roles import router as roles_router
from app.schemas.user import UserRegistration, UserLogin
from app.services.auth_service import (
    apply_no_store_headers,
    apply_security_headers,
    get_password_hash,
    normalize_email,
    validate_password_policy,
)


@asynccontextmanager
async def lifespan(app):
    startup_database()
    yield


app = FastAPI(
    title="FlagSync API",
    description="Backend API for the FlagSync platform",
    version="0.1.0",
    lifespan=lifespan,
)

# Allows the local React/Vite frontend to call this backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def security_headers_middleware(request, call_next):
    response = await call_next(request)
    apply_security_headers(response)

    if request.url.path.startswith(("/api/auth", "/api/audit-logs", "/api/admin")):
        apply_no_store_headers(response)

    return response


app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(roles_router)
app.include_router(events_router)
app.include_router(event_announcement_router)
app.include_router(announcement_router)
app.include_router(event_resource_router)
app.include_router(resource_router)
app.include_router(event_registration_router)
app.include_router(event_participants_router)
app.include_router(registrations_me_router)
app.include_router(event_teams_router)
app.include_router(teams_router)
app.include_router(event_challenges_router)
app.include_router(challenges_router)
app.include_router(leaderboard_router)
app.include_router(analytics_router)
app.include_router(audit_logs_router)
app.include_router(admin_router)


def startup_database() -> None:
    Base.metadata.create_all(bind=engine)
    _seed_reference_data()


def _seed_reference_data() -> None:
    default_roles = ["administrator", "organiser", "user"]

    with SessionLocal() as db:
        for role_name in default_roles:
            if get_role_by_name(db, role_name) is None:
                db.add(Role(role_name=role_name))

        db.commit()

        admin_email = os.getenv("CTF_BOOTSTRAP_ADMIN_EMAIL")
        admin_password = os.getenv("CTF_BOOTSTRAP_ADMIN_PASSWORD")
        admin_role_name = os.getenv("CTF_BOOTSTRAP_ADMIN_ROLE", "administrator")
        admin_display_name = os.getenv("CTF_BOOTSTRAP_ADMIN_NAME", "CTF Admin")

        if not admin_email or not admin_password:
            return

        validate_password_policy(admin_password)
        normalized_email = normalize_email(admin_email)
        if get_user_by_email(db, normalized_email) is not None:
            return

        admin_role = get_role_by_name(db, admin_role_name)
        if admin_role is None:
            return

        create_user(
            db,
            email=normalized_email,
            display_name=admin_display_name,
            password_hash=get_password_hash(admin_password),
            role_id=admin_role.role_id,
        )
        db.commit()


@app.get("/")
def root():
    return {"message": "FlagSync backend is running"}


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "flagsync-api",
    }


@app.get("/api/health/database")
def database_health_check(
    db: Session = Depends(get_db),
):
    try:
        db.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected",
        }

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable",
        )