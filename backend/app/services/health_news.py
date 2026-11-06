"""Public-health news, pulled from official RSS feeds.

Why a server-side proxy rather than fetching in the browser:
  - the feeds are cross-origin and would be CORS-blocked;
  - one cache here serves every visitor instead of every visitor hitting the
    source;
  - if a paid news API is ever swapped in, its key stays server-side.

Why *official* feeds only (WHO, CDC by default) rather than a health-news
aggregator: whatever this returns is published on a hospital-facing site under
TapCure's name, and nobody reviews it before it appears. A government or WHO
newsroom is accountable for what it publishes; a general news feed mixes in
supplement advertising and health scares that a hospital should not be seen to
carry.

Fails open, always: an unreachable or malformed feed yields an empty list, the
API returns 200 with `items: []`, and the page hides the section. A news strip
is never worth breaking a page over.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.request import Request, urlopen

from ..config import settings

_TAG_RE = re.compile(r"<[^>]+>")
# url -> (fetched_at, items). Process-local: one API worker, one cache.
_cache: dict[str, tuple[datetime, list[dict]]] = {}


def _clean(text: str | None, limit: int = 300) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", _TAG_RE.sub(" ", text)).strip()[:limit]


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value)          # RFC 822, what RSS uses
    except (TypeError, ValueError):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))  # Atom
        except ValueError:
            return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _parse_feed(xml_text: str, source: str) -> list[dict]:
    """RSS <item> or Atom <entry> → a flat list of dicts."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    out: list[dict] = []
    atom = "{http://www.w3.org/2005/Atom}"
    nodes = root.iter("item") if root.find(".//item") is not None else root.iter(f"{atom}entry")
    for node in nodes:
        title = _clean((node.findtext("title") or node.findtext(f"{atom}title")), 200)
        if not title:
            continue
        link = node.findtext("link") or ""
        if not link:                                # Atom puts it on an attribute
            el = node.find(f"{atom}link")
            link = el.get("href", "") if el is not None else ""
        published = _parse_date(
            node.findtext("pubDate") or node.findtext(f"{atom}updated") or node.findtext("date")
        )
        out.append({
            "title": title,
            "link": link.strip(),
            "summary": _clean(node.findtext("description") or node.findtext(f"{atom}summary")),
            "source": source,
            "published_at": published.isoformat() if published else None,
        })
    return out


def _fetch(url: str, source: str) -> list[dict]:
    cached = _cache.get(url)
    if cached and datetime.now(timezone.utc) - cached[0] < timedelta(hours=settings.health_news_cache_hours):
        return cached[1]
    try:
        # Some newsrooms reject the default urllib agent outright.
        req = Request(url, headers={"User-Agent": "TapCure/1.0 (+https://tapcure.in)"})
        with urlopen(req, timeout=settings.health_news_timeout_seconds) as resp:  # noqa: S310 - configured URL
            items = _parse_feed(resp.read().decode("utf-8", errors="replace"), source)
    except Exception:
        # Keep serving the last good copy if we have one — a blip shouldn't empty
        # the page.
        return cached[1] if cached else []
    _cache[url] = (datetime.now(timezone.utc), items)
    return items


def _configured_feeds() -> list[tuple[str, str]]:
    """`HEALTH_NEWS_FEEDS` as "Label|url, Label|url". Blank = feature off."""
    raw = (settings.health_news_feeds or "").strip()
    feeds = []
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        label, _, url = chunk.partition("|")
        if url.strip():
            feeds.append((label.strip() or "Health", url.strip()))
    return feeds


def latest(limit: int = 8) -> list[dict]:
    """Newest first, across every configured feed. Never raises."""
    items: list[dict] = []
    for source, url in _configured_feeds():
        items.extend(_fetch(url, source))
    # Undated items sink rather than jumping the queue.
    items.sort(key=lambda i: i["published_at"] or "", reverse=True)
    return items[:limit]
