"""
Keep the database English: Telugu / Hindi script → English letters.

POLICY (2026-09-29): nothing is stored in Telugu or Hindi script. Patients book
and sign up by voice in their own language, and before this, what they said
went into the database as spoken — "సత్య" as a family member's name, "దగ్గు"
as the visit note, "నా ప్రస్తుత స్థానం" as the start location — and from
there into notifications and SMS. Doctors, reception, reports and SMS all read
these fields, so they must be English.

The screens already convert what they know how to (symptoms to English words,
"My current location" in English). This is the safety net for everything
else — a name typed on a Telugu keyboard, a future screen — applied as a
schema validator on every patient-entered text field.

Rule-based and offline, deliberately: no AI, no API key, no cost, and it can't
invent anything. It SOUNDS OUT the text in English letters ("సత్య" → "Satya");
it does not translate meaning. Text with no Telugu/Hindi letters passes through
unchanged.
"""
from __future__ import annotations

import re
from typing import Optional

_INDIC = re.compile(r"[ऀ-ॿఀ-౿]")

# ---- Telugu ----
_TE_CONS = {
    "క": "k", "ఖ": "kh", "గ": "g", "ఘ": "gh", "ఙ": "ng", "చ": "ch", "ఛ": "chh",
    "జ": "j", "ఝ": "jh", "ఞ": "ny", "ట": "t", "ఠ": "th", "డ": "d", "ఢ": "dh",
    "ణ": "n", "త": "t", "థ": "th", "ద": "d", "ధ": "dh", "న": "n", "ప": "p",
    "ఫ": "ph", "బ": "b", "భ": "bh", "మ": "m", "య": "y", "ర": "r", "ల": "l",
    "వ": "v", "శ": "sh", "ష": "sh", "స": "s", "హ": "h", "ళ": "l", "ఱ": "r",
}
_TE_SIGN = {
    "ా": "a", "ి": "i", "ీ": "i", "ు": "u", "ూ": "u", "ృ": "ru", "ె": "e",
    "ే": "e", "ై": "ai", "ొ": "o", "ో": "o", "ౌ": "au",
}
_TE_VOWEL = {
    "అ": "a", "ఆ": "a", "ఇ": "i", "ఈ": "i", "ఉ": "u", "ఊ": "u", "ఋ": "ru",
    "ఎ": "e", "ఏ": "e", "ఐ": "ai", "ఒ": "o", "ఓ": "o", "ఔ": "au",
}
_TE_VIRAMA = "్"

# ---- Hindi (Devanagari) ----
_HI_CONS = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "च": "ch", "छ": "chh", "ज": "j",
    "झ": "jh", "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t",
    "थ": "th", "द": "d", "ध": "dh", "न": "n", "प": "p", "फ": "ph", "ब": "b",
    "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
    "ष": "sh", "स": "s", "ह": "h",
}
_HI_SIGN = {
    "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "े": "e", "ै": "ai",
    "ो": "o", "ौ": "au", "ृ": "ru",
}
_HI_VOWEL = {
    "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ए": "e",
    "ऐ": "ai", "ओ": "o", "औ": "au",
}
_HI_VIRAMA = "्"
_HI_NUKTA = "़"

# Both scripts in one table: a consonant takes the vowel sign after it, loses
# its "a" before a virama, and otherwise keeps the inherent "a".
_CONS = {**_TE_CONS, **_HI_CONS}
_SIGN = {**_TE_SIGN, **_HI_SIGN}
_VOWEL = {**_TE_VOWEL, **_HI_VOWEL}
_VIRAMAS = {_TE_VIRAMA, _HI_VIRAMA}
_NASAL = {"ం": "m", "ँ": "n", "ं": "n"}
# Before most consonants the nasal sign is heard as "n" (శంకర్ = Shankar); before
# p/b/m, or at a word's end, as "m" (సంపత్ = Sampath, స్థానం = Sthanam).
_LABIALS = {"ప", "ఫ", "బ", "భ", "మ", "प", "फ", "ब", "भ", "म"}
# Marks a consonant's built-in "a" until we know whether Hindi drops it.
_INHERENT = "\x01"
_DROP = {_HI_NUKTA, "ః", "ः", "‌", "‍", "।", "॥"}


def _romanize(text: str) -> str:
    chars = list(text)
    out = []
    i = 0
    while i < len(chars):
        c = chars[i]
        nxt = chars[i + 1] if i + 1 < len(chars) else ""
        if nxt == _HI_NUKTA:                      # क़ → k: the dot changes nothing here
            chars.pop(i + 1)
            nxt = chars[i + 1] if i + 1 < len(chars) else ""
        if c in _CONS:
            out.append(_CONS[c])
            if nxt in _VIRAMAS:
                i += 1
            elif nxt in _SIGN:
                out.append(_SIGN[nxt])
                i += 1
            else:
                out.append(_INHERENT)
        elif c in _VOWEL:
            out.append(_VOWEL[c])
        elif c in _NASAL:
            out.append("n" if nxt in _CONS and nxt not in _LABIALS else _NASAL[c])
        elif c in _SIGN or c in _VIRAMAS or c in _DROP:
            pass
        else:
            out.append(c)
        i += 1
    return "".join(out)


def _hindi_final_a(original: str, romanized: str) -> str:
    """Hindi drops a word-final built-in "a" when spoken ("अमीरपेट" = Ameerpet,
    but "सुनीता" = Sunita — that "a" is written, so it stays). Telugu keeps it
    ("సత్య" = Satya), so only Devanagari text loses it."""
    if re.search(r"[ऀ-ॿ]", original):
        romanized = re.sub(_INHERENT + r"(?=[\s,.]|$)", "", romanized)
    return romanized.replace(_INHERENT, "a")


def has_indic(value: Optional[str]) -> bool:
    return bool(value) and bool(_INDIC.search(value))


def to_english(value: Optional[str]) -> Optional[str]:
    """Telugu/Hindi letters → English letters; anything else unchanged."""
    if not has_indic(value):
        return value
    return re.sub(r"\s+", " ", _hindi_final_a(value, _romanize(value))).strip()


def to_english_name(value: Optional[str]) -> Optional[str]:
    """For names, places and labels: English letters, each word capitalised
    ("సత్య మూర్తి" → "Satya Murti"). English input is left exactly as typed."""
    if not has_indic(value):
        return value
    return " ".join(w[:1].upper() + w[1:] for w in (to_english(value) or "").split(" "))
