"""
Local file storage for uploads (photos, logos, documents).

One place to save a file under backend/uploads/<subdir>/<key>/ and get back the
public URL (served by the /uploads static mount). Swap this single module for an
S3/CDN uploader in production — callers don't change.
"""
import base64
import os
import re
import time
import uuid

from fastapi import UploadFile

from ..config import settings

_UPLOAD_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")


# Change MAX_IMAGE_MB to raise/lower the limit — the messages below derive from
# it, so they can never disagree with the check.
# NOTE: nginx must allow at least this much too (`client_max_body_size`), or it
# returns a bare 413 before the request ever reaches this code.
MAX_IMAGE_MB = 3
MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png"}

# --- What a document is allowed to be -----------------------------------------
#
# Nothing validated an upload before: .html, .svg, .exe and "invoice.pdf.html"
# were all accepted, and a declared content-type of image/jpeg was believed
# without looking inside the file. That turns hospital storage into a host for
# whatever an attacker wants to hand out under your domain.
#
# Both halves are needed. The extension decides what we will ever serve back;
# the signature decides whether the bytes really are that kind of file. A .exe
# renamed to .pdf fails the second check, and a real PDF named .html fails the
# first.
MAX_DOC_MB = 10
MAX_DOC_BYTES = MAX_DOC_MB * 1024 * 1024
# extension -> the bytes such a file must begin with (empty tuple = no reliable
# signature, e.g. HEIC, where the marker sits at offset 4)
DOC_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    ".pdf": (b"%PDF-",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".webp": (b"RIFF",),
    ".heic": (),
    ".heif": (),
}
ALLOWED_DOC_EXTENSIONS = set(DOC_SIGNATURES)
# What each extension is served back as. Served from an allow-list, never from
# the uploader's declared content-type — that is what made a stored .html run
# as a page on the API's own origin.
DOC_CONTENT_TYPES = {
    ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".webp": "image/webp", ".heic": "image/heic", ".heif": "image/heif",
}

# Folders holding other people's medical data. Everything under these is served
# only against a signed, expiring link (see signed_url / verify_signed_path);
# `doctors` and `hospitals` hold profile photos and logos, which are shown to
# anyone browsing the site and stay public.
# `signatures` (doctor signatures for prescription PDFs) is private too: a
# public signature image is a forgery kit.
PRIVATE_SUBDIRS = ("patients", "doctor_docs", "signatures")
# Prescription material (letterheads, signatures) goes to its own bucket when
# S3_RX_BUCKET is set — see rx_bucket().
RX_SUBDIRS = ("letterheads", "signatures")
SIGNED_URL_TTL_SECONDS = 15 * 60


def require_document(upload: UploadFile) -> str:
    """Reject anything that is not a real PDF or image, and return its extension.

    Checks, in order: a known extension (on the LAST dot, so `invoice.pdf.html`
    is judged as .html and refused), the file's own opening bytes, that it is
    not empty, and that it is within MAX_DOC_MB. Size is measured by seeking,
    not by reading the file into memory.
    """
    from fastapi import HTTPException, status

    name = (upload.filename or "").strip()
    ext = os.path.splitext(name)[1].lower()
    allowed = ", ".join(sorted(ALLOWED_DOC_EXTENSIONS))
    if ext not in ALLOWED_DOC_EXTENSIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"“{name or 'This file'}” can't be uploaded. Allowed types: {allowed}.",
        )

    start = upload.file.tell()
    try:
        head = upload.file.read(16)
        upload.file.seek(0, os.SEEK_END)
        size = upload.file.tell()
    finally:
        upload.file.seek(start)

    if size == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That file is empty.")
    if size > MAX_DOC_BYTES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"File must be {MAX_DOC_MB}MB or smaller.",
        )
    signatures = DOC_SIGNATURES.get(ext, ())
    if signatures and not any(head.startswith(sig) for sig in signatures):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"That file is not a real {ext[1:].upper()} — its contents don't match its name.",
        )
    return ext


def _signature(path: str, expires: int) -> str:
    """HMAC over the stored path + expiry, keyed by the app's signing secret."""
    import hashlib
    import hmac

    msg = f"{path}:{expires}".encode()
    digest = hmac.new(settings.secret_key.encode(), msg, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


def signed_url(path: str, ttl: int = SIGNED_URL_TTL_SECONDS) -> str:
    """A link to a private local file that stops working after `ttl` seconds.

    The same idea as an S3 presigned URL, and for the same reason: a browser
    opening a PDF in a new tab cannot send an Authorization header, so the
    permission has to travel inside the link. The link is only ever minted while
    serving a record the caller was already allowed to read, so authorisation is
    inherited from that read — including across tenants.
    """
    expires = int(time.time()) + ttl
    return f"{path}?exp={expires}&sig={_signature(path, expires)}"


def verify_signed_path(path: str, expires: str | None, sig: str | None) -> bool:
    """True when this link was minted by us and has not expired."""
    import hmac as _hmac

    if not expires or not sig:
        return False
    try:
        expires_at = int(expires)
    except (TypeError, ValueError):
        return False
    if expires_at < int(time.time()):
        return False
    return _hmac.compare_digest(sig, _signature(path, expires_at))


def rx_bucket() -> str:
    """The bucket for prescription material; the main bucket until it is set."""
    return (settings.s3_rx_bucket or "").strip() or settings.s3_upload_bucket


def save_upload(subdir: str, key, upload: UploadFile) -> tuple[str, int]:
    """Persist an upload and return a stable stored reference plus its size.

    S3 references are stored as ``s3://bucket/key``. Never store a presigned URL
    in the database: it expires. ``public_url`` signs the stable reference each
    time an authorized API response is serialized.
    """
    # Validate FIRST, and for every caller: this is the one funnel all uploads
    # pass through, so the check cannot be forgotten at a call site.
    ext = require_document(upload)
    # Stored under a name we choose. Keeping the uploader's name let them pick
    # what sits in the URL (and, with the old scheme, collide with or overwrite
    # another record's file of the same name).
    safe = f"{uuid.uuid4().hex}{ext}"
    data = upload.file.read()
    size_kb = max(1, len(data) // 1024)
    if settings.upload_storage.lower() == "s3":
        bucket = rx_bucket() if subdir in RX_SUBDIRS else settings.s3_upload_bucket
        if not bucket:
            raise RuntimeError("S3_UPLOAD_BUCKET is required when UPLOAD_STORAGE=s3")
        prefix = settings.s3_upload_prefix.strip("/")
        object_key = "/".join(filter(None, (
            prefix, subdir.strip("/"), str(key), f"{uuid.uuid4().hex}-{safe}",
        )))
        import boto3
        boto3.client("s3", region_name=settings.aws_region).put_object(
            Bucket=bucket,
            Key=object_key,
            Body=data,
            # From the extension we validated, never the uploader's declared
            # type — S3 hands this straight back to the browser.
            ContentType=DOC_CONTENT_TYPES.get(ext, "application/octet-stream"),
            ServerSideEncryption="AES256",
        )
        return f"s3://{bucket}/{object_key}", size_kb

    folder = os.path.join(_UPLOAD_ROOT, subdir, str(key))
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, safe), "wb") as f:
        f.write(data)
    return f"/uploads/{subdir}/{key}/{safe}", size_kb


def public_url(value: str | None) -> str | None:
    """Turn a stored reference into a URL the caller can actually open.

    S3 refs are presigned. Local files under a PRIVATE folder get our own
    signed, expiring link — without it `/uploads/patients/2/report.pdf` was
    readable by anyone who typed it, no login, from any tenant. Photos and
    logos are returned untouched: they are shown to every visitor.
    """
    if value and not value.startswith("s3://") and value.startswith("/uploads/"):
        parts = value.split("/")
        if len(parts) > 2 and parts[2] in PRIVATE_SUBDIRS:
            return signed_url(value)
        return value
    if not value or not value.startswith("s3://"):
        return value
    bucket_and_key = value[5:]
    bucket, separator, object_key = bucket_and_key.partition("/")
    if not separator or not bucket or not object_key:
        return value
    import boto3
    return boto3.client("s3", region_name=settings.aws_region).generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": object_key},
        ExpiresIn=settings.s3_url_expiry_seconds,
    )


def _in_own_folder(value: str, folders: tuple[str, ...]) -> bool:
    """True when a stored ref points into one of OUR upload folders named here.

    public_url signs whatever ref it is given, and read_bytes reads it; that is
    right for refs the server wrote itself. A logo, photo or letterhead ref is
    only safe to sign if it really is one — a ref aimed at `patients/...`,
    `signatures/...` or another bucket must not come back as a working link.
    """
    if not value or ".." in value.split("?")[0].split("/"):
        return False
    if value.startswith("/uploads/"):
        parts = value[len("/uploads/"):].split("/")
        return len(parts) > 1 and parts[0] in folders
    if value.startswith("s3://"):
        bucket, _, key = value[5:].partition("/")
        if bucket not in {settings.s3_upload_bucket, rx_bucket()}:
            return False
        parts = key.split("/")
        prefix = settings.s3_upload_prefix.strip("/")
        if prefix and parts and parts[0] == prefix:
            parts = parts[1:]
        return len(parts) > 1 and parts[0] in folders
    return False


def media_url(value: str | None, *folders: str) -> str | None:
    """public_url for an image the server shows as a logo / photo / letterhead /
    signature: only when the ref lives in one of `folders`. A full http(s) URL
    (old seed data) is passed through untouched — it is not one of our files, so
    there is nothing private to sign. Anything else gives no link at all."""
    if not value:
        return None
    if value.startswith(("http://", "https://")):
        return value
    return public_url(value) if _in_own_folder(value, folders) else None


def media_bytes(value: str | None, *folders: str) -> bytes | None:
    """read_bytes, under the same folder rule as media_url (for the Rx PDF)."""
    return read_bytes(value) if value and _in_own_folder(value, folders) else None


def media_validator(*folders: str):
    """A pydantic `before` validator signing a media field via media_url."""
    return lambda v: media_url(v, *folders)


def read_bytes(value: str | None) -> bytes | None:
    """The raw bytes behind a stored reference, for building files server-side
    (the prescription PDF embeds the logo, letterhead and signature).

    Never raises: a missing or unreadable image just leaves it out of the PDF.
    """
    if not value:
        return None
    try:
        if value.startswith("s3://"):
            bucket, _, object_key = value[5:].partition("/")
            import boto3
            obj = boto3.client("s3", region_name=settings.aws_region).get_object(Bucket=bucket, Key=object_key)
            return obj["Body"].read()
        if value.startswith("/uploads/"):
            root = os.path.realpath(_UPLOAD_ROOT)
            path = os.path.realpath(os.path.join(root, value[len("/uploads/"):].split("?")[0]))
            if not path.startswith(root + os.sep) or not os.path.isfile(path):
                return None
            with open(path, "rb") as f:
                return f.read()
    except Exception:  # noqa: BLE001 — an image is optional on the PDF
        import logging
        logging.getLogger(__name__).warning("could not read stored file %s", value, exc_info=True)
    return None


def require_image(upload: UploadFile) -> None:
    """Reject non-image uploads and enforce JPG/PNG within MAX_IMAGE_MB."""
    from fastapi import HTTPException, status

    content_type = (upload.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Please upload a JPG or PNG image file (max {MAX_IMAGE_MB}MB)",
        )

    original_position = upload.file.tell()
    try:
        upload.file.seek(0, os.SEEK_END)
        size = upload.file.tell()
    finally:
        upload.file.seek(original_position)

    if size > MAX_IMAGE_BYTES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Image file must be {MAX_IMAGE_MB}MB or smaller",
        )
