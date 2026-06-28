from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import redis
import requests
from fastapi import HTTPException, Request, Response, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import InvalidHashError, UnknownHashError
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.audit_log_repository import create_audit_log
from app.repositories.user_repository import get_user_by_email, get_user_by_id


def _parse_bool(value: str | None, *, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_PRODUCTION = ENVIRONMENT in {"prod", "production"}
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "30"))
MAX_LOGIN_ATTEMPTS = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
LOCKOUT_TIME_SECONDS = int(os.getenv("LOCKOUT_TIME_SECONDS", "900"))
AUTH_RATE_LIMIT_PER_MINUTE = int(os.getenv("AUTH_RATE_LIMIT_PER_MINUTE", "10"))
REGISTRATION_CHALLENGE_TTL_SECONDS = int(
    os.getenv("REGISTRATION_CHALLENGE_TTL_SECONDS", "600"),
)
EMAIL_VERIFICATION_REQUIRED = _parse_bool(
    os.getenv("EMAIL_VERIFICATION_REQUIRED"),
    default=False,
)
EXPOSE_DEV_VERIFICATION_TOKEN = _parse_bool(
    os.getenv("EXPOSE_DEV_VERIFICATION_TOKEN"),
    default=False,
)
ENABLE_HIBP_PASSWORD_CHECK = _parse_bool(
    os.getenv("ENABLE_HIBP_PASSWORD_CHECK"),
    default=False,
)
COOKIE_SECURE = _parse_bool(
    os.getenv("COOKIE_SECURE"),
    default=IS_PRODUCTION,
)
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "strict")
COOKIE_NAME = os.getenv("COOKIE_NAME", "access_token")


def _load_secret_key() -> str:
    secret_key = os.getenv("SECRET_KEY")
    if secret_key and len(secret_key.encode("utf-8")) >= 32:
        return secret_key

    if IS_PRODUCTION:
        raise RuntimeError("SECRET_KEY must be at least 32 bytes in production")

    return secrets.token_urlsafe(32)


SECRET_KEY = _load_secret_key()

pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
)

COMMON_BREACHED_PASSWORDS = {
    "123456789",
    "1234567890",
    "admin123456",
    "letmein123",
    "password",
    "password1",
    "password123",
    "password123!",
    "qwerty123",
    "welcome123",
}


@dataclass(frozen=True)
class AuthContext:
    user: User
    token: str
    token_data: dict[str, Any]


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
_fallback_rate_limits: dict[str, tuple[int, float]] = {}
_fallback_challenges: dict[str, tuple[str, float]] = {}
_fallback_revoked_tokens: dict[str, tuple[str, float]] = {}
_fallback_email_verifications: dict[str, tuple[str, float]] = {}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",", maxsplit=1)[0].strip()

    return request.client.host if request.client is not None else "unknown"


def _redis_get(key: str) -> str | None:
    if redis_client is None:
        return None

    try:
        return redis_client.get(key)
    except redis.RedisError:
        return None


def _redis_setex(key: str, ttl_seconds: int, value: str) -> bool:
    if redis_client is None:
        return False

    try:
        redis_client.setex(key, ttl_seconds, value)
        return True
    except redis.RedisError:
        return False


def _redis_delete(key: str) -> bool:
    if redis_client is None:
        return False

    try:
        redis_client.delete(key)
        return True
    except redis.RedisError:
        return False


def _fallback_get(
    store: dict[str, tuple[str, float]],
    key: str,
) -> str | None:
    value, expires_at = store.get(key, ("", 0.0))
    if not value:
        return None
    if time.monotonic() > expires_at:
        store.pop(key, None)
        return None
    return value


def _fallback_set(
    store: dict[str, tuple[str, float]],
    key: str,
    value: str,
    ttl_seconds: int,
) -> None:
    store[key] = (value, time.monotonic() + ttl_seconds)


def _store_temporary_value(
    namespace: str,
    fallback_store: dict[str, tuple[str, float]],
    key: str,
    value: str,
    ttl_seconds: int,
) -> None:
    redis_key = f"{namespace}:{key}"
    if _redis_setex(redis_key, ttl_seconds, value):
        return

    _fallback_set(fallback_store, key, value, ttl_seconds)


def _pop_temporary_value(
    namespace: str,
    fallback_store: dict[str, tuple[str, float]],
    key: str,
) -> str | None:
    redis_key = f"{namespace}:{key}"
    redis_value = _redis_get(redis_key)
    if redis_value is not None:
        _redis_delete(redis_key)
        return redis_value

    value = _fallback_get(fallback_store, key)
    fallback_store.pop(key, None)
    return value


def check_auth_rate_limit(client_ip: str) -> bool:
    window_seconds = 60
    bucket = int(time.time() // window_seconds)
    rate_key = f"auth:{client_ip}:{bucket}"

    if redis_client is not None:
        try:
            attempts = redis_client.incr(f"rate_limit:{rate_key}")
            if attempts == 1:
                redis_client.expire(f"rate_limit:{rate_key}", window_seconds)
            return int(attempts) <= AUTH_RATE_LIMIT_PER_MINUTE
        except redis.RedisError:
            pass

    attempts, expires_at = _fallback_rate_limits.get(rate_key, (0, 0.0))
    if time.monotonic() > expires_at:
        attempts = 0
        expires_at = time.monotonic() + window_seconds

    attempts += 1
    _fallback_rate_limits[rate_key] = (attempts, expires_at)
    return attempts <= AUTH_RATE_LIMIT_PER_MINUTE


def create_registration_challenge() -> dict[str, str | int]:
    answer = f"flag-{secrets.token_hex(3)}"
    encoded_answer = base64.b64encode(answer.encode("utf-8")).decode("ascii")
    challenge_id = secrets.token_urlsafe(32)

    _store_temporary_value(
        "registration_challenge",
        _fallback_challenges,
        challenge_id,
        answer.lower(),
        REGISTRATION_CHALLENGE_TTL_SECONDS,
    )

    return {
        "challenge_id": challenge_id,
        "prompt": f"Decode this base64 value and enter the decoded text: {encoded_answer}",
        "expires_in_seconds": REGISTRATION_CHALLENGE_TTL_SECONDS,
    }


def validate_registration_challenge(
    challenge_id: str,
    challenge_answer: str,
) -> bool:
    expected_answer = _pop_temporary_value(
        "registration_challenge",
        _fallback_challenges,
        challenge_id,
    )
    if expected_answer is None:
        return False

    submitted_answer = challenge_answer.strip().lower()
    return secrets.compare_digest(expected_answer, submitted_answer)


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


def is_password_breached(password: str) -> bool:
    if password.strip().lower() in COMMON_BREACHED_PASSWORDS:
        return True

    if not ENABLE_HIBP_PASSWORD_CHECK:
        return False

    password_hash = hashlib.sha1(  # nosec B324 - required by HIBP k-anonymity API
        password.encode("utf-8"),
    ).hexdigest().upper()
    prefix = password_hash[:5]
    suffix = password_hash[5:]
    response = requests.get(
        f"https://api.pwnedpasswords.com/range/{prefix}",
        timeout=3,
    )
    response.raise_for_status()

    for line in response.text.splitlines():
        returned_suffix = line.split(":", maxsplit=1)[0]
        if secrets.compare_digest(returned_suffix, suffix):
            return True

    return False


def validate_password_policy(password: str) -> None:
    if len(password) < 12:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 12 characters long",
        )

    checks = [
        any(character.islower() for character in password),
        any(character.isupper() for character in password),
        any(character.isdigit() for character in password),
        any(not character.isalnum() for character in password),
    ]
    if not all(checks):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must include uppercase, lowercase, number, and symbol characters",
        )

    if is_password_breached(password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password appears in a known breached password list",
        )


def create_access_token(claims: dict[str, Any]) -> str:
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    token_payload = {
        **claims,
        "iat": issued_at,
        "exp": expires_at,
        "jti": secrets.token_urlsafe(32),
    }
    return jwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def _token_ttl_seconds(token_data: dict[str, Any]) -> int:
    expires_at = token_data.get("exp")
    if isinstance(expires_at, datetime):
        expiry_timestamp = int(expires_at.timestamp())
    else:
        expiry_timestamp = int(expires_at)

    return max(expiry_timestamp - int(time.time()), 1)


def is_token_revoked(jti: str) -> bool:
    if _redis_get(f"revoked_token:{jti}") is not None:
        return True

    return _fallback_get(_fallback_revoked_tokens, jti) is not None


def revoke_token(token_data: dict[str, Any]) -> None:
    jti = token_data.get("jti")
    if not isinstance(jti, str) or not jti:
        return

    _store_temporary_value(
        "revoked_token",
        _fallback_revoked_tokens,
        jti,
        "1",
        _token_ttl_seconds(token_data),
    )


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
    if _redis_delete(lockout_key):
        return

    _fallback_lockouts.pop(lockout_key, None)


def create_email_verification_token(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    _store_temporary_value(
        "email_verification",
        _fallback_email_verifications,
        token_hash,
        str(user_id),
        24 * 60 * 60,
    )
    return token


def consume_email_verification_token(token: str) -> int | None:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    user_id = _pop_temporary_value(
        "email_verification",
        _fallback_email_verifications,
        token_hash,
    )
    if user_id is None:
        return None

    return int(user_id)


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
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
    )


def get_token_from_request(request: Request) -> str | None:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        return token

    authorization = request.headers.get("Authorization")
    if authorization and authorization.startswith("Bearer "):
        return authorization.removeprefix("Bearer ").strip()

    return None


def get_current_auth_context(
    request: Request,
    db: Session,
) -> AuthContext:
    token = get_token_from_request(request)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    try:
        token_data = decode_access_token(token)
        user_id = int(token_data["sub"])
        jti = str(token_data["jti"])
    except (JWTError, KeyError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    if is_token_revoked(jti):
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

    return AuthContext(user=user, token=token, token_data=token_data)


def get_current_user_from_request(
    request: Request,
    db: Session,
) -> User:
    return get_current_auth_context(request, db).user


def require_roles(
    request: Request,
    db: Session,
    allowed_roles: set[str],
) -> User:
    user = get_current_user_from_request(request, db)
    role_name = user.role.role_name if user.role is not None else None
    if role_name not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource",
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
    if user is None or not user.is_active:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user


def audit_details(details: dict[str, str | int | bool] | None = None) -> str | None:
    if not details:
        return None

    return json.dumps(details, separators=(",", ":"), sort_keys=True)


def record_audit_event(
    db: Session,
    *,
    action: str,
    request: Request,
    actor_user_id: int | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: dict[str, str | int | bool] | None = None,
) -> None:
    create_audit_log(
        db,
        action=action,
        actor_user_id=actor_user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=get_client_ip(request),
        details_json=audit_details(details),
    )


def apply_security_headers(response: Response) -> None:
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains"
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"


def apply_no_store_headers(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"


def clear_ephemeral_security_state() -> None:
    _fallback_lockouts.clear()
    _fallback_rate_limits.clear()
    _fallback_challenges.clear()
    _fallback_revoked_tokens.clear()
    _fallback_email_verifications.clear()
