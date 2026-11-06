"""
Road travel time and routes via Mapbox (live traffic), then OSRM, then
OpenRouteService (both free).

Mapbox goes first when MAPBOX_TOKEN is set: its driving-traffic profile knows
real traffic, so its minutes are used as they are — no traffic factor. Its free
tier is a monthly quota, so answers are cached for settings.mapbox_cache_minutes
and a rejected token or used-up quota switches Mapbox off for a while; the
free chain below then carries on exactly as it did before Mapbox.

The leave-by feature needs door-to-hospital travel time. Haversine (in
token_engine) only knows straight-line distance; this asks a real routing engine
for actual driving time over the road network. We use OpenRouteService's Matrix
endpoint — a free key (no card) at openrouteservice.org/dev covers ~2,000
requests/day, far more than a hospital booking app needs.

Both free engines give EMPTY-ROAD time (no traffic data — that is the part
Google charges for), which runs ~40% under Google in Hyderabad traffic. So
every free time is multiplied by a time-of-day city-traffic factor (settings
traffic_factor_*) before anyone sees it. Distance and the drawn line are left
as they are.

OSRM goes first: its public server needs no key (same as the Octabuild /
Partner app). It is a shared demo server with no uptime promise, so it gets a
short timeout — slow, down or refusing and we move on to OpenRouteService.

Fails open: no key, a timeout, or any bad response returns None, and the caller
falls back to the haversine estimate. Real driving time is a nicety, never a
hard dependency.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from ..config import settings

_HTTP_TIMEOUT = httpx.Timeout(8.0, connect=4.0)
# OSRM is the first try, so it must not hold the request up for long: if it
# hasn't answered in this time, OpenRouteService gets its turn.
_OSRM_TIMEOUT = httpx.Timeout(4.0, connect=2.0)
# The public OSRM server asks callers to identify themselves.
_OSRM_HEADERS = {"User-Agent": "TapCure/1.0 (hospital map)"}


_IST = timezone(timedelta(hours=5, minutes=30), "IST")


def traffic_factor(at: Optional[datetime] = None) -> float:
    """City-traffic multiplier for an empty-road time, by IST hour: peak
    (8-11 am, 5-10 pm), night (11 pm-6 am), normal otherwise."""
    hour = (at or datetime.now(_IST)).astimezone(_IST).hour
    if 8 <= hour < 11 or 17 <= hour < 22:
        return settings.traffic_factor_peak
    if hour >= 23 or hour < 6:
        return settings.traffic_factor_night
    return settings.traffic_factor_normal


def _traffic_minutes(seconds: float) -> int:
    return max(1, round(seconds * traffic_factor() / 60.0))


# Mapbox answers, keyed like _ROUTE_CACHE: {key: (stored_at, route)}. Live
# traffic goes stale, so unlike the empty-road cache these expire.
_MAPBOX_CACHE: dict[tuple, tuple[float, dict]] = {}
_MAPBOX_CACHE_MAX = 500
# After Mapbox rejects the token (401/403) or the quota runs out (429), skip it
# until this time instead of asking again on every queue refresh.
_mapbox_off_until = 0.0
_MAPBOX_BACKOFF_SECONDS = 600


def _mapbox(o_lat: float, o_lng: float, d_lat: float, d_lng: float) -> Optional[dict]:
    """One Mapbox driving-traffic route: {"points": [[lat, lng], ...],
    "seconds", "km"}, or None when there is no token, Mapbox is backed off,
    slow, down, or finds no road. Seconds already include live traffic.

    Always asks for the full line, so the map and leave-by share one cached
    answer (and one request against the quota).
    """
    global _mapbox_off_until
    token = (settings.mapbox_token or "").strip()
    if not token or time.monotonic() < _mapbox_off_until:
        return None
    cache_key = tuple(round(v, 4) for v in (o_lat, o_lng, d_lat, d_lng))
    hit = _MAPBOX_CACHE.get(cache_key)
    if hit and time.monotonic() - hit[0] < settings.mapbox_cache_minutes * 60:
        return hit[1]

    base = (settings.mapbox_base_url or "").strip().rstrip("/")
    # Like OSRM, Mapbox takes coordinates as longitude,latitude.
    url = f"{base}/directions/v5/mapbox/driving-traffic/{o_lng},{o_lat};{d_lng},{d_lat}"
    params = {"access_token": token, "overview": "full", "geometries": "geojson"}
    try:
        with httpx.Client(timeout=_OSRM_TIMEOUT) as client:
            res = client.get(url, params=params)
        if res.status_code in (401, 403, 429):
            _mapbox_off_until = time.monotonic() + _MAPBOX_BACKOFF_SECONDS
            print(f"[routing] Mapbox refused ({res.status_code}), using OSRM for "
                  f"{_MAPBOX_BACKOFF_SECONDS // 60} min: {res.text[:200]}")
            return None
        if res.status_code >= 400:
            print(f"[routing] Mapbox error {res.status_code}: {res.text[:200]}")
            return None
        body = res.json()
        if body.get("code") != "Ok" or not body.get("routes"):
            return None                              # e.g. NoRoute
        r = body["routes"][0]
        # GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
        points = [[lat, lng] for lng, lat, *_ in r["geometry"]["coordinates"]]
        if len(points) < 2:
            return None
        route = {
            "points": points,
            "seconds": float(r["duration"]),
            "km": round(float(r["distance"]) / 1000.0, 1),
        }
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        # Type name only: httpx error text can include the URL, and the URL
        # carries the token.
        print(f"[routing] Mapbox failed, trying OSRM: {type(exc).__name__}")
        return None
    if len(_MAPBOX_CACHE) >= _MAPBOX_CACHE_MAX:
        _MAPBOX_CACHE.pop(next(iter(_MAPBOX_CACHE)))    # drop the oldest
    _MAPBOX_CACHE[cache_key] = (time.monotonic(), route)
    return route


def _osrm(o_lat: float, o_lng: float, d_lat: float, d_lng: float, geometry: bool) -> Optional[dict]:
    """One OSRM driving route: {"seconds", "meters", "coords" ([lng, lat] list
    when geometry=True)}, or None when OSRM is off, slow, down or finds no road.

    Like ORS, OSRM takes coordinates as longitude,latitude.
    """
    base = (settings.osrm_base_url or "").strip().rstrip("/")
    if not base:
        return None
    url = f"{base}/route/v1/driving/{o_lng},{o_lat};{d_lng},{d_lat}"
    params = {"overview": "full", "geometries": "geojson"} if geometry else {"overview": "false"}
    try:
        with httpx.Client(timeout=_OSRM_TIMEOUT, headers=_OSRM_HEADERS) as client:
            res = client.get(url, params=params)
        if res.status_code >= 400:
            print(f"[routing] OSRM error {res.status_code}: {res.text[:200]}")
            return None
        body = res.json()
        if body.get("code") != "Ok" or not body.get("routes"):
            return None                              # e.g. NoRoute
        r = body["routes"][0]
        return {
            "seconds": float(r["duration"]),
            "meters": float(r["distance"]),
            "coords": r["geometry"]["coordinates"] if geometry else None,
        }
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        print(f"[routing] OSRM failed, trying OpenRouteService: {exc}")
        return None


def driving_minutes(o_lat: float, o_lng: float, d_lat: float, d_lng: float) -> Optional[int]:
    """Driving minutes from origin to destination (traffic-adjusted), or None
    if unavailable.

    Mapbox (live traffic, used as-is) first, then OSRM, then OpenRouteService.
    Note ORS takes coordinates as [longitude, latitude] — the reverse of the
    usual lat/lng order — and returns durations in seconds.
    """
    mapbox = _mapbox(o_lat, o_lng, d_lat, d_lng)
    if mapbox is not None:
        return max(1, round(mapbox["seconds"] / 60.0))
    osrm = _osrm(o_lat, o_lng, d_lat, d_lng, geometry=False)
    if osrm is not None:
        return _traffic_minutes(osrm["seconds"])
    key = (settings.openrouteservice_api_key or "").strip()
    if not key:
        return None
    payload = {
        "locations": [[o_lng, o_lat], [d_lng, d_lat]],
        "metrics": ["duration"],
        "sources": [0],
        "destinations": [1],
    }
    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            res = client.post(
                f"{settings.openrouteservice_base_url}/v2/matrix/driving-car",
                headers={"Authorization": key, "Content-Type": "application/json"},
                json=payload,
            )
        if res.status_code >= 400:
            print(f"[routing] ORS error {res.status_code}: {res.text[:200]}")
            return None
        seconds = res.json()["durations"][0][0]
        if seconds is None:                       # ORS returns null when unroutable
            return None
        return _traffic_minutes(float(seconds))
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        print(f"[routing] failed, falling back to haversine: {exc}")
        return None


# The free Leaflet map used to draw a straight dashed line patient -> hospital;
# this is the road path so it follows streets the way Google's route does.
# Dashboards re-render and re-ask often, and the free key is ~2,000 calls a
# day, so recent routes are remembered. Points are rounded to ~11 m, close
# enough that a patient who hasn't moved gets the same route back. The cache
# holds empty-road seconds; the traffic factor is applied per request, so a
# route cached at night doesn't keep its night time into the morning rush.
_ROUTE_CACHE: dict[tuple, dict] = {}
_ROUTE_CACHE_MAX = 500


def driving_route(o_lat: float, o_lng: float, d_lat: float, d_lng: float) -> Optional[dict]:
    """Road route from origin to destination for drawing on a map:
    {"points": [[lat, lng], ...], "minutes": int, "max_minutes": int,
    "km": float} — minutes..max_minutes is the range the map shows — or None when
    unavailable (Mapbox, OSRM and ORS all down/slow/unconfigured, no road
    between them) — the map then keeps its straight line.
    """
    mapbox = _mapbox(o_lat, o_lng, d_lat, d_lng)
    if mapbox is not None:
        minutes = max(1, round(mapbox["seconds"] / 60.0))   # live traffic, not scaled
        return {
            "points": mapbox["points"],
            "minutes": minutes,
            "max_minutes": minutes + max(0, settings.route_extra_minutes),
            "km": mapbox["km"],
        }
    cache_key = tuple(round(v, 4) for v in (o_lat, o_lng, d_lat, d_lng))
    route = _ROUTE_CACHE.get(cache_key)
    if route is None:
        route = _osrm_route(o_lat, o_lng, d_lat, d_lng) or _ors_route(o_lat, o_lng, d_lat, d_lng)
        if route is None:
            return None
        if len(_ROUTE_CACHE) >= _ROUTE_CACHE_MAX:
            _ROUTE_CACHE.pop(next(iter(_ROUTE_CACHE)))   # drop the oldest
        _ROUTE_CACHE[cache_key] = route
    minutes = _traffic_minutes(route["seconds"])
    return {
        "points": route["points"],
        "minutes": minutes,
        "max_minutes": minutes + max(0, settings.route_extra_minutes),
        "km": route["km"],
    }


def _osrm_route(o_lat: float, o_lng: float, d_lat: float, d_lng: float) -> Optional[dict]:
    osrm = _osrm(o_lat, o_lng, d_lat, d_lng, geometry=True)
    if osrm is None:
        return None
    # GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
    points = [[lat, lng] for lng, lat, *_ in osrm["coords"]]
    if len(points) < 2:
        return None
    return {
        "points": points,
        "seconds": osrm["seconds"],
        "km": round(osrm["meters"] / 1000.0, 1),
    }


def _ors_route(o_lat: float, o_lng: float, d_lat: float, d_lng: float) -> Optional[dict]:
    key = (settings.openrouteservice_api_key or "").strip()
    if not key:
        return None
    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            res = client.post(
                f"{settings.openrouteservice_base_url}/v2/directions/driving-car/geojson",
                headers={"Authorization": key, "Content-Type": "application/json"},
                json={"coordinates": [[o_lng, o_lat], [d_lng, d_lat]]},
            )
        if res.status_code >= 400:
            print(f"[routing] ORS route error {res.status_code}: {res.text[:200]}")
            return None
        feature = res.json()["features"][0]
        summary = feature["properties"]["summary"]
        # GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
        points = [[lat, lng] for lng, lat, *_ in feature["geometry"]["coordinates"]]
        if len(points) < 2:
            return None
        return {
            "points": points,
            "seconds": float(summary.get("duration", 0)),
            "km": round(float(summary.get("distance", 0)) / 1000.0, 1),
        }
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        print(f"[routing] route failed, map keeps the straight line: {exc}")
        return None
