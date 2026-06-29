import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.role_repository import get_role_by_name
from app.repositories.user_repository import (
    create_user,
    deactivate_user,
    get_user_by_email,
    get_user_by_id,
    update_user_profile,
)
from app.schemas.auth_schema import (
    AuthResponse,
    AuthUserResponse,
    LoginInitiateResponse,
    LoginOtpRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    RegistrationChallengeResponse,
    ResendVerificationRequest,
    UpdateProfileRequest,
    VerifyEmailRequest,
)
from app.services.email_service import (
    send_login_otp_email,
    send_verification_email,
)
from app.services.auth_service import (
    EMAIL_VERIFICATION_REQUIRED,
    EXPOSE_DEV_VERIFICATION_TOKEN,
    LOCKOUT_TIME_SECONDS,
    MAX_LOGIN_ATTEMPTS,
    authenticate_user,
    check_auth_rate_limit,
    clear_auth_cookie,
    clear_failed_logins,
    consume_email_verification_token,
    consume_login_otp,
    create_access_token,
    create_email_verification_token,
    create_login_otp,
    create_registration_challenge,
    get_client_ip,
    get_current_auth_context,
    get_current_user_from_request,
    get_password_hash,
    get_user_auth_payload,
    is_account_locked,
    normalize_email,
    record_audit_event,
    register_failed_login,
    revoke_token,
    set_auth_cookie,
    try_revoke_existing_session,
    validate_password_policy,
    validate_registration_challenge,
    verify_password,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Auth"],
)


def _enforce_auth_rate_limit(request: Request) -> None:
    if check_auth_rate_limit(get_client_ip(request)):
        return

    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many authentication requests. Try again later.",
    )


@router.get(
    "/register/challenge",
    response_model=RegistrationChallengeResponse,
)
def registration_challenge(request: Request) -> RegistrationChallengeResponse:
    _enforce_auth_rate_limit(request)
    return RegistrationChallengeResponse(**create_registration_challenge())


@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    request: Request,
    account: RegisterRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    _enforce_auth_rate_limit(request)

    if not validate_registration_challenge(
        account.challenge_id,
        account.challenge_answer,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration challenge is invalid or expired",
        )

    validate_password_policy(account.password)

    email = normalize_email(account.email)
    if get_user_by_email(db, email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    default_role = get_role_by_name(db, "user")
    if default_role is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Registration is temporarily unavailable",
        )

    try:
        user = create_user(
            db,
            email=email,
            display_name=account.display_name,
            password_hash=get_password_hash(account.password),
            role_id=default_role.role_id,
            email_verified=not EMAIL_VERIFICATION_REQUIRED,
        )
        verification_token = None
        email_sent = False
        if EMAIL_VERIFICATION_REQUIRED:
            verification_token = create_email_verification_token(user.user_id)
            email_sent = send_verification_email(
                to_email=user.email,
                token=verification_token,
                display_name=user.display_name,
            )

        record_audit_event(
            db,
            action_type="user_registered",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="user",
            resource_id=str(user.user_id),
            details={"email_verification_required": EMAIL_VERIFICATION_REQUIRED},
        )
        if EMAIL_VERIFICATION_REQUIRED:
            record_audit_event(
                db,
                action_type="verification_email_sent",
                result="success" if email_sent else "failure",
                request=request,
                actor_user_id=user.user_id,
                resource_type="user",
                resource_id=str(user.user_id),
                details={"trigger": "registration"},
            )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to register account",
        )

    message = "Registration successful"
    if EMAIL_VERIFICATION_REQUIRED:
        message = (
            "Registration successful. Please check your inbox "
            "(and spam folder) for a verification link before logging in."
        )

    return MessageResponse(
        message=message,
        verification_token=verification_token
        if EXPOSE_DEV_VERIFICATION_TOKEN
        else None,
    )


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(
    request: Request,
    body: ResendVerificationRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    _enforce_auth_rate_limit(request)

    generic_message = (
        "If that email is registered and not yet verified, "
        "we've sent a new verification link."
    )

    email = normalize_email(body.email)
    user = get_user_by_email(db, email)

    if user is None or user.account_status != "active" or user.email_verified:
        return MessageResponse(message=generic_message)

    verification_token = create_email_verification_token(user.user_id)
    email_sent = send_verification_email(
        to_email=user.email,
        token=verification_token,
        display_name=user.display_name,
    )

    try:
        record_audit_event(
            db,
            action_type="verification_email_sent",
            result="success" if email_sent else "failure",
            request=request,
            actor_user_id=user.user_id,
            resource_type="user",
            resource_id=str(user.user_id),
            details={"trigger": "resend_request"},
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()

    return MessageResponse(message=generic_message)


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(
    request: Request,
    verification: VerifyEmailRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    user_id = consume_email_verification_token(verification.token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link is invalid or expired",
        )

    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link is invalid or expired",
        )

    try:
        user.email_verified = True
        record_audit_event(
            db,
            action_type="email_verified",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="user",
            resource_id=str(user.user_id),
        )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify email",
        )

    return MessageResponse(message="Email verified successfully")


@router.post("/login", response_model=LoginInitiateResponse)
def login(
    request: Request,
    credentials: LoginRequest,
    db: Session = Depends(get_db),
) -> LoginInitiateResponse:
    _enforce_auth_rate_limit(request)

    email = normalize_email(credentials.email)
    client_ip = get_client_ip(request)
    lockout_key = f"login_attempts:{client_ip}:{email}"

    if is_account_locked(lockout_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Try again later.",
        )

    user = authenticate_user(db, email, credentials.password)
    if user is None:
        attempts = register_failed_login(lockout_key)
        try:
            record_audit_event(
                db,
                action_type="login_failed",
                result="failure",
                request=request,
                resource_type="user",
                resource_id=email,
                details={"attempts": attempts},
            )
            db.commit()
        except SQLAlchemyError:
            db.rollback()

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

    intent_id, otp = create_login_otp(user.user_id)
    email_sent = send_login_otp_email(
        to_email=user.email,
        otp=otp,
        display_name=user.display_name,
    )

    try:
        record_audit_event(
            db,
            action_type="login_otp_sent",
            result="success" if email_sent else "failure",
            request=request,
            actor_user_id=user.user_id,
            resource_type="user",
            resource_id=str(user.user_id),
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()

    return LoginInitiateResponse(
        message="Verification code sent to your email. Enter it to finish signing in.",
        login_intent_id=intent_id,
    )


@router.post("/login/verify-otp", response_model=AuthResponse)
def verify_login_otp(
    request: Request,
    response: Response,
    body: LoginOtpRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    _enforce_auth_rate_limit(request)

    otp_result = consume_login_otp(body.login_intent_id, body.otp)
    if otp_result.user_id is None:
        try:
            record_audit_event(
                db,
                action_type="login_otp_failed",
                result="failure",
                request=request,
                resource_type="login_intent",
                resource_id=body.login_intent_id,
                details={
                    "attempts_remaining": otp_result.attempts_remaining,
                    "reason": otp_result.reason,
                },
            )
            db.commit()
        except SQLAlchemyError:
            db.rollback()

        if otp_result.reason == "wrong":
            attempt_word = (
                "attempt" if otp_result.attempts_remaining == 1 else "attempts"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    f"Invalid code. {otp_result.attempts_remaining} "
                    f"{attempt_word} remaining."
                ),
            )

        if otp_result.reason == "exhausted":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    "Too many wrong codes. Please sign in again to receive a new code."
                ),
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Verification code is invalid or has expired. "
                "Please sign in again to receive a new code."
            ),
        )

    user = get_user_by_id(db, otp_result.user_id)
    if user is None or user.account_status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Verification code is invalid or expired",
        )

    try_revoke_existing_session(request)

    token = create_access_token(
        {
            "sub": str(user.user_id),
            "email": user.email,
            "role": user.role.role_name if user.role is not None else None,
        },
    )
    set_auth_cookie(response, token)

    try:
        record_audit_event(
            db,
            action_type="login_otp_verified",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="user",
            resource_id=str(user.user_id),
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()

    return AuthResponse(
        message="Sign-in successful",
        user=AuthUserResponse(**get_user_auth_payload(user)),
    )


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        context = get_current_auth_context(request, db)
        revoke_token(context.token_data)
        record_audit_event(
            db,
            action_type="logout",
            result="success",
            request=request,
            actor_user_id=context.user.user_id,
            resource_type="user",
            resource_id=str(context.user.user_id),
        )
        db.commit()
    except HTTPException:
        db.rollback()
    except SQLAlchemyError:
        db.rollback()

    clear_auth_cookie(response)
    return MessageResponse(message="Logout successful")


@router.get("/me", response_model=AuthUserResponse)
def me(
    request: Request,
    db: Session = Depends(get_db),
) -> AuthUserResponse:
    user = get_current_user_from_request(request, db)
    return AuthUserResponse(**get_user_auth_payload(user))


@router.patch("/me", response_model=MessageResponse)
def update_me(
    request: Request,
    response: Response,
    update: UpdateProfileRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    context = get_current_auth_context(request, db)
    user = context.user

    email = normalize_email(update.email) if update.email is not None else None
    if email is not None and email != user.email:
        existing_user = get_user_by_email(db, email)
        if existing_user is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already registered",
            )

    password_hash = None
    if update.new_password is not None:
        if update.current_password is None or not verify_password(
            update.current_password,
            user.password_hash,
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect",
            )
        validate_password_policy(update.new_password)
        password_hash = get_password_hash(update.new_password)

    if email is None and update.display_name is None and password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No profile changes were provided",
        )

    try:
        update_user_profile(
            db,
            user,
            email=email,
            display_name=update.display_name,
            password_hash=password_hash,
        )
        revoke_token(context.token_data)
        record_audit_event(
            db,
            action_type="profile_updated",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="user",
            resource_id=str(user.user_id),
            details={
                "email_changed": email is not None,
                "display_name_changed": update.display_name is not None,
                "password_changed": password_hash is not None,
            },
        )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to update profile",
        )

    clear_auth_cookie(response)
    return MessageResponse(message="Profile updated. Please log in again.")


@router.delete("/me", response_model=MessageResponse)
def delete_me(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> MessageResponse:
    context = get_current_auth_context(request, db)
    user = context.user
    replacement_email = f"deleted-{user.user_id}-{secrets.token_hex(4)}@deleted.local"
    replacement_password_hash = get_password_hash(secrets.token_urlsafe(32))

    try:
        deactivate_user(
            db,
            user,
            replacement_email=replacement_email,
            replacement_password_hash=replacement_password_hash,
        )
        revoke_token(context.token_data)
        record_audit_event(
            db,
            action_type="account_deleted",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="user",
            resource_id=str(user.user_id),
        )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to delete account",
        )

    clear_auth_cookie(response)
    return MessageResponse(message="Account deleted")
