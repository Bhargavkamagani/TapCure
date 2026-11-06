"""
SMTP mailer — the real email transport behind notifications.send_email.

Thin wrapper over the stdlib smtplib (no extra dependency). Sends a plain-text
(optionally HTML) message via STARTTLS and reports a (ok, message_id, error)
result the caller records on the EmailLog row. All failures are caught and
returned, never raised, so a mail outage can't break the API request that
triggered it.

Config comes from settings (.env): MAIL_ENABLED gates sending; SMTP_HOST/PORT/
USERNAME/PASSWORD/USE_TLS/TIMEOUT_SECONDS describe the relay. For Gmail use a
16-char App Password as SMTP_PASSWORD with 2-Step Verification on.
"""
from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from typing import Optional, Tuple

from ..config import settings


def is_enabled() -> bool:
    """True only when mail is switched on AND the minimum relay config is present."""
    return bool(
        settings.mail_enabled
        and settings.smtp_host
        and settings.smtp_username
        and settings.smtp_password
        and (settings.mail_from_email or settings.smtp_username)
    )


def _from_header() -> str:
    addr = settings.mail_from_email or settings.smtp_username
    return formataddr((settings.mail_from_name or "", addr))


def send(to_email: str, subject: str, body: str, *, html: Optional[str] = None) -> Tuple[bool, Optional[str], Optional[str]]:
    """Send one email. Returns (ok, provider_msg_id, error_message).

    Never raises — connection/auth/send errors are caught and returned so the
    caller can mark the EmailLog 'failed' without aborting the request.
    """
    if not is_enabled():
        return False, None, "mail disabled or not configured"
    if not to_email:
        return False, None, "missing recipient"

    msg = EmailMessage()
    msg["From"] = _from_header()
    msg["To"] = to_email
    msg["Subject"] = subject or ""
    msg_id = make_msgid()
    msg["Message-ID"] = msg_id
    msg.set_content(body or "")
    if html:
        msg.add_alternative(html, subtype="html")

    host = settings.smtp_host
    port = int(settings.smtp_port or 587)
    timeout = int(settings.smtp_timeout_seconds or 10)

    try:
        if port == 465:
            # Implicit TLS (SMTPS).
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, timeout=timeout, context=ctx) as srv:
                srv.login(settings.smtp_username, settings.smtp_password)
                srv.send_message(msg)
        else:
            # Plain connection upgraded with STARTTLS (port 587, the usual case).
            with smtplib.SMTP(host, port, timeout=timeout) as srv:
                srv.ehlo()
                if settings.smtp_use_tls:
                    srv.starttls(context=ssl.create_default_context())
                    srv.ehlo()
                srv.login(settings.smtp_username, settings.smtp_password)
                srv.send_message(msg)
        return True, msg_id, None
    except (smtplib.SMTPException, OSError) as exc:
        # OSError covers connect/timeout/DNS; SMTPException covers auth/send.
        return False, None, f"{type(exc).__name__}: {exc}"
