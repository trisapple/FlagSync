from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth_schema import AuthResponse, AuthUserResponse, LoginRequest
from app.services.auth_service import (
    MAX_LOGIN_ATTEMPTS,
    LOCKOUT_TIME_SECONDS,
    authenticate_user,
    build_lockout_key,
    clear_auth_cookie,
    clear_failed_logins,
    create_access_token,
    get_current_user_from_request,
    get_user_auth_payload,
    is_account_locked,
    normalize_email,
    register_failed_login,
    set_auth_cookie,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Auth"],
)


@router.post("/login", response_model=AuthResponse)
def login(
    request: Request,
    response: Response,
    credentials: LoginRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    email = normalize_email(credentials.email)
    client_ip = request.client.host if request.client is not None else "unknown"
    lockout_key = build_lockout_key(client_ip, email)

    if is_account_locked(lockout_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Try again later.",
        )

    user = authenticate_user(db, email, credentials.password)
    if user is None:
        attempts = register_failed_login(lockout_key)
        if attempts >= MAX_LOGIN_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Login locked for {LOCKOUT_TIME_SECONDS // 60} minutes.",
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    clear_failed_logins(lockout_key)
    token = create_access_token(
        {
            "sub": str(user.user_id),
            "email": user.email,
            "role": user.role.role_name if user.role is not None else None,
        },
    )
    set_auth_cookie(response, token)

    return AuthResponse(
        message="Login successful",
        user=AuthUserResponse(**get_user_auth_payload(user)),
    )


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    clear_auth_cookie(response)
    return {"message": "Logout successful"}


@router.get("/me", response_model=AuthUserResponse)
def me(
    request: Request,
    db: Session = Depends(get_db),
) -> AuthUserResponse:
    user = get_current_user_from_request(request, db)
    return AuthUserResponse(**get_user_auth_payload(user))
