"""
Scam Trend Tracker
==================

Retrieves recent web reports about emerging scam patterns, extracts a structured
record from each source with Claude (Haiku, on Bedrock), then clusters and ranks
them to produce the top 5 trends of the week.

The pipeline is the knowledge contribution: Claude is used only as an extractor.
Clustering (Jaccard on token sets) and ranking (corroboration x diversity x
recency) are deterministic and implemented here.

Pipeline:
  1. Retrieve  -- Tavily Search API across N curated queries (topic=news, days=7)
  2. Extract   -- per-source structured record via Bedrock/Claude
  3. Cluster   -- Jaccard similarity on (pattern_name + payload + channel) tokens
  4. Rank      -- log(1+source_count) * log(1+distinct_source_types) * recency_decay
  5. Return    -- top 5 trends with cited sources
"""

from __future__ import annotations

import json
import math
import os
import re
import time
from datetime import datetime, timezone
from typing import Any

import urllib.parse
import urllib.request

from django.conf import settings
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .tool_chat_static import (
    DEFAULT_AWS_REGION,
    DEFAULT_BEDROCK_MODEL_ID,
    ENV_AWS_REGION,
    ENV_BEDROCK_MODEL_ID,
    BEDROCK_ANTHROPIC_VERSION,
    ERROR_BEDROCK_SDK_MISSING,
    ERROR_CHAT_NOT_CONFIGURED,
    ERROR_ASSISTANT_REQUEST_FAILED,
)


ENV_TAVILY_API_KEY = "TAVILY_API_KEY"
TAVILY_ENDPOINT = "https://api.tavily.com/search"

CACHE_KEY = "scam_trends:v1"
CACHE_TTL_SECONDS = 6 * 60 * 60  # 6 hours

QUERIES = [
    "latest scam reports this week",
    "new phishing scam tactics 2026",
    "emerging text message smishing scam",
    "AI voice clone phone scam victims",
    "investment cryptocurrency scam reported this week",
    "romance scam new pattern victims",
    "fake delivery courier scam UK US",
]

MAX_RESULTS_PER_QUERY = 8
EXTRACT_MAX_TOKENS = 400
TOP_N = 5
CLUSTER_THRESHOLD = 0.45
RECENCY_HALF_LIFE_DAYS = 7.0

# Source-type credibility weights (govt advisories > established news > forum chatter).
SOURCE_TYPE_WEIGHT = {
    "government": 1.5,
    "news": 1.0,
    "blog": 0.7,
    "forum": 0.6,
    "other": 0.5,
}

GOVERNMENT_DOMAINS = (
    "ftc.gov", "consumer.ftc.gov", "actionfraud.police.uk", "ncsc.gov.uk",
    "citizensadvice.org.uk", "fbi.gov", "ic3.gov", "ofcom.org.uk",
    "europa.eu", "europol.europa.eu", "gov.uk", "usa.gov", "cisa.gov",
)
NEWS_DOMAINS = (
    "bbc.", "reuters.", "apnews.", "theguardian.", "nytimes.", "washingtonpost.",
    "cnn.", "cnbc.", "forbes.", "wired.", "ft.com", "which.co.uk", "moneysavingexpert.",
)
FORUM_DOMAINS = ("reddit.com", "quora.com", "stackexchange.com", "discord.")

EXTRACT_SYSTEM = """You are an information-extraction engine. Given a short web article snippet
about a scam, return ONE JSON object describing the scam pattern. Return ONLY the JSON,
no preamble, no markdown.

Schema (all fields required, use empty string if unknown):
{
  "pattern_name": "<short label, 3-7 words, sentence case>",
  "channel": "<one of: sms | email | phone | social | web | in_person | unknown>",
  "lure": "<one short sentence: how victims are first contacted / hooked>",
  "payload": "<one short sentence: what the scammer ultimately wants (money, credentials, access, etc.)>",
  "victim_profile": "<one short phrase: who is targeted, e.g. 'elderly mobile users', 'small business owners'>",
  "is_scam_pattern": <true if the snippet describes a real scam pattern, false if it is a general article/opinion>
}

If the snippet does not describe a concrete scam pattern (e.g. it is a general opinion piece,
unrelated news, or duplicate boilerplate), set is_scam_pattern to false and leave other fields
as empty strings.
"""


# ---------------------------------------------------------------------------
# Step 1: Retrieve (Tavily)
# ---------------------------------------------------------------------------

def _tavily_search(api_key: str, query: str, days: int = 7) -> list[dict]:
    body = json.dumps({
        "api_key": api_key,
        "query": query,
        "topic": "news",
        "search_depth": "basic",
        "max_results": MAX_RESULTS_PER_QUERY,
        "days": days,
        "include_answer": False,
        "include_raw_content": False,
    }).encode("utf-8")
    req = urllib.request.Request(
        TAVILY_ENDPOINT,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return payload.get("results") or []


def _classify_source(url: str) -> str:
    try:
        host = urllib.parse.urlparse(url).netloc.lower()
    except Exception:
        return "other"
    if any(d in host for d in GOVERNMENT_DOMAINS):
        return "government"
    if any(d in host for d in NEWS_DOMAINS):
        return "news"
    if any(d in host for d in FORUM_DOMAINS):
        return "forum"
    return "blog"


# ---------------------------------------------------------------------------
# Step 2: Extract (Bedrock / Claude Haiku)
# ---------------------------------------------------------------------------

def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n", "", text)
        if text.endswith("```"):
            text = text[: -3]
    return text.strip()


def _bedrock_extract(bedrock, model_id: str, title: str, snippet: str) -> dict | None:
    user_prompt = (
        "Extract the scam pattern from the following web snippet. Return ONLY the JSON object.\n\n"
        f"TITLE: {title}\n\nSNIPPET:\n\"\"\"\n{snippet}\n\"\"\""
    )
    body = json.dumps({
        "anthropic_version": BEDROCK_ANTHROPIC_VERSION,
        "max_tokens": EXTRACT_MAX_TOKENS,
        "system": EXTRACT_SYSTEM,
        "messages": [{"role": "user", "content": user_prompt}],
    })
    try:
        resp = bedrock.invoke_model(modelId=model_id, body=body)
        result = json.loads(resp["body"].read())
        raw = (result.get("content", [{}])[0].get("text", "") or "").strip()
        raw = _strip_code_fence(raw)
        if not raw:
            return None
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            m = re.search(r"\{[\s\S]*\}", raw)
            if not m:
                return None
            parsed = json.loads(m.group(0))
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Step 3: Cluster (Jaccard similarity on token sets)
# ---------------------------------------------------------------------------

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_STOPWORDS = {
    "a", "an", "and", "the", "to", "of", "for", "in", "on", "with", "by", "is",
    "are", "was", "were", "be", "been", "being", "or", "as", "at", "from", "that",
    "this", "it", "its", "their", "they", "them", "you", "your", "scam", "scams",
    "fraud", "fraudulent", "new", "report", "reports", "reported", "victims",
    "victim", "people", "users", "user",
}


def _tokenize(text: str) -> set[str]:
    return {t for t in _TOKEN_RE.findall((text or "").lower()) if t not in _STOPWORDS and len(t) > 2}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def _cluster(records: list[dict]) -> list[list[dict]]:
    clusters: list[dict] = []  # each: {"tokens": set, "items": [record]}
    for rec in records:
        sig = " ".join([rec.get("pattern_name", ""), rec.get("payload", ""), rec.get("channel", ""), rec.get("lure", "")])
        tokens = _tokenize(sig)
        if not tokens:
            continue
        placed = False
        for c in clusters:
            if _jaccard(tokens, c["tokens"]) >= CLUSTER_THRESHOLD:
                c["items"].append(rec)
                c["tokens"] = c["tokens"] | tokens
                placed = True
                break
        if not placed:
            clusters.append({"tokens": tokens, "items": [rec]})
    return [c["items"] for c in clusters]


# ---------------------------------------------------------------------------
# Step 4: Rank
# ---------------------------------------------------------------------------

def _parse_date(s: str) -> datetime | None:
    if not s:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d", "%a, %d %b %Y %H:%M:%S %Z", "%a, %d %b %Y %H:%M:%S GMT"):
        try:
            dt = datetime.strptime(s, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def _recency_factor(newest: datetime | None, now: datetime) -> float:
    if not newest:
        return 0.5
    age_days = max(0.0, (now - newest).total_seconds() / 86400.0)
    return math.exp(-math.log(2) * age_days / RECENCY_HALF_LIFE_DAYS)


def _score_cluster(items: list[dict], now: datetime) -> tuple[float, dict]:
    source_count = len(items)
    source_types = {it.get("source_type", "other") for it in items}
    diversity_weight = sum(SOURCE_TYPE_WEIGHT.get(t, 0.5) for t in source_types)

    dates = [_parse_date(it.get("published") or "") for it in items]
    dates = [d for d in dates if d is not None]
    newest = max(dates) if dates else None
    recency = _recency_factor(newest, now)

    score = math.log(1 + source_count) * math.log(1 + diversity_weight) * (0.2 + recency)
    breakdown = {
        "source_count": source_count,
        "distinct_source_types": sorted(source_types),
        "diversity_weight": round(diversity_weight, 3),
        "recency_factor": round(recency, 3),
        "newest_published": newest.isoformat() if newest else None,
    }
    return score, breakdown


def _summarize_cluster(items: list[dict]) -> dict:
    # Choose the canonical pattern record: prefer government source, then most-recent.
    def rank_key(it: dict):
        type_rank = {"government": 0, "news": 1, "blog": 2, "forum": 3, "other": 4}.get(it.get("source_type", "other"), 4)
        d = _parse_date(it.get("published") or "") or datetime(1970, 1, 1, tzinfo=timezone.utc)
        return (type_rank, -d.timestamp())

    canonical = sorted(items, key=rank_key)[0]
    return {
        "pattern_name": canonical.get("pattern_name") or "Unnamed scam pattern",
        "channel": canonical.get("channel") or "unknown",
        "lure": canonical.get("lure") or "",
        "payload": canonical.get("payload") or "",
        "victim_profile": canonical.get("victim_profile") or "",
    }


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def _build_trends(tavily_key: str, region: str, model_id: str) -> dict:
    # ---- retrieve ----
    seen_urls: set[str] = set()
    raw_sources: list[dict] = []
    for q in QUERIES:
        try:
            results = _tavily_search(tavily_key, q)
        except Exception:
            continue
        for r in results:
            url = (r.get("url") or "").strip()
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            raw_sources.append({
                "title": (r.get("title") or "").strip(),
                "url": url,
                "content": (r.get("content") or "").strip(),
                "published": (r.get("published_date") or "").strip(),
                "source_type": _classify_source(url),
                "query": q,
            })

    if not raw_sources:
        return {"trends": [], "sources_considered": 0, "last_updated": datetime.now(timezone.utc).isoformat()}

    # ---- extract ----
    import boto3  # imported here so cache-hit path doesn't need it
    bedrock = boto3.client("bedrock-runtime", region_name=region)

    records: list[dict] = []
    for src in raw_sources:
        snippet = src["content"][:1500]
        if len(snippet) < 60:
            continue
        extracted = _bedrock_extract(bedrock, model_id, src["title"], snippet)
        if not extracted or not extracted.get("is_scam_pattern"):
            continue
        records.append({
            "pattern_name": str(extracted.get("pattern_name") or "").strip(),
            "channel": str(extracted.get("channel") or "unknown").strip().lower(),
            "lure": str(extracted.get("lure") or "").strip(),
            "payload": str(extracted.get("payload") or "").strip(),
            "victim_profile": str(extracted.get("victim_profile") or "").strip(),
            "title": src["title"],
            "url": src["url"],
            "published": src["published"],
            "source_type": src["source_type"],
        })

    if not records:
        return {
            "trends": [],
            "sources_considered": len(raw_sources),
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }

    # ---- cluster ----
    clusters = _cluster(records)

    # ---- rank ----
    now = datetime.now(timezone.utc)
    scored: list[tuple[float, list[dict], dict]] = []
    for items in clusters:
        score, breakdown = _score_cluster(items, now)
        scored.append((score, items, breakdown))
    scored.sort(key=lambda x: x[0], reverse=True)

    top = scored[:TOP_N]
    trends_out = []
    for rank, (score, items, breakdown) in enumerate(top, start=1):
        summary = _summarize_cluster(items)
        sources = [
            {
                "title": it["title"],
                "url": it["url"],
                "published": it["published"],
                "source_type": it["source_type"],
            }
            for it in items
        ]
        trends_out.append({
            "rank": rank,
            "score": round(score, 3),
            "pattern_name": summary["pattern_name"],
            "channel": summary["channel"],
            "lure": summary["lure"],
            "payload": summary["payload"],
            "victim_profile": summary["victim_profile"],
            "sources": sources,
            "scoring_breakdown": breakdown,
        })

    return {
        "trends": trends_out,
        "sources_considered": len(raw_sources),
        "records_extracted": len(records),
        "clusters_found": len(clusters),
        "last_updated": now.isoformat(),
        "method": {
            "retrieve": f"Tavily news search across {len(QUERIES)} queries, last 7 days",
            "extract": f"Bedrock Claude ({model_id}) structured extraction",
            "cluster": f"Jaccard similarity on token sets, threshold {CLUSTER_THRESHOLD}",
            "rank": "log(1 + source_count) * log(1 + diversity_weight) * (0.2 + recency_factor)",
        },
    }


@api_view(["POST", "GET"])
@permission_classes([AllowAny])
def scam_trends_view(request):
    force_refresh = False
    if request.method == "POST":
        payload = request.data if isinstance(request.data, dict) else {}
        force_refresh = bool(payload.get("refresh"))

    if not force_refresh:
        cached = cache.get(CACHE_KEY)
        if cached:
            return Response({**cached, "cached": True}, status=status.HTTP_200_OK)

    tavily_key = (os.getenv(ENV_TAVILY_API_KEY) or "").strip()
    if not tavily_key:
        return Response(
            {"error": "TAVILY_API_KEY is not configured on server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    region = os.getenv(ENV_AWS_REGION, DEFAULT_AWS_REGION).strip() or DEFAULT_AWS_REGION
    model_id = os.getenv(ENV_BEDROCK_MODEL_ID, DEFAULT_BEDROCK_MODEL_ID).strip() or DEFAULT_BEDROCK_MODEL_ID

    try:
        import boto3  # noqa: F401
    except Exception:
        return Response(
            {"error": ERROR_BEDROCK_SDK_MISSING},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        started = time.time()
        result = _build_trends(tavily_key, region, model_id)
        result["elapsed_seconds"] = round(time.time() - started, 2)
    except Exception as exc:
        error_msg = str(exc)
        if "Could not connect to the endpoint URL" in error_msg or "UnrecognizedClientException" in error_msg:
            payload = {"error": ERROR_CHAT_NOT_CONFIGURED}
        else:
            payload = {"error": ERROR_ASSISTANT_REQUEST_FAILED}
        if settings.DEBUG:
            payload["details"] = error_msg
            payload["exceptionType"] = exc.__class__.__name__
        return Response(payload, status=status.HTTP_502_BAD_GATEWAY)

    cache.set(CACHE_KEY, result, CACHE_TTL_SECONDS)
    return Response({**result, "cached": False}, status=status.HTTP_200_OK)
