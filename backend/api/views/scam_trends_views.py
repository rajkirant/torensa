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
from concurrent.futures import ThreadPoolExecutor
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

# Override which Bedrock model the scam-trend pipeline uses for the LLM steps.
# Must be an inference profile id available in the deployment region. Sonnet 4.5 by default for accuracy;
# override to a Haiku profile for lower cost / faster runs.
ENV_SCAM_TRENDS_MODEL_ID = "SCAM_TRENDS_MODEL_ID"
DEFAULT_SCAM_TRENDS_MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"

CACHE_KEY = "scam_trends:v6"
CACHE_TTL_SECONDS = 6 * 60 * 60  # 6 hours

QUERIES = [
    "latest scam reports this week phishing smishing",
    "AI voice clone deepfake phone scam victims",
    "investment cryptocurrency scam this week",
    "romance scam new pattern victims report",
    "delivery courier impersonation scam consumer warning",
    "bank impersonation refund scam customers",
    "action fraud FTC scam advisory this week",
]

MAX_RESULTS_PER_QUERY = 5
MAX_SOURCES_TO_EXTRACT = 10  # single parallel batch of Sonnet calls -- keeps cold runtime ~15s
TAVILY_PARALLELISM = 7
EXTRACT_PARALLELISM = 10
EXTRACT_MAX_TOKENS = 220    # extracted JSON is ~150 tokens; trim output for Sonnet latency
CONSOLIDATE_MAX_TOKENS = 1500
VALIDATE_MAX_TOKENS = 800
TOP_N = 5
RERANK_CANDIDATES = 10        # top-N candidates re-validated by LLM
MIN_CLUSTER_SIZE = 2          # require >=2 sources for a real "trend"
CLUSTER_THRESHOLD = 0.30      # looser merging
RECENCY_HALF_LIFE_DAYS = 5.0  # freshness penalty is steeper

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

Schema (all fields required, use empty string / 0 if unknown):
{
  "pattern_name": "<short generic label of the pattern itself, 3-6 words, sentence case. Use the GENERIC name, not the specific case (good: 'Parcel delivery impersonation scam'. bad: 'FedEx scam targeting Indian comedian')>",
  "channel": "<one of: sms | email | phone | social | web | in_person | unknown>",
  "lure": "<one short sentence: how victims are first contacted / hooked>",
  "payload": "<one short sentence: what the scammer ultimately wants (money, credentials, access, etc.)>",
  "victim_profile": "<one short phrase: who is targeted, e.g. 'elderly mobile users', 'small business owners'>",
  "severity": <integer 0-100: how serious / financially damaging. 0=minor annoyance, 50=typical scam, 80=organized fraud with large losses, 100=widespread campaign with major losses>,
  "is_scam_pattern": <true ONLY if the snippet describes a concrete scam pattern with a clear lure and payload. false if it is a general opinion piece, an unrelated story, a list-style 'top scams of 2025' digest, or just boilerplate>
}

CRITICAL: pattern_name must describe the *type* of scam, not the *specific incident*. Two articles about
different victims of the same scam pattern must produce the same pattern_name so they can cluster.
Examples of GOOD pattern_names: 'Parcel delivery impersonation scam', 'Bank refund phone scam',
'AI voice clone family emergency scam', 'Crypto investment pig butchering scam'.
"""


CONSOLIDATE_SYSTEM = """You are a scam-pattern taxonomy expert. You are given a list of scam descriptions,
each from a different web article. Multiple descriptions may describe the same underlying scam pattern
(e.g. two articles about different victims of the same bank-impersonation scam).

Group them into canonical patterns. Return ONLY a JSON object with this exact shape:

{
  "groups": [
    {
      "canonical_name": "<3-6 word generic pattern name, sentence case>",
      "canonical_channel": "<sms | email | phone | social | web | in_person | unknown>",
      "indices": [<list of integer indices from the input list that belong to this group>]
    }
  ]
}

Rules:
- Every index from the input MUST appear in exactly one group.
- A group can have just one index if the pattern is truly unique.
- Use the most generic, repeatable canonical_name (good: 'Parcel delivery impersonation scam'.
  bad: 'FedEx scam targeting comedian').
- If two descriptions share the same scam mechanic (same channel, same lure, same payload type),
  group them even if the wording differs.

Return ONLY the JSON object, no preamble, no markdown."""


VALIDATE_SYSTEM = """You are a scam-trend curator. You are given a list of candidate scam trends,
each with a pattern description and the headlines of the source articles supporting it. Decide which
candidates are genuinely *emerging trends this week* and which are not.

A candidate IS a trend if:
- The supporting articles are about an active, currently-spreading scam pattern.
- Multiple sources or recent activity make it newsworthy this week.

A candidate is NOT a trend if:
- It is a retrospective / "top scams of the year" digest.
- It is a single old incident being re-reported without new activity.
- The articles are commentary, opinion, or general fraud-awareness without a specific pattern.
- The "pattern" is too vague to act on (e.g. just 'online scam', 'financial fraud').

Return ONLY a JSON object with this exact shape:

{
  "verdicts": [
    {
      "id": <integer id from the input>,
      "is_trend": <true | false>,
      "confidence": <integer 0-100>,
      "reason": "<one short sentence>"
    }
  ]
}

Return ONLY the JSON, no preamble, no markdown."""


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


import logging
logger = logging.getLogger(__name__)


def _bedrock_call(bedrock, model_id: str, system_prompt: str, user_prompt: str, max_tokens: int) -> dict | None:
    """Generic single-shot Bedrock invoke returning the parsed JSON object, or None on any failure.
    Logs the underlying exception so model-access issues surface in CloudWatch."""
    body = json.dumps({
        "anthropic_version": BEDROCK_ANTHROPIC_VERSION,
        "max_tokens": max_tokens,
        "system": system_prompt,
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
    except Exception as exc:
        logger.warning("scam_trends.bedrock_call_failed model_id=%s error=%s", model_id, exc)
        return None


def _bedrock_extract(bedrock, model_id: str, title: str, snippet: str) -> dict | None:
    user_prompt = (
        "Extract the scam pattern from the following web snippet. Return ONLY the JSON object.\n\n"
        f"TITLE: {title}\n\nSNIPPET:\n\"\"\"\n{snippet}\n\"\"\""
    )
    return _bedrock_call(bedrock, model_id, EXTRACT_SYSTEM, user_prompt, EXTRACT_MAX_TOKENS)


def _bedrock_consolidate(bedrock, model_id: str, records: list[dict]) -> list[dict] | None:
    """Returns a list of {indices, canonical_name, canonical_channel}, or None on failure."""
    if not records:
        return None
    lines: list[str] = []
    for i, rec in enumerate(records):
        lines.append(
            f"{i}. [{rec.get('channel', 'unknown')}] {rec.get('pattern_name', '')} "
            f"- lure: {rec.get('lure', '')} - payload: {rec.get('payload', '')}"
        )
    user_prompt = "Scam descriptions to group:\n\n" + "\n".join(lines)
    parsed = _bedrock_call(bedrock, model_id, CONSOLIDATE_SYSTEM, user_prompt, CONSOLIDATE_MAX_TOKENS)
    if not parsed:
        return None
    groups_raw = parsed.get("groups")
    if not isinstance(groups_raw, list):
        return None
    out: list[dict] = []
    seen: set[int] = set()
    for g in groups_raw:
        if not isinstance(g, dict):
            continue
        idxs_raw = g.get("indices")
        if not isinstance(idxs_raw, list):
            continue
        idxs: list[int] = []
        for x in idxs_raw:
            try:
                i = int(x)
            except (TypeError, ValueError):
                continue
            if 0 <= i < len(records) and i not in seen:
                idxs.append(i)
                seen.add(i)
        if idxs:
            out.append({
                "indices": idxs,
                "canonical_name": str(g.get("canonical_name") or "").strip(),
                "canonical_channel": str(g.get("canonical_channel") or "").strip().lower(),
            })
    # Place any indices the model dropped into their own singleton groups so nothing is lost.
    for i in range(len(records)):
        if i not in seen:
            out.append({"indices": [i], "canonical_name": "", "canonical_channel": ""})
    return out


def _bedrock_validate_trends(bedrock, model_id: str, candidates: list[dict]) -> dict[int, dict] | None:
    """Given candidate trends (each with id, pattern_name, channel, lure, payload, sample_titles),
    returns id -> {is_trend, confidence, reason}, or None on failure (caller skips validation)."""
    if not candidates:
        return None
    lines: list[str] = []
    for c in candidates:
        titles = "; ".join((c.get("sample_titles") or [])[:3])
        lines.append(
            f"id={c['id']}: [{c.get('channel', 'unknown')}] {c.get('pattern_name', '')} "
            f"- lure: {c.get('lure', '')} - payload: {c.get('payload', '')} - sample headlines: {titles}"
        )
    user_prompt = "Candidate trends to validate:\n\n" + "\n".join(lines)
    parsed = _bedrock_call(bedrock, model_id, VALIDATE_SYSTEM, user_prompt, VALIDATE_MAX_TOKENS)
    if not parsed:
        return None
    verdicts_raw = parsed.get("verdicts")
    if not isinstance(verdicts_raw, list):
        return None
    out: dict[int, dict] = {}
    for v in verdicts_raw:
        if not isinstance(v, dict):
            continue
        try:
            vid = int(v.get("id"))
        except (TypeError, ValueError):
            continue
        out[vid] = {
            "is_trend": bool(v.get("is_trend")),
            "confidence": max(0, min(100, int(v.get("confidence") or 0))) if str(v.get("confidence", "")).isdigit() or isinstance(v.get("confidence"), (int, float)) else 0,
            "reason": str(v.get("reason") or "").strip()[:200],
        }
    return out


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


def _cluster_signature(rec: dict) -> set[str]:
    """Build a weighted token set: tokens from high-signal fields (channel, payload, pattern_name)
    appear multiple times (with a positional suffix) so they dominate Jaccard similarity over
    incidental words from the lure."""
    parts: list[str] = []
    name = rec.get("pattern_name", "")
    payload = rec.get("payload", "")
    channel = rec.get("channel", "")
    lure = rec.get("lure", "")
    # weight by repetition (each repeat suffixed to keep tokens distinct from other fields)
    parts.append(f"{name} {name} {name}")           # pattern_name x3
    parts.append(f"{payload} {payload}")             # payload x2
    parts.append(f"channel_{channel}")               # channel as a single distinguishing token
    parts.append(lure)
    return _tokenize(" ".join(parts))


def _cluster(records: list[dict]) -> list[list[dict]]:
    clusters: list[dict] = []  # each: {"tokens": set, "channel": str, "items": [record]}
    for rec in records:
        tokens = _cluster_signature(rec)
        if not tokens:
            continue
        rec_channel = rec.get("channel", "")
        placed = False
        best_idx = -1
        best_sim = 0.0
        for i, c in enumerate(clusters):
            # Don't merge across channels (except 'unknown' which matches anything)
            if rec_channel and c["channel"] and rec_channel != "unknown" and c["channel"] != "unknown" and rec_channel != c["channel"]:
                continue
            sim = _jaccard(tokens, c["tokens"])
            if sim > best_sim:
                best_sim = sim
                best_idx = i
        if best_idx >= 0 and best_sim >= CLUSTER_THRESHOLD:
            c = clusters[best_idx]
            c["items"].append(rec)
            c["tokens"] = c["tokens"] | tokens
            if c["channel"] == "unknown" and rec_channel and rec_channel != "unknown":
                c["channel"] = rec_channel
            placed = True
        if not placed:
            clusters.append({"tokens": tokens, "channel": rec_channel or "unknown", "items": [rec]})
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

    severities = [int(it.get("severity") or 0) for it in items]
    avg_severity = (sum(severities) / len(severities) / 100.0) if severities else 0.5
    severity_factor = 0.5 + avg_severity  # range [0.5, 1.5]

    score = math.log(1 + source_count) * math.log(1 + diversity_weight) * (0.2 + recency) * severity_factor
    breakdown = {
        "source_count": source_count,
        "distinct_source_types": sorted(source_types),
        "diversity_weight": round(diversity_weight, 3),
        "recency_factor": round(recency, 3),
        "severity_factor": round(severity_factor, 3),
        "avg_severity": round(avg_severity * 100, 1),
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
    # ---- retrieve (parallel Tavily calls) ----
    def _fetch_one(q: str) -> tuple[str, list[dict]]:
        try:
            return q, _tavily_search(tavily_key, q)
        except Exception:
            return q, []

    seen_urls: set[str] = set()
    raw_sources: list[dict] = []
    with ThreadPoolExecutor(max_workers=min(TAVILY_PARALLELISM, len(QUERIES))) as ex:
        for q, results in ex.map(_fetch_one, QUERIES):
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

    # Cap how many sources we extract (cost + latency guard).
    # Prefer government -> news -> blog -> forum so we don't waste budget on low-quality ones.
    type_rank = {"government": 0, "news": 1, "blog": 2, "forum": 3, "other": 4}
    raw_sources.sort(key=lambda s: type_rank.get(s["source_type"], 4))
    sources_to_extract = [s for s in raw_sources if len(s["content"]) >= 60][:MAX_SOURCES_TO_EXTRACT]

    # ---- extract (parallel Bedrock calls) ----
    import boto3  # imported here so cache-hit path doesn't need it
    bedrock = boto3.client("bedrock-runtime", region_name=region)

    def _extract_one(src: dict) -> dict | None:
        snippet = src["content"][:1500]
        extracted = _bedrock_extract(bedrock, model_id, src["title"], snippet)
        if not extracted or not extracted.get("is_scam_pattern"):
            return None
        try:
            sev = int(extracted.get("severity") or 0)
        except (TypeError, ValueError):
            sev = 0
        sev = max(0, min(100, sev))
        return {
            "pattern_name": str(extracted.get("pattern_name") or "").strip(),
            "channel": str(extracted.get("channel") or "unknown").strip().lower(),
            "lure": str(extracted.get("lure") or "").strip(),
            "payload": str(extracted.get("payload") or "").strip(),
            "victim_profile": str(extracted.get("victim_profile") or "").strip(),
            "severity": sev,
            "title": src["title"],
            "url": src["url"],
            "published": src["published"],
            "source_type": src["source_type"],
        }

    records: list[dict] = []
    with ThreadPoolExecutor(max_workers=min(EXTRACT_PARALLELISM, len(sources_to_extract) or 1)) as ex:
        for rec in ex.map(_extract_one, sources_to_extract):
            if rec is not None:
                records.append(rec)

    if not records:
        # All extraction attempts failed -- almost always a Bedrock model access / id issue.
        logger.error(
            "scam_trends.extraction_total_failure model_id=%s sources_considered=%s sources_attempted=%s",
            model_id, len(raw_sources), len(sources_to_extract),
        )
        return {
            "trends": [],
            "sources_considered": len(raw_sources),
            "records_extracted": 0,
            "clusters_found": 0,
            "extraction_error": (
                "All AI extraction calls failed. Most likely the Bedrock model is not accessible "
                "in this region/account. Check CloudWatch for the underlying exception."
            ),
            "model_id_used": model_id,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }

    # ---- cluster (stage 1: deterministic Jaccard) ----
    clusters = _cluster(records)

    # ---- cluster (stage 2: LLM consolidation) ----
    # If we have enough records, ask the model to merge clusters that describe the same pattern.
    consolidation_applied = False
    if len(records) >= 4:
        groups = _bedrock_consolidate(bedrock, model_id, records)
        if groups:
            new_clusters: list[list[dict]] = []
            for g in groups:
                items = [dict(records[i]) for i in g["indices"]]
                if g["canonical_name"]:
                    for it in items:
                        it["pattern_name"] = g["canonical_name"]
                if g["canonical_channel"] and g["canonical_channel"] != "unknown":
                    for it in items:
                        if not it.get("channel") or it["channel"] == "unknown":
                            it["channel"] = g["canonical_channel"]
                new_clusters.append(items)
            clusters = new_clusters
            consolidation_applied = True

    # ---- rank ----
    now = datetime.now(timezone.utc)
    scored: list[tuple[float, list[dict], dict]] = []
    for items in clusters:
        score, breakdown = _score_cluster(items, now)
        scored.append((score, items, breakdown))
    scored.sort(key=lambda x: x[0], reverse=True)

    # Prefer multi-source clusters (real "trends"); fall back to single-source ones
    # only if we don't have enough multi-source clusters to fill TOP_N.
    multi = [s for s in scored if len(s[1]) >= MIN_CLUSTER_SIZE]
    single = [s for s in scored if len(s[1]) < MIN_CLUSTER_SIZE]
    pre_validate = (multi + single)[:RERANK_CANDIDATES] if len(multi) < TOP_N else multi[:RERANK_CANDIDATES]

    # ---- LLM validation: filter out non-trends from the top candidates ----
    validation_applied = False
    if len(pre_validate) > 0:
        candidates_for_validation: list[dict] = []
        for idx, (score, items, breakdown) in enumerate(pre_validate):
            canonical = sorted(items, key=lambda it: (
                {"government": 0, "news": 1, "blog": 2, "forum": 3, "other": 4}.get(it.get("source_type", "other"), 4),
                -(_parse_date(it.get("published") or "") or datetime(1970, 1, 1, tzinfo=timezone.utc)).timestamp(),
            ))[0]
            candidates_for_validation.append({
                "id": idx,
                "pattern_name": canonical.get("pattern_name", ""),
                "channel": canonical.get("channel", ""),
                "lure": canonical.get("lure", ""),
                "payload": canonical.get("payload", ""),
                "sample_titles": [it.get("title", "") for it in items[:3]],
            })
        verdicts = _bedrock_validate_trends(bedrock, model_id, candidates_for_validation)
        if verdicts:
            validation_applied = True
            kept: list[tuple[float, list[dict], dict]] = []
            dropped: list[tuple[float, list[dict], dict]] = []
            for idx, scored_item in enumerate(pre_validate):
                v = verdicts.get(idx)
                if v and v.get("is_trend") and v.get("confidence", 0) >= 40:
                    # Stash validator reason into breakdown for transparency
                    scored_item[2]["validator_reason"] = v.get("reason", "")
                    scored_item[2]["validator_confidence"] = v.get("confidence", 0)
                    kept.append(scored_item)
                else:
                    scored_item[2]["validator_reason"] = (v or {}).get("reason", "")
                    scored_item[2]["validator_confidence"] = (v or {}).get("confidence", 0)
                    dropped.append(scored_item)
            # If validator was too strict and we don't have enough trends, top up from dropped (best-scoring first)
            top = kept[:TOP_N] if len(kept) >= TOP_N else (kept + dropped)[:TOP_N]
        else:
            top = pre_validate[:TOP_N]
    else:
        top = []
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
        avg_sev = round(sum(int(it.get("severity") or 0) for it in items) / max(1, len(items)), 1)
        trends_out.append({
            "rank": rank,
            "score": round(score, 3),
            "pattern_name": summary["pattern_name"],
            "channel": summary["channel"],
            "lure": summary["lure"],
            "payload": summary["payload"],
            "victim_profile": summary["victim_profile"],
            "severity": avg_sev,
            "sources": sources,
            "scoring_breakdown": breakdown,
        })

    return {
        "trends": trends_out,
        "sources_considered": len(raw_sources),
        "records_extracted": len(records),
        "clusters_found": len(clusters),
        "consolidation_applied": consolidation_applied,
        "validation_applied": validation_applied,
        "model_id_used": model_id,
        "last_updated": now.isoformat(),
        "method": {
            "retrieve": f"Tavily news search across {len(QUERIES)} queries, last 7 days, up to {MAX_RESULTS_PER_QUERY} results each",
            "extract": f"Bedrock Claude ({model_id}) per-source structured extraction (parallel, severity-aware)",
            "cluster_stage1": f"Weighted Jaccard on (pattern_name x3 + payload x2 + channel) tokens, threshold {CLUSTER_THRESHOLD}; channels do not cross-merge",
            "cluster_stage2": "LLM consolidation: Claude regroups Jaccard clusters by underlying pattern (one extra call total)",
            "rank": "log(1 + source_count) * log(1 + diversity_weight) * (0.2 + recency_factor) * (0.5 + avg_severity)",
            "validate": f"Top {RERANK_CANDIDATES} candidates re-scored by Claude as 'genuine emerging trend?'; non-trends dropped (with backfill if <{TOP_N} remain)",
            "filter": f"Multi-source clusters (>={MIN_CLUSTER_SIZE} sources) preferred for top {TOP_N}; falls back to single-source clusters only if needed",
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
    # Use a dedicated (typically Sonnet) model for the trend pipeline; falls back to the default chat model.
    model_id = (
        os.getenv(ENV_SCAM_TRENDS_MODEL_ID, "").strip()
        or os.getenv(ENV_BEDROCK_MODEL_ID, "").strip()
        or DEFAULT_SCAM_TRENDS_MODEL_ID
    )

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
