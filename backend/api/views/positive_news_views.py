from __future__ import annotations

import ipaddress
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any

from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


ENV_NEWSDATA_API_KEY = "NEWSDATA_API_KEY"
NEWSDATA_ENDPOINT = "https://newsdata.io/api/1/latest"
IP_LOOKUP_ENDPOINT = "https://ipapi.co/{ip}/json/"
SELF_IP_LOOKUP_ENDPOINT = "https://ipapi.co/json/"
REVERSE_GEOCODE_ENDPOINT = (
    "https://api.bigdatacloud.net/data/reverse-geocode-client"
    "?latitude={lat}&longitude={lon}&localityLanguage=en"
)
USER_AGENT = "Torensa positive news"
CACHE_TTL_SECONDS = 30 * 60
MAX_RESULTS = 8
# The free plan exposes only the newest hours of news, and both the
# `timeframe` param and the archive endpoint are paid. So keep a rolling
# pool per location instead: each fetch tops it up, nothing older than a
# week survives, and no extra API credits are spent.
MAX_AGE_DAYS = 7
SCOPE_ORDER = {"local": 0, "regional": 1, "national": 2, "world": 3}
POOL_TTL_SECONDS = MAX_AGE_DAYS * 24 * 60 * 60
FETCH_SIZE = 10
MAX_QUERY_LENGTH = 100
SENTIMENT_SUPPORT_CACHE_KEY = "positive_news:sentiment_supported:v1"
SENTIMENT_SUPPORT_TTL_SECONDS = 24 * 60 * 60

# The free newsdata.io plan rejects the `sentiment` parameter with a 403, so
# positivity is approximated with an OR keyword query plus a negative filter.
POSITIVE_TERMS = (
    "uplifting",
    "heartwarming",
    "inspiring",
    "celebrates",
    "charity",
    "volunteers",
    "rescued",
    "milestone",
    "breakthrough",
    "award",
)
NEGATIVE_TERMS = (
    "killed", "dead", "death", "dies", "murder", "shooting", "stabbed",
    "attack", "war", "terror", "rape", "abuse", "assault", "crash",
    "arrested", "jailed", "fraud", "scam", "lawsuit", "outbreak",
    "wounded", "injured", "victim", "protest", "strike", "layoff",
    "bankrupt", "collapse", "warning", "crisis", "disaster",
    "guilty", "cruelty", "convicted", "conviction", "plead", "pleads",
    "sentenced", "charged", "probation", "court", "trial", "kills",
    "killing", "shot", "violence", "violent", "threat", "banned",
    "fined", "suspect", "missing", "died", "deaths", "flood",
    "quake", "storm", "toll", "feud", "slams", "controversy",
    "backlash", "resigns", "sacked", "recession", "hostage",
    "torture", "trafficking", "molest", "assaulted", "probe",
)
NEGATIVE_TERM_SET = frozenset(NEGATIVE_TERMS)
# Prefix-matched so inflections ("murdered", "killings") are caught too. Only
# stems that cannot head a harmless word belong here: "dead" would swallow
# "deadline", "rob" would swallow "robust", so those stay exact matches above.
NEGATIVE_STEMS = (
    "murder", "kill", "shoot", "stab", "assault", "arrest", "convict",
    "sentenc", "injur", "wound", "victim", "abduct", "kidnap", "tortur",
    "traffick", "molest", "rape", "crash", "collis", "disaster", "flood",
    "earthquak", "wildfire", "fatal", "death", "drown", "mourn", "funeral",
    "grief", "tragedy", "tragic", "suicid", "overdos", "epidemic", "outbreak",
    "layoff", "bankrupt", "fraud", "scam", "lawsuit", "guilt", "cruel",
    "protest", "riot", "terror", "hostage", "evacuat", "destroy", "jail",
    "prison", "abus", "threat", "violen", "controvers", "backlash", "resign",
    "recession", "theft", "burglar", "robbe", "stole", "attack", "warn",
    "crisis", "feud", "slam", "swept", "unrest", "damag",
)


def _header_value(request, name: str) -> str:
    return (request.headers.get(name) or "").strip()


def _first_forwarded_ip(value: str) -> str:
    if not value:
        return ""
    return value.split(",", 1)[0].strip()


def _client_ip(request) -> str:
    candidates = [
        _header_value(request, "CF-Connecting-IP"),
        _header_value(request, "True-Client-IP"),
        _first_forwarded_ip(_header_value(request, "X-Forwarded-For")),
        request.META.get("REMOTE_ADDR", ""),
    ]
    for candidate in candidates:
        try:
            ip = ipaddress.ip_address(candidate)
        except ValueError:
            continue
        if not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved):
            return str(ip)
    return ""


def _clean_location_part(value: str) -> str:
    value = urllib.parse.unquote_plus((value or "").strip())
    value = re.sub(r"\s+", " ", value)
    return value[:80]


def _location_from_headers(request) -> dict[str, str]:
    city = _clean_location_part(
        _header_value(request, "X-Vercel-IP-City")
        or _header_value(request, "CF-IPCity")
        or _header_value(request, "X-Appengine-City")
    )
    region = _clean_location_part(
        _header_value(request, "X-Vercel-IP-Country-Region")
        or _header_value(request, "CF-Region")
        or _header_value(request, "X-Appengine-Region")
    )
    country = _clean_location_part(
        _header_value(request, "X-Vercel-IP-Country")
        or _header_value(request, "CF-IPCountry")
        or _header_value(request, "X-Appengine-Country")
    )
    country_code = country.upper() if len(country) == 2 else ""
    if city or region or country:
        return {
            "city": city,
            "region": region,
            "country": country,
            "country_code": country_code,
            "source": "headers",
        }
    return {}


def _location_from_ip(ip: str) -> dict[str, str]:
    if not ip:
        return {}
    try:
        req = urllib.request.Request(
            IP_LOOKUP_ENDPOINT.format(ip=urllib.parse.quote(ip)),
            headers={"User-Agent": "Torensa positive news location lookup"},
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return {}

    return _parse_ipapi(payload, "ip")


def _parse_ipapi(payload: dict[str, Any], source: str) -> dict[str, str]:
    city = _clean_location_part(payload.get("city") or "")
    region = _clean_location_part(payload.get("region") or "")
    country = _clean_location_part(payload.get("country_name") or payload.get("country") or "")
    country_code = _clean_location_part(payload.get("country_code") or payload.get("country") or "").upper()
    if city or region or country:
        return {
            "city": city,
            "region": region,
            "country": country,
            "country_code": country_code if len(country_code) == 2 else "",
            "source": source,
        }
    return {}


def _location_from_public_ip() -> dict[str, str]:
    """Local dev has no client IP and no CDN headers; ask what the server looks like."""
    try:
        req = urllib.request.Request(
            SELF_IP_LOOKUP_ENDPOINT, headers={"User-Agent": USER_AGENT}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return {}
    return _parse_ipapi(payload, "server-ip")


def _location_from_coords(lat: str, lon: str) -> dict[str, str]:
    try:
        lat_f, lon_f = float(lat), float(lon)
    except (TypeError, ValueError):
        return {}
    if not (-90 <= lat_f <= 90 and -180 <= lon_f <= 180):
        return {}
    try:
        req = urllib.request.Request(
            REVERSE_GEOCODE_ENDPOINT.format(lat=lat_f, lon=lon_f),
            headers={"User-Agent": USER_AGENT},
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return {}

    city = _clean_location_part(payload.get("city") or payload.get("locality") or "")
    region = _clean_location_part(payload.get("principalSubdivision") or "")
    country = _clean_location_part(payload.get("countryName") or "")
    country_code = _clean_location_part(payload.get("countryCode") or "").upper()
    if city or region or country:
        return {
            "city": city,
            "region": region,
            "country": country,
            "country_code": country_code if len(country_code) == 2 else "",
            "source": "device",
        }
    return {}


def _request_value(request, *names: str) -> str:
    data = request.data if isinstance(getattr(request, "data", None), dict) else {}
    for name in names:
        value = data.get(name)
        if value is None:
            value = request.GET.get(name)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _location_from_client(request) -> dict[str, str]:
    """An explicit location from the browser beats every guess."""
    lat = _request_value(request, "lat", "latitude")
    lon = _request_value(request, "lon", "lng", "longitude")
    if lat and lon:
        located = _location_from_coords(lat, lon)
        if located:
            return located

    city = _clean_location_part(_request_value(request, "city"))
    region = _clean_location_part(_request_value(request, "region"))
    country = _clean_location_part(_request_value(request, "country"))
    country_code = _request_value(request, "countryCode", "country_code").upper()
    if city or region or country:
        return {
            "city": city,
            "region": region,
            "country": country,
            "country_code": country_code if len(country_code) == 2 else "",
            "source": "manual",
        }
    return {}


def _display_location(location: dict[str, str]) -> str:
    parts = [
        location.get("city", ""),
        location.get("region", ""),
        location.get("country", ""),
    ]
    seen: set[str] = set()
    out: list[str] = []
    for part in parts:
        key = part.lower()
        if part and key not in seen:
            out.append(part)
            seen.add(key)
    return ", ".join(out) or "your area"


def _newsdata_request(params: dict[str, str]) -> dict[str, Any]:
    url = f"{NEWSDATA_ENDPOINT}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Torensa positive news"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _or_group(terms: tuple[str, ...], budget: int) -> str:
    """Join terms with OR, dropping the tail so the group fits in `budget` chars."""
    group = ""
    for term in terms:
        candidate = f"{group} OR {term}" if group else term
        if len(candidate) > budget:
            break
        group = candidate
    return group


def _positive_query(place: str) -> str:
    """Build a q value within the plan's 100 character limit."""
    place = place.strip()
    if not place:
        return _or_group(POSITIVE_TERMS, MAX_QUERY_LENGTH)
    # "<place> AND (<group>)" -> the group gets what is left of the budget.
    budget = MAX_QUERY_LENGTH - len(place) - len(" AND ()")
    group = _or_group(POSITIVE_TERMS, budget) if budget > 0 else ""
    if not group:
        return place[:MAX_QUERY_LENGTH]
    return f"{place} AND ({group})"


def _looks_negative(text: str) -> bool:
    words = set(re.findall(r"\w+", text.lower()))
    if words & NEGATIVE_TERM_SET:
        return True
    return any(word.startswith(NEGATIVE_STEMS) for word in words)


def _parse_results(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for result in payload.get("results") or []:
        title = (result.get("title") or "").strip()
        link = (result.get("link") or "").strip()
        if not title or not link or link in seen:
            continue
        summary = (result.get("description") or "").strip()
        if _looks_negative(f"{title} {summary}"):
            continue
        seen.add(link)
        items.append(
            {
                "title": title[:180],
                "url": link,
                "summary": summary[:260],
                "published": (result.get("pubDate") or "").strip(),
                "source": (
                    result.get("source_name")
                    or urllib.parse.urlparse(link).netloc.replace("www.", "")
                ).strip(),
            }
        )
    return items


def _parse_published(value: str) -> datetime | None:
    value = (value or "").strip()
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value[:19], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _title_key(title: str) -> str:
    """Syndicated copies share a headline but not a URL."""
    return " ".join(re.findall(r"[a-z0-9]+", (title or "").lower()))


def _merge_pool(
    pooled: list[dict[str, Any]], fresh: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Newest first, deduped by URL, with anything over a week old dropped."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    merged: dict[str, dict[str, Any]] = {}
    for item in list(pooled) + list(fresh):
        url = (item.get("url") or "").strip()
        if not url:
            continue
        published = _parse_published(item.get("published", ""))
        if published is not None and published < cutoff:
            continue
        # Re-check on merge so tightening the filter also cleans the pool.
        if _looks_negative(f"{item.get('title', '')} {item.get('summary', '')}"):
            continue
        merged[url] = item

    oldest = datetime.min.replace(tzinfo=timezone.utc)

    def sort_key(item: dict[str, Any]) -> tuple[int, float]:
        # Nearby stories lead; within a tier, newest first.
        scope = SCOPE_ORDER.get(item.get("scope", "world"), SCOPE_ORDER["world"])
        published = _parse_published(item.get("published", "")) or oldest
        return (scope, -published.timestamp())

    ordered = sorted(merged.values(), key=sort_key)

    deduped: list[dict[str, Any]] = []
    seen_titles: set[str] = set()
    for item in ordered:
        key = _title_key(item.get("title", ""))
        if key and key in seen_titles:
            continue
        seen_titles.add(key)
        deduped.append(item)
    return deduped


def _sentiment_supported() -> bool:
    """Unknown plans get one try; a 403 disables the paid param for a day."""
    return cache.get(SENTIMENT_SUPPORT_CACHE_KEY) is not False


def _newsdata_positive_news(
    api_key: str,
    location: dict[str, str],
    location_name: str,
) -> list[dict[str, Any]]:
    base_params = {
        "apikey": api_key,
        "language": "en",
        "size": str(FETCH_SIZE),
    }
    country_code = (location.get("country_code") or "").lower()
    country = country_code if len(country_code) == 2 and country_code != "xx" else ""

    city = location.get("city", "").strip()
    region = location.get("region", "").strip()

    # Narrowest first. A small town yields only a story or two, so the wider
    # tiers top the page up rather than being skipped.
    attempts: list[tuple[str, dict[str, str]]] = []
    if city:
        attempts.append(("local", {**base_params, "q": _positive_query(city)}))
    if region and region.lower() != city.lower():
        attempts.append(("regional", {**base_params, "q": _positive_query(region)}))
    if country:
        attempts.append(
            ("national", {**base_params, "q": _positive_query(""), "country": country})
        )
    attempts.append(("world", {**base_params, "q": _positive_query("")}))

    # Country narrows the local tiers, but never the world catch-all.
    if country:
        for _scope, attempt in attempts:
            if _scope in ("local", "regional"):
                attempt.setdefault("country", country)

    collected: list[dict[str, Any]] = []
    seen: set[str] = set()
    last_error: urllib.error.HTTPError | None = None
    use_sentiment = _sentiment_supported()

    for scope, attempt in attempts:
        params = dict(attempt)
        if use_sentiment:
            params["sentiment"] = "positive"
        try:
            payload = _newsdata_request(params)
        except urllib.error.HTTPError as exc:
            if exc.code == 403 and use_sentiment:
                # Paid-plan parameter; remember that and retry without it.
                cache.set(SENTIMENT_SUPPORT_CACHE_KEY, False, SENTIMENT_SUPPORT_TTL_SECONDS)
                use_sentiment = False
                try:
                    payload = _newsdata_request(attempt)
                except urllib.error.HTTPError as retry_exc:
                    last_error = retry_exc
                    continue
            else:
                last_error = exc
                continue

        for item in _parse_results(payload):
            keys = (item["url"], _title_key(item["title"]))
            if any(key in seen for key in keys if key):
                continue
            seen.update(key for key in keys if key)
            collected.append({**item, "scope": scope})

        if len(collected) >= MAX_RESULTS:
            break

    if collected:
        return collected
    if last_error is not None:
        raise last_error
    return []


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def positive_news_view(request):
    force_refresh = request.method == "POST" and bool(
        (request.data if isinstance(request.data, dict) else {}).get("refresh")
    )

    # Most trustworthy signal first, cheapest guess last.
    location = _location_from_client(request)
    if not location:
        location = _location_from_headers(request)
    client_ip = _client_ip(request)
    if not location:
        location = _location_from_ip(client_ip)
    if not location:
        # No public client IP and no CDN headers: local dev, so use the
        # server's own public IP rather than giving up on a location.
        location = _location_from_public_ip()

    location_name = _display_location(location)
    cache_slug = (
        re.sub(r"[^a-z0-9]+", "-", location_name.lower()).strip("-")
        or "unknown"
    )
    cache_key = f"positive_news:v1:{cache_slug}"
    pool_key = f"positive_news:pool:v1:{cache_slug}"

    if not force_refresh:
        cached = cache.get(cache_key)
        if cached:
            return Response({**cached, "cached": True}, status=status.HTTP_200_OK)

    newsdata_key = (os.getenv(ENV_NEWSDATA_API_KEY) or "").strip()
    if not newsdata_key:
        return Response(
            {"error": "NEWSDATA_API_KEY is not configured on server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    pooled = cache.get(pool_key) or []
    try:
        fresh = _newsdata_positive_news(newsdata_key, location, location_name)
    except Exception as exc:
        # A week of stories is already on hand; prefer them over an error page.
        if pooled:
            fresh = []
        else:
            return Response(
                {"error": "Could not load positive news right now.", "details": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

    pool = _merge_pool(pooled, fresh)
    cache.set(pool_key, pool, POOL_TTL_SECONDS)
    items = pool[:MAX_RESULTS]

    payload = {
        "location": {
            **location,
            "name": location_name,
            "detected": bool(location),
            "ipDetected": bool(client_ip),
        },
        "items": items,
        "window_days": MAX_AGE_DAYS,
        "pool_size": len(pool),
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }
    cache.set(cache_key, payload, CACHE_TTL_SECONDS)
    return Response({**payload, "cached": False}, status=status.HTTP_200_OK)
