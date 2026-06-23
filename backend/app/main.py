import os

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine, get_db
from app.models.role import Role
from app.models.user import User
from app.repositories.role_repository import get_role_by_name
from app.repositories.user_repository import create_user, get_user_by_email
from app.routers.auth_router import router as auth_router
from app.routers.roles import router as roles_router
from app.services.auth_service import get_password_hash, normalize_email

app = FastAPI(
    title="FlagSync API",
    description="Backend API for the FlagSync platform",
    version="0.1.0",
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

app.include_router(auth_router)
app.include_router(roles_router)


@app.on_event("startup")
def startup_database() -> None:
    Base.metadata.create_all(
        bind=engine,
        tables=[Role.__table__, User.__table__],
    )
    _seed_reference_data()


def _seed_reference_data() -> None:
    default_roles = ["administrator", "organiser", "participant"]

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
