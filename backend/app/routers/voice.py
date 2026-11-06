"""
Voice assistant proxy for the patient "Book by Voice" guide.

Two thin endpoints that keep the OpenAI key server-side:

  POST /voice/transcribe  — multipart audio -> Whisper -> { text }
  POST /voice/nlu         — JSON intent task -> chat model -> structured choice

Both require an authenticated user (any role) and return HTTP 503 when no
OPENAI_API_KEY is configured, which is the frontend's signal to fall back to the
free on-device browser Web Speech API. We talk to the OpenAI REST API directly
with httpx so there's no extra SDK dependency.
"""
from __future__ import annotations

import json
from typing import List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, Field

from ..config import settings
from ..deps import get_current_user
from ..models import User

router = APIRouter(prefix="/voice", tags=["voice"])

# Cap uploads so a stray/oversized recording can't tie up the worker. A guided
# answer is a few seconds of speech; 25 MB is OpenAI's own Whisper limit.
MAX_AUDIO_BYTES = 25 * 1024 * 1024
HTTP_TIMEOUT = httpx.Timeout(60.0, connect=10.0)

# BCP-47 (from the frontend) -> ISO-639-1 hint for Whisper. Improves accuracy by
# telling Whisper which language to expect; unknown values are simply omitted.
_WHISPER_LANG = {"en": "en", "te": "te", "hi": "hi"}
_LANG_NAME = {"en": "English", "te": "Telugu", "hi": "Hindi"}


def _stt_provider() -> str:
    return (settings.stt_provider or "openai").strip().lower()


def _require_openai_key() -> str:
    key = (settings.openai_api_key or "").strip()
    if not key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "OpenAI is not configured.",
        )
    return key


def _require_stt_enabled() -> tuple[str, str]:
    provider = _stt_provider()
    if provider == "deepgram":
        key = (settings.deepgram_api_key or "").strip()
        if key:
            return provider, key
    elif provider == "openai":
        key = (settings.openai_api_key or "").strip()
        if key:
            return provider, key
    raise HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Cloud voice is not configured; use the on-device fallback.",
    )


def _require_voice_enabled() -> str:
    # NLU still uses OpenAI chat completions. STT may use another provider.
    return _require_openai_key()


# ============================================================ Transcribe =====
@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form("en"),
):
    """Speech-to-text via Whisper. `language` is a short code (en/te/hi).

    Intentionally public: it powers the pre-login patient voice registration
    guide. The OpenAI key stays server-side.
    """
    provider, key = _require_stt_enabled()
    data = await audio.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty audio upload")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Audio too large")

    lang = _WHISPER_LANG.get((language or "").lower()[:2]) or "en"

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            if provider == "deepgram":
                res = await client.post(
                    f"{settings.deepgram_base_url}/v1/listen",
                    # Indian English, not US: plain "en" mangles names like
                    # Satya / Lakshmi. Whisper only takes ISO-639-1, so this
                    # stays Deepgram-only.
                    params={
                        "model": settings.deepgram_model,
                        "language": "en-IN" if lang == "en" else lang,
                        "smart_format": "true",
                    },
                    headers={
                        "Authorization": f"Token {key}",
                        "Content-Type": audio.content_type or "audio/webm",
                    },
                    content=data,
                )
            else:
                form = {"model": settings.openai_stt_model, "response_format": "json"}
                if lang:
                    form["language"] = lang
                files = {"file": (audio.filename or "speech.webm", data, audio.content_type or "audio/webm")}
                res = await client.post(
                    f"{settings.openai_base_url}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {key}"},
                    data=form,
                    files=files,
                )
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Speech service unreachable")

    if res.status_code >= 400:
        detail = res.text[:300] if res.text else f"Speech service error ({res.status_code})"
        print(f"{provider.title()} transcription error {res.status_code}: {detail}")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail)

    payload = res.json() or {}
    if provider == "deepgram":
        try:
            text = payload["results"]["channels"][0]["alternatives"][0].get("transcript", "")
        except (KeyError, IndexError, TypeError):
            text = ""
    else:
        text = payload.get("text", "")
    return {"text": (text or "").strip()}


# =================================================================== NLU ======
class NluOption(BaseModel):
    id: str
    label: str


class NluRequest(BaseModel):
    transcript: str
    language: str = "en"
    # match_option: pick the option that best matches the speech (or none)
    # yes_no:       did the speaker agree? -> value "yes" | "no" | ""
    # pick_date:    resolve a spoken day to an ISO date relative to `today`
    # correction:   is the reply CHANGING an earlier answer? -> field + value
    task: Literal["match_option", "yes_no", "pick_date", "correction"] = "match_option"
    options: List[NluOption] = Field(default_factory=list)
    today: Optional[str] = None  # YYYY-MM-DD, required for pick_date
    hint: Optional[str] = None   # extra instruction, e.g. what's being chosen
    # correction only: the booking so far as JSON (who, symptom, doctor, date…)
    context: Optional[str] = Field(None, max_length=2000)


class NluResponse(BaseModel):
    value: str = ""        # option id / "yes"|"no" / ISO date — "" means unclear
    field: str = ""        # correction only: which earlier answer changed ("" = none)
    confidence: float = 0.0
    reply: str = ""        # short spoken acknowledgement in the user's language


def _build_prompt(body: NluRequest) -> str:
    lang = _LANG_NAME.get((body.language or "en").lower()[:2], "English")
    base = (
        f"You interpret a patient's spoken reply (transcribed, possibly messy) in a "
        f"doctor-appointment voice assistant. The patient speaks {lang}. "
        f'Reply ONLY with compact JSON: {{"value": ..., "confidence": 0..1, "reply": "..."}}. '
        f'"reply" is a short, warm acknowledgement written in {lang}. '
        f"If the reply is unclear, set value to empty and confidence below 0.4."
    )
    if body.task == "yes_no":
        # Without the question, "అంజలిని జాబితాలోకి చేర్చు" (add Anjali to the
        # list) read as unclear: an instruction to go ahead is only a "yes" once
        # you know what was asked.
        asked = (
            f" The assistant asked: {body.hint}. An instruction to go ahead with what"
            f' was asked ("add her", "book it", "చేర్చు", "జోడించండి", "जोड़ दो", '
            f'"कर दो") is "yes"; an instruction not to ("don\'t add", "వద్దు") is "no". '
            f"Speech-to-text often misspells yes (\"అవనో\" for \"అవును\")."
        ) if body.hint else ""
        return base + asked + ' For "value" return "yes", "no", or "".'
    if body.task == "correction":
        # Voice booking asks one question at a time, and each step used to hear
        # only its own question — "no, her name is Sundari" at "shall I add
        # Sudhi?" was just "no". This asks, before the step's own handling,
        # whether the patient is changing something they ALREADY answered. The
        # frontend verifies whatever comes back (doctor exists, date free) and
        # falls back to the step's normal handling when this says "".
        return (
            f"You check one transcribed spoken reply (possibly messy) in a doctor-"
            f"appointment voice booking. The patient speaks {lang}. "
            f"The assistant just asked: {body.hint or 'a question'}. "
            f"What the patient already told us (JSON): {body.context or '{}'}. "
            f"Decide whether the reply CHANGES one of those earlier answers — a "
            f"correction such as \"no, her name is Sundari\", \"make it Wednesday\", "
            f"\"actually I want Dr. Satya\", \"not for me, for my mother\". "
            f"If the reply just answers the question that was asked (including a plain "
            f"yes or no), or repeats an answer unchanged, or you are unsure, field is \"\". "
            f"Fields: person_name (the name of the family member being added), who "
            f"(whom the visit is for: myself, or a family member / relation), symptom, "
            f"doctor, location (the town or area to find doctors in), date, origin "
            f"(where the patient starts the journey from). "
            f"\"value\" is the NEW value only, in the patient's words, with names and "
            f"places in English letters. Never invent a value that was not said. "
            f'Reply ONLY with compact JSON: {{"field": "", "value": "", "confidence": 0..1}}.'
        )
    if body.task == "pick_date":
        # The relative-day words are spelled out because the model returned an
        # empty value for "ఎల్లుండి" (day after tomorrow) — a completely ordinary
        # thing to say when booking. A generic "resolve the spoken day" leaves
        # the everyday vocabulary to chance.
        return base + (
            f' Today is {body.today}. Resolve the spoken day to an absolute date and '
            f'return it in "value" as YYYY-MM-DD. Understand relative days in all three '
            f'languages, including: today / ఈరోజు / आज; tomorrow / రేపు / कल; the day '
            f'after tomorrow / ఎల్లుండి / परसों; next week / వచ్చే వారం / अगले हफ्ते; '
            f'a named weekday ("next Monday", "సోమవారం", "सोमवार"); and "in N days". '
            f"Never return a date in the past."
        )
    opts = "\n".join(f"- id={o.id}: {o.label}" for o in body.options)
    extra = f" Context: {body.hint}." if body.hint else ""
    return base + (
        f' For "value" return the id of the single best-matching option, or "" if none fit.'
        f"{extra}\nOptions:\n{opts}"
    )


# What a voice-booking correction may change; anything else the model says is ignored.
_CORRECTION_FIELDS = {"person_name", "who", "symptom", "doctor", "location", "date", "origin"}


@router.post("/nlu", response_model=NluResponse)
async def nlu(body: NluRequest, me: User = Depends(get_current_user)):
    """Map a free-form spoken reply to a structured choice for the current step."""
    key = _require_voice_enabled()
    if body.task == "pick_date" and not body.today:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "pick_date requires `today`")

    payload = {
        "model": settings.openai_nlu_model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _build_prompt(body)},
            {"role": "user", "content": body.transcript or ""},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            res = await client.post(
                f"{settings.openai_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Language service unreachable")

    if res.status_code >= 400:
        # Log the upstream's own words. A decommissioned model answers 404
        # "model_not_found", and the bare status code hid that for weeks: every
        # NLU call failed, the UI quietly fell back to keyword matching, and the
        # voice flow just seemed bad at understanding people.
        detail = ""
        try:
            detail = (res.json().get("error") or {}).get("message") or ""
        except Exception:
            detail = (res.text or "")[:200]
        print(f"[voice:nlu] upstream {res.status_code} model={settings.openai_nlu_model}: {detail}")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Language service error ({res.status_code})" + (f": {detail}" if detail else ""),
        )

    try:
        content = res.json()["choices"][0]["message"]["content"]
        parsed = json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError, TypeError):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not parse language service response")

    value = parsed.get("value")
    # match_option must echo back a real option id; reject hallucinated ids.
    if body.task == "match_option" and value:
        valid = {o.id for o in body.options}
        if str(value) not in valid:
            value = ""
    field = ""
    if body.task == "correction":
        field = str(parsed.get("field") or "").strip()
        if field not in _CORRECTION_FIELDS or not str(value or "").strip():
            field, value = "", ""
        value = str(value)[:200]
    return NluResponse(
        value="" if value is None else str(value),
        field=field,
        confidence=float(parsed.get("confidence") or 0.0),
        reply=str(parsed.get("reply") or ""),
    )


# ============================================================== Extract ======
# The pre-login voice sign-up asks name / mobile / city / yes-no. The frontend's
# word rules catch clean answers; only answers they can't read come here, so
# "it's for my mother, her name is Lakshmi" or "nine eight double seven ..."
# still land. Public like /transcribe (sign-up has no user yet), so it is kept
# narrow: five fixed questions, a short transcript, a tiny reply — never a
# free-form prompt anyone could use as a general LLM.
MAX_EXTRACT_CHARS = 300
# A patient is waiting in silence while this runs. If Groq is slow, give up
# fast and let the frontend's word rules carry on, instead of the 60s default.
EXTRACT_TIMEOUT = httpx.Timeout(6.0, connect=3.0)

_EXTRACT_ASK = {
    "name": (
        "The patient was asked for their full name to create an account. Put only "
        "the person's name in \"value\", in the same script they used, without "
        "titles or filler (\"my name is\", \"garu\", \"ji\"). If the reply holds no "
        "name at all (a greeting, a question, a refusal, \"I don't know\", a number), "
        "value is \"\"."
    ),
    "mobile": (
        "The patient was asked for their 10-digit Indian mobile number. Put only the "
        "digits in \"value\", resolving spoken forms like \"double seven\" (77), "
        "\"triple zero\" (000) and number words in any language. Drop a leading +91 "
        "or 0. If fewer than 10 digits were given, value is \"\"."
    ),
    "city": (
        "The patient was asked which city, town or village they live in. Put only "
        "the place name in \"value\", in the same script they used. If the reply "
        "names no place, value is \"\"."
    ),
    "yes_no": (
        "The patient was asked to confirm something with yes or no. \"value\" is "
        "\"yes\", \"no\", or \"\" if the reply is neither."
    ),
}

# Book by Voice, "who is this appointment for?" when the answer isn't the
# patient or someone already on their family list. Relation labels match the
# frontend's list and are what gets saved on the family member.
PERSON_RELATIONS = (
    "Father", "Mother", "Son", "Daughter", "Wife", "Husband", "Brother", "Sister",
    "Grandfather", "Grandmother", "Grandson", "Granddaughter", "Uncle", "Aunt",
    "Cousin", "Nephew", "Niece", "Father-in-law", "Mother-in-law", "Son-in-law",
    "Daughter-in-law", "Brother-in-law", "Sister-in-law", "Friend", "Neighbour",
    "Colleague",
)
_EXTRACT_PERSON = (
    "The patient was asked who this doctor appointment is for, and it is someone "
    "else. Return compact JSON {\"relation\": ..., \"name\": ...}. \"relation\" is "
    f"exactly one of: {', '.join(PERSON_RELATIONS)} — or \"\" if they gave none. "
    "\"name\" is only that person's own name, in the script they used, or \"\" if "
    "they did not say one. A relation word is never a name: \"for my friend\" is "
    "{\"relation\": \"Friend\", \"name\": \"\"}; \"my friend Kiran\" is "
    "{\"relation\": \"Friend\", \"name\": \"Kiran\"}; \"నా ఫ్రెండ్ కోసం\" is "
    "{\"relation\": \"Friend\", \"name\": \"\"}. Never guess or invent."
)


class ExtractRequest(BaseModel):
    transcript: str = Field(max_length=MAX_EXTRACT_CHARS)
    language: str = "en"
    field: Literal["name", "mobile", "city", "yes_no", "person"]


class ExtractResponse(BaseModel):
    value: str = ""
    relation: str = ""   # "person" only: one of PERSON_RELATIONS, or ""


@router.post("/extract", response_model=ExtractResponse)
async def extract(body: ExtractRequest):
    """Pull the answer out of a messy spoken reply in the voice sign-up."""
    key = _require_voice_enabled()
    transcript = (body.transcript or "").strip()
    if not transcript:
        return ExtractResponse()
    lang = _LANG_NAME.get((body.language or "en").lower()[:2], "English")
    if body.field == "person":
        system = (
            f"You read one transcribed spoken reply (possibly messy, in {lang}) from a "
            f"patient booking a doctor appointment. {_EXTRACT_PERSON} Reply ONLY with that JSON."
        )
    else:
        system = (
            f"You read one transcribed spoken reply (possibly messy, in {lang}) from a "
            f"patient signing up to a doctor-appointment app. "
            f"{_EXTRACT_ASK[body.field]} "
            f'Reply ONLY with compact JSON: {{"value": "..."}}. Never guess or invent.'
        )
    payload = {
        "model": settings.openai_nlu_model,
        "temperature": 0,
        # gpt-oss reasons before answering; a tight cap cut it off mid-thought
        # and Groq then rejected the empty JSON.
        "max_tokens": 1000,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": transcript},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=EXTRACT_TIMEOUT) as client:
            res = await client.post(
                f"{settings.openai_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.TimeoutException:
        print("[voice:extract] Groq timed out after 6s; frontend falls back to word rules")
        return ExtractResponse()
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Language service unreachable")
    # Groq answers 400 json_validate_failed when the model produced no JSON —
    # for an answer like "why do you need that". That is "no answer", not an outage.
    if res.status_code == 400 and "json_validate_failed" in (res.text or ""):
        return ExtractResponse()
    if res.status_code >= 400:
        print(f"[voice:extract] upstream {res.status_code} model={settings.openai_nlu_model}: {(res.text or '')[:200]}")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Language service error ({res.status_code})")
    try:
        parsed = json.loads(res.json()["choices"][0]["message"]["content"])
        value = parsed.get("name" if body.field == "person" else "value")
        relation = str(parsed.get("relation") or "").strip() if body.field == "person" else ""
    except (KeyError, IndexError, json.JSONDecodeError, TypeError, AttributeError):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not parse language service response")
    if relation not in PERSON_RELATIONS:
        relation = ""   # only labels the frontend knows get through
    # The frontend re-checks this with its own rules before using it.
    return ExtractResponse(value=str(value or "").strip()[:80], relation=relation)


# ================================================================== TTS ======
# Map the frontend's short language code to a configured Sonic voice id (falling
# back to the default voice) and to Cartesia's language code.
_TTS_VOICE = {
    "te": lambda: settings.cartesia_voice_te,
    "hi": lambda: settings.cartesia_voice_hi,
    "en": lambda: settings.cartesia_voice_en,
}
_CARTESIA_LANG = {"en": "en", "te": "te", "hi": "hi"}
MAX_TTS_CHARS = 1000


class TtsRequest(BaseModel):
    text: str
    language: str = "en"


def _tts_voice_id(language: str) -> str:
    code = (language or "en").lower()[:2]
    specific = _TTS_VOICE.get(code, lambda: "")()
    return (specific or settings.cartesia_voice_id or "").strip()


def _require_tts_enabled(language: str) -> tuple[str, str]:
    key = (settings.cartesia_api_key or "").strip()
    voice = _tts_voice_id(language)
    if not key or not voice:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Cloud TTS is not configured; use the on-device fallback.",
        )
    return key, voice


@router.post("/tts")
async def tts(body: TtsRequest):
    """Text-to-speech via Cartesia Sonic. Returns MP3 audio bytes.

    Intentionally public (no auth): it powers the landing page and the
    login/register voice guide, which run before the patient is signed in.
    """
    key, voice = _require_tts_enabled(body.language)
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty text")
    text = text[:MAX_TTS_CHARS]

    payload = {
        "model_id": settings.cartesia_model,
        "transcript": text,
        "voice": {"mode": "id", "id": voice},
        "language": _CARTESIA_LANG.get((body.language or "en").lower()[:2], "en"),
        "output_format": {"container": "mp3", "sample_rate": 44100, "bit_rate": 128000},
    }
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            res = await client.post(
                f"{settings.cartesia_base_url}/tts/bytes",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Cartesia-Version": settings.cartesia_version,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Speech service unreachable")

    if res.status_code >= 400:
        detail = res.text[:300] if res.text else f"Speech service error ({res.status_code})"
        print(f"Cartesia TTS error {res.status_code}: {detail}")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail)
    return Response(content=res.content, media_type="audio/mpeg")


@router.get("/status")
def voice_status():
    """Lets the UI show 'high-accuracy voice on' vs 'using on-device voice'.

    Public so pre-login surfaces (landing / login guide) can tell whether the
    Cartesia voice is available.
    """
    cloud_tts = bool((settings.cartesia_api_key or "").strip() and _tts_voice_id("te"))
    provider = _stt_provider()
    cloud_stt = bool(
        ((settings.deepgram_api_key or "").strip() if provider == "deepgram" else (settings.openai_api_key or "").strip())
    )
    return {
        "cloud_voice": cloud_stt,
        "cloud_stt": cloud_stt,
        "stt_provider": provider,
        "cloud_nlu": bool((settings.openai_api_key or "").strip()),
        "cloud_tts": cloud_tts,
    }
