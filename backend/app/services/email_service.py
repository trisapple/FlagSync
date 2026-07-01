import html as html_module
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage


logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USERNAME or "noreply@example.com")
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:5173").rstrip("/")


def _mask_email(email: str) -> str:
    name, _, domain = email.partition("@")
    if not domain or len(name) < 2:
        return "***@***"
    return f"{name[0]}***@{domain}"


def is_configured() -> bool:
    return bool(SMTP_USERNAME and SMTP_PASSWORD)


def build_verification_url(token: str) -> str:
    return f"{APP_BASE_URL}/verify-email?token={token}"


def send_verification_email(
    *,
    to_email: str,
    token: str,
    display_name: str,
) -> bool:
    verify_url = build_verification_url(token)
    safe_name = html_module.escape((display_name or "there").strip()[:80])

    if not is_configured():
        logger.warning(
            "SMTP credentials not set; printing verification link instead of sending email",
        )
        logger.info(
            "Verification link for %s: %s",
            _mask_email(to_email),
            verify_url,
        )
        return False

    subject = "Verify your FlagSync account"
    html = (
        f"<p>Hi {safe_name},</p>"
        f"<p>Welcome to FlagSync. Click the link below to verify your email "
        f"and activate your account:</p>"
        f'<p><a href="{verify_url}">Verify my email</a></p>'
        f"<p>This link expires in 24 hours. "
        f"If you did not create this account, you can ignore this email.</p>"
    )
    text = (
        f"Hi {safe_name},\n\n"
        f"Welcome to FlagSync. Verify your email by visiting:\n{verify_url}\n\n"
        f"This link expires in 24 hours."
    )

    message = EmailMessage()
    message["From"] = EMAIL_FROM
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
            smtp.starttls(context=context)
            smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
        logger.info("verification_email_sent to %s", _mask_email(to_email))
        return True
    except Exception:
        logger.exception("SMTP send failed for %s", _mask_email(to_email))
        return False


def send_login_otp_email(
    *,
    to_email: str,
    otp: str,
    display_name: str,
) -> bool:
    safe_name = html_module.escape((display_name or "there").strip()[:80])

    if not is_configured():
        logger.warning(
            "SMTP credentials not set; printing login OTP instead of sending email",
        )
        logger.info("Login OTP for %s: %s", _mask_email(to_email), otp)
        return False

    subject = "Your FlagSync sign-in code"
    html = (
        f"<p>Hi {safe_name},</p>"
        f"<p>Your sign-in verification code is:</p>"
        f'<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">{otp}</p>'
        f"<p>This code expires in 5 minutes.</p>"
        f"<p>If you did not try to sign in, ignore this email and consider "
        f"changing your password.</p>"
    )
    text = (
        f"Hi {safe_name},\n\n"
        f"Your FlagSync sign-in code is: {otp}\n"
        f"This code expires in 5 minutes.\n\n"
        f"If you did not try to sign in, ignore this email."
    )

    message = EmailMessage()
    message["From"] = EMAIL_FROM
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
            smtp.starttls(context=context)
            smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
        logger.info("login_otp_email_sent to %s", _mask_email(to_email))
        return True
    except Exception:
        logger.exception("SMTP send failed for %s", _mask_email(to_email))
        return False
