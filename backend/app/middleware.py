"""
Audit middleware — writes one immutable audit_logs row per successful mutating
request (POST/PUT/PATCH/DELETE) AND per refused request (401/403/429, any
method), capturing who/what/where/when.

It decodes the caller from the Bearer token, derives module+action+entity from
the path, and records IP, user-agent and a generated request id (also returned
as the X-Request-ID header). Failures here never break the request.
"""
import time
from collections import OrderedDict
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .database import SessionLocal, parse_uuid
from .models import AuditLog, User
from .security import decode_access_token

_MUTATING = {"POST", "PUT", "PATCH", "DELETE"}
_SKIP_PREFIXES = ("/docs", "/openapi", "/redoc", "/health", "/favicon")

# Refusals worth keeping: no/failed credentials, forbidden, and rate-limited.
# Recorded for EVERY method, not just mutating ones — reading another patient's
# queue is a GET, and it was exactly that class of probe the log could not see.
_DENIED = {401, 403, 429}

# One row per (caller, path, status) per minute. A scanner sweeping a thousand
# URLs would otherwise write a thousand rows a second into a table nothing
# prunes; after a minute the same probe is recorded again, so a sustained attack
# still leaves a trail rather than one lonely line.
_DEDUPE_SECONDS = 60
_DEDUPE_MAX = 2048
_recent_denials: "OrderedDict[str, float]" = OrderedDict()


def _should_record_denial(key: str, now: float) -> bool:
    cutoff = now - _DEDUPE_SECONDS
    while _recent_denials and next(iter(_recent_denials.values())) < cutoff:
        _recent_denials.popitem(last=False)
    if key in _recent_denials:
        return False
    _recent_denials[key] = now
    # Hard cap: a flood of DIFFERENT keys must not grow this without limit.
    while len(_recent_denials) > _DEDUPE_MAX:
        _recent_denials.popitem(last=False)
    return True


def _entity_id_from_path(parts: list[str]):
    """The last UUID in the URL path (the record the request acts on)."""
    for seg in reversed(parts):
        value = parse_uuid(seg) if len(seg) in (32, 36) else None
        if value is not None:
            return value
    return None


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = uuid4().hex
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        try:
            path = request.url.path
            status_code = response.status_code
            if not path.startswith(_SKIP_PREFIXES):
                succeeded = request.method in _MUTATING and status_code < 400
                # A refusal is the thing an investigation actually needs. The
                # log recorded only successes, so every probe, every failed
                # privilege escalation and every reconnaissance sweep left no
                # trace at all — an attack could not be spotted afterwards, let
                # alone while it was happening.
                denied = status_code in _DENIED
                if denied:
                    caller = request.client.host if request.client else "?"
                    denied = _should_record_denial(
                        f"{caller}|{request.method}|{path}|{status_code}", time.time()
                    )
                if succeeded or denied:
                    self._record(request, path, request.method, status_code, request_id)
        except Exception:
            pass  # auditing must never break the actual request
        return response

    def _record(self, request: Request, path: str, method: str, status_code: int, request_id: str) -> None:
        parts = [p for p in path.strip("/").split("/") if p]
        module = parts[0] if parts else "root"
        entity_id = _entity_id_from_path(parts)

        user_id = role = hospital_id = None
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            payload = decode_access_token(auth[7:])
            if payload and payload.get("type") == "access":
                role = payload.get("role")
                user_id = parse_uuid(payload.get("sub"))

        db = SessionLocal()
        try:
            if user_id:
                u = db.get(User, user_id)
                if u:
                    hospital_id = u.hospital_id
                    role = u.role.name if u.role else role
            db.add(AuditLog(
                hospital_id=hospital_id, user_id=user_id, user_role=role,
                module=module,
                # "…denied" so a refusal can be found without parsing the
                # status code out of the payload.
                action=f"{module}.{method.lower()}" + (".denied" if status_code in _DENIED else ""),
                entity_type=module, entity_id=entity_id,
                new_value={"status_code": status_code, "path": path, "method": method},
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                request_id=request_id,
            ))
            db.commit()
        finally:
            db.close()
