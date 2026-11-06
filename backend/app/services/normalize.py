"""
Normalize free-text voice input to English before it is persisted.

Whisper transcribes a patient's speech in their own script (Telugu/Hindi), so a
voice registration or booking would otherwise store a Telugu name, city, or
symptom *verbatim* in the database. That's wrong: staff read records in English,
search/SMS expect English, and mixed-script free-text is unsearchable. We convert
those fields to English at write time so the database stays uniformly English:

  - name   -> transliterated to Latin, phonetically (Telugu name -> "Ramu"); never translated
  - city   -> transliterated/translated, then snapped to a known city spelling
  - notes  -> translated to English (Telugu complaint -> "Toothache")

Design notes:
  - Script detection first: text that is already Latin is returned untouched, so
    there is zero LLM cost / latency for the common English case.
  - Reuses the OpenAI chat model already configured for the voice assistant
    (OPENAI_API_KEY). Synchronous httpx because the callers are sync endpoints.
  - Fails open: any missing key, timeout, or parse error returns the ORIGINAL
    text. Normalization must never block a registration or a booking.
"""
from __future__ import annotations

import json
from typing import Iterable, Optional

import httpx

from ..config import settings

# Latin script lives in U+0000-U+024F (ASCII + Latin-1 + Latin Extended-A/B).
# Any codepoint above that (Telugu U+0C00-, Devanagari U+0900-, ...) means the
# text is in a non-English script and worth normalizing. Control chars and
# whitespace sit inside the Latin range, so plain English text never trips this.
_MAX_LATIN_CODEPOINT = 0x024F
_HTTP_TIMEOUT = httpx.Timeout(20.0, connect=5.0)


def needs_normalization(text: str) -> bool:
    """True when the text contains non-Latin (e.g. Telugu/Hindi) characters."""
    return bool(text) and any(ord(ch) > _MAX_LATIN_CODEPOINT for ch in text)


def _llm(instruction: str, text: str) -> Optional[str]:
    """Run one tiny chat completion; return the JSON `value`, or None on any error."""
    key = (settings.openai_api_key or "").strip()
    if not key:
        return None
    payload = {
        "model": settings.openai_nlu_model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system",
             "content": instruction + ' Reply ONLY with compact JSON: {"value": "..."}.'},
            {"role": "user", "content": text},
        ],
    }
    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            res = client.post(
                f"{settings.openai_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=payload,
            )
        if res.status_code >= 400:
            print(f"[normalize] LLM error {res.status_code}: {res.text[:200]}")
            return None
        content = res.json()["choices"][0]["message"]["content"]
        value = json.loads(content).get("value")
        return str(value).strip() if value else None
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError, TypeError, ValueError) as exc:
        print(f"[normalize] failed, keeping original text: {exc}")
        return None


def to_english_name(name: str) -> str:
    """Transliterate a spoken name into Latin script (phonetic). Never translate it."""
    name = (name or "").strip()
    if not needs_normalization(name):
        return name
    out = _llm(
        "Transliterate this person's name into Latin (English) script phonetically. "
        "Keep it as a name - do NOT translate the meaning of any word. Use title case.",
        name,
    )
    return out or name


def to_english_text(text: str) -> str:
    """Translate a free-text complaint / clinical note into concise English."""
    text = (text or "").strip()
    if not needs_normalization(text):
        return text
    out = _llm(
        "Translate this patient's medical complaint into short, natural English "
        "suitable for a clinic note. Return only the translation.",
        text,
    )
    return out or text


def to_english_city(city: str, known: Iterable[str] = ()) -> str:
    """Transliterate a city/locality to its English spelling; snap to a known one."""
    city = (city or "").strip()
    if not needs_normalization(city):
        return city
    out = _llm(
        "Convert this Indian city or locality name to its common English spelling. "
        "Return only the place name.",
        city,
    ) or city
    # Prefer an existing canonical spelling when we already know this city.
    low = out.casefold()
    for k in known:
        if k and k.casefold() == low:
            return k
    return out
