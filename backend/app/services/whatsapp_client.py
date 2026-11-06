"""Dovesoft WhatsApp Business API adapter.

The Lambda handoff from the team uses Dovesoft's WABA gateway with template
payloads. This module keeps the provider call isolated so the rest of the app
continues to work in mock mode when WhatsApp env vars are not configured.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ..config import settings


def _debug_enabled() -> bool:
    return bool(getattr(settings, "whatsapp_debug", False))


def _debug_print(label: str, value) -> None:
    if _debug_enabled():
        print(f"[whatsapp:dovesoft] {label}: {value}", flush=True)


@dataclass
class WhatsappResult:
    ok: bool
    provider_msg_id: str | None = None
    status: str = "sent"
    error_code: str | None = None
    error_message: str | None = None


def is_enabled() -> bool:
    return bool(
        settings.whatsapp_enabled
        and settings.whatsapp_api_url
        and settings.whatsapp_api_key
        and settings.whatsapp_waba_number
    )


def _normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    if len(digits) == 10:
        return f"{settings.whatsapp_country_code}{digits}"
    return digits


def _headers() -> dict[str, str]:
    headers = {
        "Key": settings.whatsapp_api_key,
        "wabaNumber": settings.whatsapp_waba_number,
        "Content-Type": "application/json",
    }
    if settings.whatsapp_workflow_id:
        headers["workflowId"] = settings.whatsapp_workflow_id
    if settings.whatsapp_campaign_id:
        headers["campaignId"] = settings.whatsapp_campaign_id
    return headers


def _extract_message_id(data: Any) -> str | None:
    if not isinstance(data, dict):
        return None
    for key in ("messageId", "message_id", "msgId", "id", "wamid"):
        value = data.get(key)
        if value:
            return str(value)
    messages = data.get("messages")
    if isinstance(messages, list) and messages and isinstance(messages[0], dict):
        value = messages[0].get("id") or messages[0].get("messageId")
        if value:
            return str(value)
    return None


def _looks_failed(data: Any) -> tuple[bool, str | None, str | None]:
    if not isinstance(data, dict):
        return False, None, None
    raw = str(data.get("raw") or "").strip()
    if raw:
        lowered = raw.lower()
        if any(word in lowered for word in ("invalid", "error", "failed", "failure", "unauthorized")):
            return True, "provider_error", raw
    status_value = str(data.get("status") or data.get("success") or "").lower()
    if status_value in {"false", "failed", "failure", "error", "0"}:
        return True, str(data.get("code") or data.get("errorCode") or "provider_error"), str(
            data.get("message") or data.get("error") or data.get("description") or "WhatsApp provider rejected the request"
        )
    if data.get("error"):
        err = data["error"]
        if isinstance(err, dict):
            return True, str(err.get("code") or "provider_error"), str(err.get("message") or err)
        return True, "provider_error", str(err)
    return False, None, None


def _post(payload: dict[str, Any]) -> WhatsappResult:
    body = json.dumps(payload).encode("utf-8")
    headers = _headers()
    safe_headers = {k: ("***" if k.lower() == "key" else v) for k, v in headers.items()}
    _debug_print("url", settings.whatsapp_api_url)
    _debug_print("headers", safe_headers)
    _debug_print("payload", payload)
    req = Request(settings.whatsapp_api_url, data=body, headers=headers, method="POST")
    try:
        with urlopen(req, timeout=settings.whatsapp_timeout_seconds) as resp:  # noqa: S310 - configured provider URL
            raw = resp.read().decode("utf-8", errors="replace")
            _debug_print("http_status", getattr(resp, "status", None))
            _debug_print("raw_response", raw)
            try:
                data = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                data = {"raw": raw}
            failed, code, msg = _looks_failed(data)
            if failed:
                return WhatsappResult(False, status="failed", error_code=code, error_message=msg)
            # A real acceptance always comes back with a wamid. Dovesoft answers
            # 200 OK even when Meta refuses the send (unknown template, wrong
            # parameter count), and the only tell is the missing id — so without
            # this check a rejected message is logged as "sent" and nobody ever
            # learns the patient wasn't told.
            msg_id = _extract_message_id(data)
            if not msg_id:
                return WhatsappResult(
                    False, status="failed", error_code="no_message_id",
                    error_message=f"provider returned no message id: {raw[:400]}",
                )
            return WhatsappResult(True, provider_msg_id=msg_id, status="sent")
    except HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        return WhatsappResult(False, status="failed", error_code=str(exc.code), error_message=raw or exc.reason)
    except URLError as exc:
        return WhatsappResult(False, status="failed", error_code="network_error", error_message=str(exc.reason))
    except Exception as exc:
        return WhatsappResult(False, status="failed", error_code="unexpected_error", error_message=str(exc))


def send_otp(recipient_phone: str, otp_code: str, *, template_name: str | None = None,
             language_code: str = "en_US") -> WhatsappResult:
    template = template_name or settings.whatsapp_otp_template
    payload = {
        "messaging_product": "whatsapp",
        "to": _normalize_phone(recipient_phone),
        "type": "template",
        "template": {
            "name": template,
            "language": {"code": language_code, "policy": "deterministic"},
            "components": [
                {"type": "body", "parameters": [{"type": "text", "text": str(otp_code)}]},
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": 0,
                    "parameters": [{"type": "text", "text": str(otp_code)}],
                },
            ],
        },
    }
    return _post(payload)


def send_template(recipient_phone: str, template_name: str, body_parameters: Iterable[Any], *,
                  language_code: str = "en") -> WhatsappResult:
    payload = {
        "messaging_product": "whatsapp",
        "to": _normalize_phone(recipient_phone),
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code, "policy": "deterministic"},
            "components": [
                {
                    # Lowercase, matching send_otp above — that's the call shape
                    # Dovesoft is known to accept, so don't let the two drift.
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": str(value)} for value in body_parameters
                    ],
                }
            ],
        },
    }
    return _post(payload)
