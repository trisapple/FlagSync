import logging
import os
import uuid

from supabase import Client, create_client


logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
RESOURCE_BUCKET = os.getenv("RESOURCE_BUCKET", "event-resources").strip()
SIGNED_URL_TTL_SECONDS = int(os.getenv("RESOURCE_SIGNED_URL_TTL_SECONDS", "300"))


_supabase_client: Client | None = None


ALLOWED_SIGNATURES: tuple[tuple[bytes, str], ...] = (
    # Documents / images
    (b"%PDF-", "application/pdf"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"BM", "image/bmp"),
    (b"RIFF", "application/octet-stream"),  # WAV/AVI/WEBP — riff container
    (b"\x00\x00\x01\x00", "image/x-icon"),
    # Archives / compression
    (b"PK\x03\x04", "application/zip"),
    (b"PK\x05\x06", "application/zip"),  # empty zip
    (b"\x1f\x8b", "application/gzip"),
    (b"BZh", "application/x-bzip2"),
    (b"\xfd7zXZ", "application/x-xz"),
    (b"7z\xbc\xaf\x27\x1c", "application/x-7z-compressed"),
    (b"Rar!\x1a\x07\x00", "application/vnd.rar"),
    (b"Rar!\x1a\x07\x01\x00", "application/vnd.rar"),
    # Executables (common CTF reversing targets)
    (b"\x7fELF", "application/x-executable"),
    (b"MZ", "application/x-dosexec"),
    (b"\xfe\xed\xfa\xce", "application/x-mach-binary"),
    (b"\xfe\xed\xfa\xcf", "application/x-mach-binary"),
    (b"\xce\xfa\xed\xfe", "application/x-mach-binary"),
    (b"\xcf\xfa\xed\xfe", "application/x-mach-binary"),
    (b"\xca\xfe\xba\xbe", "application/java-vm"),
    # Databases / data
    (b"SQLite format 3\x00", "application/x-sqlite3"),
    # Audio / video (stego challenges)
    (b"ID3", "audio/mpeg"),
    (b"\xff\xfb", "audio/mpeg"),
    (b"OggS", "audio/ogg"),
    (b"fLaC", "audio/flac"),
    # Bytecode / images (misc)
    (b"\x1aELF", "application/x-executable"),
)


TEXT_ALLOWED_CHARS = set(range(0x20, 0x7F)) | {ord("\n"), ord("\r"), ord("\t")}


def detect_mime_type(content: bytes) -> str | None:
    for signature, mime in ALLOWED_SIGNATURES:
        if content.startswith(signature):
            return mime

    sample = content[:2048]
    try:
        decoded = sample.decode("utf-8")
    except UnicodeDecodeError:
        return None

    if not decoded:
        return None

    allowed_chars = sum(
        1 for character in decoded if character.isprintable() or character in "\n\r\t"
    )
    if allowed_chars / len(decoded) > 0.95:
        return "text/plain"
    return None


def _get_client() -> Client | None:
    global _supabase_client
    if _supabase_client is None and SUPABASE_URL and SUPABASE_SERVICE_KEY:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        logger.info(
            "Supabase storage client initialised (bucket=%s, key=%s...%s)",
            RESOURCE_BUCKET,
            SUPABASE_SERVICE_KEY[:6],
            SUPABASE_SERVICE_KEY[-4:],
        )
    return _supabase_client


def is_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)


def _safe_extension(original_name: str) -> str:
    if "." not in original_name:
        return ""
    candidate = original_name.rsplit(".", maxsplit=1)[1].lower()
    if 1 <= len(candidate) <= 8 and candidate.isalnum():
        return f".{candidate}"
    return ""


def build_object_path(event_id: uuid.UUID, original_name: str) -> str:
    return f"{event_id}/{uuid.uuid4().hex}{_safe_extension(original_name)}"


def upload_file(
    *,
    object_path: str,
    content: bytes,
    mime_type: str,
) -> bool:
    client = _get_client()
    if client is None:
        logger.warning("Supabase storage not configured; upload skipped")
        return False

    try:
        client.storage.from_(RESOURCE_BUCKET).upload(
            path=object_path,
            file=content,
            file_options={"content-type": mime_type, "upsert": "false"},
        )
        logger.info("storage_upload object=%s bytes=%d", object_path, len(content))
        return True
    except Exception:
        logger.exception("Supabase storage upload failed")
        return False


def create_signed_download_url(object_path: str) -> str | None:
    client = _get_client()
    if client is None:
        return None
    try:
        result = client.storage.from_(RESOURCE_BUCKET).create_signed_url(
            path=object_path,
            expires_in=SIGNED_URL_TTL_SECONDS,
        )
    except Exception:
        logger.exception("Signed URL generation failed")
        return None

    if isinstance(result, dict):
        return result.get("signedURL") or result.get("signed_url")
    return None


def delete_file(object_path: str) -> bool:
    client = _get_client()
    if client is None:
        return False
    try:
        client.storage.from_(RESOURCE_BUCKET).remove([object_path])
        return True
    except Exception:
        logger.exception("Supabase storage delete failed")
        return False
