"""
Road route for the free (Leaflet / OpenStreetMap) hospital map.

GET /geo/route — the patient's origin to the hospital, as points along the roads,
so the map draws the route the way Google's does instead of a straight line.
Goes through the backend (Mapbox, then OSRM, then OpenRouteService) so the ORS key
stays server-side and routes are cached, and needs a login so strangers can't
spend the free quotas.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..deps import get_current_user
from ..models import User
from ..services import routing

router = APIRouter(prefix="/geo", tags=["geo"])


@router.get("/route")
def road_route(
    from_lat: float = Query(..., ge=-90, le=90),
    from_lng: float = Query(..., ge=-180, le=180),
    to_lat: float = Query(..., ge=-90, le=90),
    to_lng: float = Query(..., ge=-180, le=180),
    me: User = Depends(get_current_user),
):
    """{"points": [[lat, lng], ...], "minutes": int, "max_minutes": int, "km": float}.

    404 when no road route is available (OSRM and ORS both down or slow, no ORS
    key, quota used up, unroutable) — the frontend then keeps its straight line.
    """
    route = routing.driving_route(from_lat, from_lng, to_lat, to_lng)
    if not route:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No road route available")
    return route
