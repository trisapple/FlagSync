from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import redis
from fastapi import HTTPException, Request, Response, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import InvalidHashError, UnknownHashError
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.user_repository import get_user_by_email, get_user_by_id

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "30"))
MAX_LOGIN_ATTEMPTS = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
LOCKOUT_TIME_SECONDS = int(os.getenv("LOCKOUT_TIME_SECONDS", "900"))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "strict")
COOKIE_NAME = os.getenv("COOKIE_NAME", "access_token")

pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")


def _build_redis_client() -> redis.Redis | None:
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        return redis.Redis.from_url(redis_url, decode_responses=True)

    redis_host = os.getenv("REDIS_HOST")
    if redis_host:
        return redis.Redis(
            host=redis_host,
            port=int(os.getenv("REDIS_PORT", "6379")),
            db=int(os.getenv("REDIS_DB", "0")),
            decode_responses=True,
        )

    return None


redis_client = _build_redis_client()
_fallback_lockouts: dict[str, tuple[int, float]] = {}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (InvalidHashError, UnknownHashError, TypeError, ValueError):
        return False


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(claims: dict[str, Any]) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    token_payload = {**claims, "exp": expires_at}
    return jwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def build_lockout_key(
    client_ip: str,
    email: str,
) -> str:
    return f"login_attempts:{client_ip}:{normalize_email(email)}"


def get_failed_login_attempts(lockout_key: str) -> int:
    if redis_client is not None:
        try:
            attempts = redis_client.get(lockout_key)
            return int(attempts) if attempts is not None else 0
        except redis.RedisError:
            pass

    attempts, expires_at = _fallback_lockouts.get(lockout_key, (0, 0.0))
    if attempts and time.monotonic() > expires_at:
        _fallback_lockouts.pop(lockout_key, None)
        return 0

    return attempts


def is_account_locked(lockout_key: str) -> bool:
    return get_failed_login_attempts(lockout_key) >= MAX_LOGIN_ATTEMPTS


def register_failed_login(lockout_key: str) -> int:
    if redis_client is not None:
        try:
            attempts = redis_client.incr(lockout_key)
            if attempts == 1:
                redis_client.expire(lockout_key, LOCKOUT_TIME_SECONDS)
            return int(attempts)
        except redis.RedisError:
            pass

    attempts, expires_at = _fallback_lockouts.get(lockout_key, (0, 0.0))
    if attempts == 0 or time.monotonic() > expires_at:
        attempts = 0
        expires_at = time.monotonic() + LOCKOUT_TIME_SECONDS

    attempts += 1
    _fallback_lockouts[lockout_key] = (attempts, expires_at)
    return attempts


def clear_failed_logins(lockout_key: str) -> None:
    if redis_client is not None:
        try:
            redis_client.delete(lockout_key)
            return
        except redis.RedisError:
            pass

    _fallback_lockouts.pop(lockout_key, None)


def set_auth_cookie(
    response: Response,
    token: str,
) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_MINUTES * 60,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
    )


def get_token_from_request(request: Request) -> str | None:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        return token

    authorization = request.headers.get("Authorization")
    if authorization and authorization.startswith("Bearer "):
        return authorization.removeprefix("Bearer ").strip()

    return None


def get_current_user_from_request(
    request: Request,
    db: Session,
) -> User:
    token = get_token_from_request(request)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    try:
        token_data = decode_access_token(token)
        user_id = int(token_data["sub"])
    except (JWTError, KeyError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    user = get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    return user


def get_user_auth_payload(user: User) -> dict[str, Any]:
    return {
        "user_id": user.user_id,
        "email": user.email,
        "display_name": user.display_name,
        "role_name": user.role.role_name if user.role is not None else None,
    }


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> User | None:
    user = get_user_by_email(db, normalize_email(email))
    if user is None or not verify_password(password, user.password_hash):
        return None

    return user
