"""Publish notification events for the Lambda notification worker."""
from __future__ import annotations

import json
from dataclasses import dataclass
from uuid import uuid4

from ..config import settings


@dataclass
class PublishResult:
    ok: bool
    event_id: str
    provider_msg_id: str | None = None
    error_code: str | None = None
    error_message: str | None = None


def is_sqs_enabled() -> bool:
    return bool(settings.whatsapp_enabled and settings.whatsapp_transport.lower() == "sqs" and settings.whatsapp_sqs_queue_url)


def normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    if len(digits) == 10:
        return f"{settings.whatsapp_country_code}{digits}"
    return digits


def publish_whatsapp_event(event_type: str, recipient_phone: str, payload: dict, *,
                           event_id: str | None = None) -> PublishResult:
    event_id = event_id or f"{event_type}-{uuid4().hex[:12]}"
    if not is_sqs_enabled():
        return PublishResult(False, event_id, error_code="sqs_not_configured",
                             error_message="WHATSAPP_TRANSPORT=sqs and WHATSAPP_SQS_QUEUE_URL are required")

    body = {
        "event_id": event_id,
        "event_type": event_type,
        "channel": "whatsapp",
        "recipient_phone": normalize_phone(recipient_phone),
        "payload": payload,
    }

    try:
        import boto3  # imported lazily so local direct mode does not need AWS installed
    except ImportError as exc:
        return PublishResult(False, event_id, error_code="boto3_missing", error_message=str(exc))

    try:
        client = boto3.client("sqs", region_name=settings.aws_region)
        response = client.send_message(
            QueueUrl=settings.whatsapp_sqs_queue_url,
            MessageBody=json.dumps(body, ensure_ascii=False),
        )
        return PublishResult(True, event_id, provider_msg_id=response.get("MessageId"))
    except Exception as exc:
        return PublishResult(False, event_id, error_code="sqs_publish_failed", error_message=str(exc))
