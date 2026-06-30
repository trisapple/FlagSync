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
from app.routers.admin import router as admin_router
from app.routers.audit_logs import router as audit_logs_router
from app.routers.auth_router import router as auth_router
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


# The "user_data: UserRegistration" part is the magic.
# FastAPI will automatically run all your Pydantic security checks here.
@app.post("/api/register")
async def register_user(user_data: UserRegistration):
    # If the code reaches this line, the input is 100% safe and sanitized.
    return {
        "message": "Payload is secure. Ready to hash password and save to DB!",
        "data": user_data,
    }


# 1. Setup the Password Hasher (Using bcrypt with 12 rounds as required by NSR-R4)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 2. Setup the Redis Connection (Your fast, temporary memory vault)
redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)


@app.post("/api/login")
async def login_user(credentials: UserLogin):
    # Create a unique tracking key in Redis for this email
    redis_key = f"login_attempts:{credentials.email}"

    # --- DEFENSE 1: Check for Lockout ---
    failed_attempts = redis_client.get(redis_key)

    if failed_attempts and int(failed_attempts) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account locked due to too many failed attempts. Try again in 15 minutes.",
        )

    # --- MOCK DATABASE CHECK ---
    # (Your SE teammates will replace this with the real Supabase database query later)
    db_email = "admin@flagsync.com"
    db_hashed_password = pwd_context.hash("SuperSecurePassword123!")

    # --- DEFENSE 2: Verify Credentials ---
    is_email_correct = credentials.email == db_email
    is_password_correct = pwd_context.verify(credentials.password, db_hashed_password)

    if not is_email_correct or not is_password_correct:
        # Increment the failure counter in Redis
        redis_client.incr(redis_key)

        # If this is their 5th strike, lock them out for 15 minutes (900 seconds)
        if int(redis_client.get(redis_key)) >= 5:
            redis_client.expire(redis_key, 900)
        # Otherwise, reset the 10-minute tracking window (600 seconds)
        else:
            redis_client.expire(redis_key, 600)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    # --- SUCCESS ---
    # If they log in successfully, wipe their failure slate clean!
    redis_client.delete(redis_key)

    return {"message": "Login successful! Session token would be issued here."}
