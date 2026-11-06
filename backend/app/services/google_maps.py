"""
Road travel time via the Google Distance Matrix API (server-side).

This is the most accurate provider in the leave-by ETA chain because it can
factor in live traffic (`duration_in_traffic`). It sits ABOVE OpenRouteService
in services/token_engine.travel_minutes_for: Google is tried first, and only if
it's unconfigured or fails do we fall through to ORS, then the offline haversine
estimate.

Fails open exactly like services/routing.py: no key, a timeout, a non-OK status,
or any bad response returns None, and the caller drops to the next provider.
Google is a nicety, never a hard dependency.

Uses the SERVER key (settings.google_maps_api_key) — kept out of the browser.
Restrict that key to the Distance Matrix API and lock it to the server IP.
"""
from __future__ import annotations

from typing import Optional
from urllib.parse import quote_plus

import httpx

from ..config import settings

_HTTP_TIMEOUT = httpx.Timeout(8.0, connect=4.0)


def directions_url(lat=None, lng=None, *address_parts) -> str:
    """A "get directions" link for a hospital — coordinates when we have them.

    Needs no API key and makes no call: it's the public maps deep link, which
    opens the Google Maps app on a phone and the site on a desktop. Coordinates
    are preferred because a hospital name in a small town routes to the wrong
    place surprisingly often; the address text is the fallback.

    Always returns a usable URL. A WhatsApp template parameter may not be blank,
    so an empty string here would cost the patient the whole message, not just
    the link.
    """
    base = "https://www.google.com/maps/dir/?api=1&destination="
    if lat is not None and lng is not None:
        try:
            return f"{base}{float(lat):.6f},{float(lng):.6f}"
        except (TypeError, ValueError):
            pass
    text = ", ".join(str(p).strip() for p in address_parts if p and str(p).strip())
    return f"{base}{quote_plus(text)}" if text else "https://www.google.com/maps"


def driving_minutes(o_lat: float, o_lng: float, d_lat: float, d_lng: float) -> Optional[int]:
    """Driving minutes from origin to destination, or None if unavailable.

    Prefers Google's live-traffic duration (`duration_in_traffic`) and falls back
    to the free-flow `duration` when traffic data isn't returned.
    """
    key = (settings.google_maps_api_key or "").strip()
    if not key:
        return None
    params = {
        "origins": f"{o_lat},{o_lng}",
        "destinations": f"{d_lat},{d_lng}",
        "mode": "driving",
        "departure_time": "now",   # asks Google for live-traffic duration
        "key": key,
    }
    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            res = client.get(f"{settings.google_maps_base_url}/distancematrix/json", params=params)
        if res.status_code >= 400:
            print(f"[google_maps] HTTP {res.status_code}: {res.text[:200]}")
            return None
        data = res.json()
        if data.get("status") != "OK":
            print(f"[google_maps] status {data.get('status')}: {data.get('error_message', '')[:200]}")
            return None
        element = data["rows"][0]["elements"][0]
        if element.get("status") != "OK":
            return None  # e.g. ZERO_RESULTS (unroutable)
        dur = element.get("duration_in_traffic") or element.get("duration")
        seconds = dur.get("value") if dur else None
        if seconds is None:
            return None
        return max(1, round(float(seconds) / 60.0))
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        print(f"[google_maps] failed, falling through to next provider: {exc}")
        return None
