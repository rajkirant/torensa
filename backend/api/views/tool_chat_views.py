import json
import os
from pathlib import Path

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .tool_chat_static import (
    ALL_TOOLS_QUERY_PHRASE,
    AUTH_NOT_REQUIRED_TEXT,
    AUTH_REQUIRED_TEXT,
    BACKEND_METADATA_PATH_PARTS,
    CATEGORIES_FILENAME,
    DEFAULT_OPENAI_MODEL,
    ENV_OPENAI_API_KEY,
    ENV_OPENAI_MODEL,
    ENV_TOOL_METADATA_DIR,
    ERROR_ASSISTANT_REQUEST_FAILED,
    ERROR_CHAT_NOT_CONFIGURED,
    ERROR_MESSAGE_REQUIRED,
    ERROR_OPENAI_SDK_MISSING,
    ERROR_TOOL_METADATA_UNAVAILABLE,
    FALLBACK_NO_TOOL,
    FALLBACK_ANSWER_TEMPLATE,
    FRONTEND_METADATA_PATH_PARTS,
    HISTORY_ITEM_TEMPLATE,
    HISTORY_ROLE_ASSISTANT,
    HISTORY_ROLE_USER,
    LIST_INTENT_TOKENS,
    MAX_HISTORY_CHARS,
    MAX_HISTORY_ITEMS,
    METADATA_NOT_FOUND_PREFIX,
    MULTI_TOOL_QUERY_PHRASES,
    NO_TEXT,
    NO_HISTORY_TEXT,
    NONE_TOOL_ID_TEXT,
    OFFLINE_DISABLED_TEXT,
    OFFLINE_ENABLED_TEXT,
    OFFLINE_QUERY_PHRASES,
    OPENAI_ROLE_SYSTEM,
    OPENAI_ROLE_USER,
    ROOT_METADATA_PATH_PARTS,
    QUERY_STOP_TOKENS,
    SERVICE_CARDS_FILENAME,
    SYSTEM_PROMPT,
    THIS_TOOL_TITLE,
    TOOL_WORD_RE,
    TOOL_CONTEXT_TEMPLATE,
    TOOL_TOKEN,
    TOOLS_TOKEN,
    UNKNOWN_CATEGORY_LABEL,
    UNKNOWN_TOOL_TITLE,
    USER_PROMPT_TEMPLATE,
    YES_TEXT,
)


def _metadata_paths():
    current = Path(__file__).resolve()

    candidates = []

    # Optional explicit override for Lambda/container deployments.
    metadata_dir = (os.getenv(ENV_TOOL_METADATA_DIR) or "").strip()
    if metadata_dir:
        base = Path(metadata_dir)
        candidates.append(
            (
                base / SERVICE_CARDS_FILENAME,
                base / CATEGORIES_FILENAME,
            )
        )

    # Backend-owned metadata (works well for Lambda package layout).
    for parent in current.parents:
        candidates.append(
            (
                parent.joinpath(*BACKEND_METADATA_PATH_PARTS, SERVICE_CARDS_FILENAME),
                parent.joinpath(*BACKEND_METADATA_PATH_PARTS, CATEGORIES_FILENAME),
            )
        )
    for parent in current.parents:
        candidates.append(
            (
                parent.joinpath(*ROOT_METADATA_PATH_PARTS, SERVICE_CARDS_FILENAME),
                parent.joinpath(*ROOT_METADATA_PATH_PARTS, CATEGORIES_FILENAME),
            )
        )

    # Local repo frontend metadata fallback.
    for parent in current.parents:
        candidates.append(
            (
                parent.joinpath(*FRONTEND_METADATA_PATH_PARTS, SERVICE_CARDS_FILENAME),
                parent.joinpath(*FRONTEND_METADATA_PATH_PARTS, CATEGORIES_FILENAME),
            )
        )

    seen = set()
    for service_cards, categories in candidates:
        key = (str(service_cards), str(categories))
        if key in seen:
            continue
        seen.add(key)
        if service_cards.exists() and categories.exists():
            return service_cards, categories

    searched = "\n".join(f"- {pair[0]} | {pair[1]}" for pair in candidates[:12])
    raise FileNotFoundError(f"{METADATA_NOT_FOUND_PREFIX}{searched}")


def _load_tool_metadata():
    service_cards_path, categories_path = _metadata_paths()
    with service_cards_path.open("r", encoding="utf-8") as file:
        raw_cards = json.load(file)
        cards = [
            card
            for card in raw_cards
            if isinstance(card, dict) and card.get("isActive", True) is not False
        ]
    with categories_path.open("r", encoding="utf-8") as file:
        categories = json.load(file)

    category_map = {
        (item.get("id") or "").strip().lower(): (item.get("label") or "").strip()
        for item in categories
        if isinstance(item, dict)
    }
    return cards, category_map


def _tokens(value: str):
    return TOOL_WORD_RE.findall((value or "").lower())


def _query_signal_tokens(value: str):
    return [
        token
        for token in _tokens(value)
        if len(token) >= 2 and token not in QUERY_STOP_TOKENS
    ]


def _score_tool(
    tool: dict,
    query: str,
    current_tool_id: str | None,
    explicit_tool_ids: set[str],
):
    score = 0.0
    q = (query or "").lower()
    current = (current_tool_id or "").strip().lower()
    tool_id = (tool.get("id") or "").strip().lower()
    title = (tool.get("title") or "").strip().lower()
    description = (tool.get("description") or "").strip().lower()
    detailed = (tool.get("detailedDescription") or "").strip().lower()
    path = (tool.get("path") or "").strip().lower()
    text_blob = " ".join([tool_id, title, description, detailed, path])

    if tool_id and tool_id in explicit_tool_ids:
        score += 10

    # Page-context bias helps when query is ambiguous, but should not override
    # explicit requests for another tool.
    if current and tool_id == current and (not explicit_tool_ids or current in explicit_tool_ids):
        score += 3

    if tool_id and tool_id in q:
        score += 6
    if title and title in q:
        score += 5
    if path and path in q:
        score += 4

    for token in _query_signal_tokens(q):
        if token in tool_id:
            score += 2
        if token in title:
            score += 1.8
        if token in description:
            score += 1.3
        if token in detailed:
            score += 1.0
        if token in text_blob:
            score += 0.4

    return score


def _tool_context_line(tool: dict, category_label: str):
    title = tool.get("title") or UNKNOWN_TOOL_TITLE
    tool_id = tool.get("id") or ""
    description = tool.get("description") or ""
    detailed = tool.get("detailedDescription") or ""
    path = tool.get("path") or ""
    offline = bool(tool.get("offlineEnabled"))
    auth_required = bool(tool.get("authRequired"))

    return TOOL_CONTEXT_TEMPLATE.format(
        title=title,
        tool_id=tool_id,
        category_label=category_label,
        path=path,
        description=description,
        detailed=detailed,
        offline=YES_TEXT if offline else NO_TEXT,
        auth_required=YES_TEXT if auth_required else NO_TEXT,
    )


def _fallback_answer(tool: dict | None):
    if not isinstance(tool, dict):
        return FALLBACK_NO_TOOL

    title = (tool.get("title") or THIS_TOOL_TITLE).strip()
    description = (tool.get("description") or "").strip()
    detailed = (tool.get("detailedDescription") or "").strip()
    path = (tool.get("path") or "").strip()
    offline = bool(tool.get("offlineEnabled"))
    auth_required = bool(tool.get("authRequired"))

    if not description and detailed:
        description = detailed[:220].rstrip()

    auth_text = AUTH_REQUIRED_TEXT if auth_required else AUTH_NOT_REQUIRED_TEXT
    offline_text = OFFLINE_ENABLED_TEXT if offline else OFFLINE_DISABLED_TEXT

    return FALLBACK_ANSWER_TEMPLATE.format(
        title=title,
        description=description,
        auth_text=auth_text,
        offline_text=offline_text,
        path=path,
    ).strip()


def _explicit_tool_ids(query: str, cards: list[dict]) -> set[str]:
    q = (query or "").strip().lower()
    if not q:
        return set()

    explicit = set()
    for tool in cards:
        if not isinstance(tool, dict):
            continue
        tool_id = (tool.get("id") or "").strip().lower()
        title = (tool.get("title") or "").strip().lower()
        path = (tool.get("path") or "").strip().lower()
        if not tool_id:
            continue

        if tool_id in q:
            explicit.add(tool_id)
            continue
        if path and path in q:
            explicit.add(tool_id)
            continue
        if title and title in q:
            explicit.add(tool_id)
            continue
    return explicit


def _is_multi_tool_request(query: str):
    q = (query or "").strip().lower()
    if not q:
        return False

    phrase_hits = any(phrase in q for phrase in MULTI_TOOL_QUERY_PHRASES)
    if phrase_hits:
        return True

    tokens = set(_tokens(q))
    has_tool_word = TOOL_TOKEN in tokens or TOOLS_TOKEN in tokens
    has_list_intent = bool(tokens & LIST_INTENT_TOKENS)
    return has_tool_word and has_list_intent


def _is_offline_list_request(query: str):
    q = (query or "").strip().lower()
    if not q or not _is_multi_tool_request(q):
        return False
    return any(phrase in q for phrase in OFFLINE_QUERY_PHRASES)


def _select_related_tools_for_list(
    *,
    cards: list[dict],
    category_map: dict,
    query: str,
    scored: list[tuple[float, dict]],
    explicit_ids: set[str],
):
    q = (query or "").strip().lower()
    valid_cards = [tool for tool in cards if isinstance(tool, dict)]
    if not valid_cards:
        return []

    if ALL_TOOLS_QUERY_PHRASE in q:
        return valid_cards

    if _is_offline_list_request(q):
        offline_tools = [
            tool for tool in valid_cards if bool(tool.get("offlineEnabled"))
        ]
        return offline_tools if offline_tools else valid_cards[:5]

    focus_tokens = {
        token
        for token in _query_signal_tokens(q)
        if token not in LIST_INTENT_TOKENS
    }

    related = []
    for score, tool in scored:
        if score <= 0:
            continue
        tool_id = (tool.get("id") or "").strip().lower()
        title = (tool.get("title") or "").strip().lower()
        description = (tool.get("description") or "").strip().lower()
        path = (tool.get("path") or "").strip().lower()
        category_id = (tool.get("categoryId") or "").strip().lower()
        category_label = (category_map.get(category_id, "") or "").strip().lower()
        searchable = " ".join([tool_id, title, description, path, category_id, category_label])

        explicit_match = bool(tool_id and tool_id in explicit_ids)
        token_match = bool(
            focus_tokens and any(token in searchable for token in focus_tokens)
        )

        if explicit_match or token_match:
            related.append(tool)

    if related:
        return related

    fallback = [tool for score, tool in scored if score > 0]
    return fallback[:5] if fallback else valid_cards[:5]


def _build_context(*, cards: list[dict], category_map: dict, query: str, current_tool_id: str | None):
    explicit_ids = _explicit_tool_ids(query, cards)
    scored = sorted(
        (
            (_score_tool(tool, query, current_tool_id, explicit_ids), tool)
            for tool in cards
            if isinstance(tool, dict)
        ),
        key=lambda item: item[0],
        reverse=True,
    )

    best_score, best_tool = scored[0] if scored else (0.0, None)
    top_tools = [tool for score, tool in scored[:3] if score > 0]

    if _is_multi_tool_request(query):
        selected = _select_related_tools_for_list(
            cards=cards,
            category_map=category_map,
            query=query,
            scored=scored,
            explicit_ids=explicit_ids,
        )
    elif best_tool and best_score >= 2:
        selected = [best_tool]
    elif top_tools:
        selected = top_tools
    else:
        selected = cards[:3]

    lines = []
    for tool in selected:
        category_id = (tool.get("categoryId") or "").strip().lower()
        category_label = category_map.get(category_id, category_id or UNKNOWN_CATEGORY_LABEL)
        lines.append(_tool_context_line(tool, category_label))

    return "\n".join(lines), best_tool if best_score > 0 else None


def _sanitize_history(raw_history):
    if not isinstance(raw_history, list):
        return []

    safe = []
    for item in raw_history[-MAX_HISTORY_ITEMS:]:
        if not isinstance(item, dict):
            continue
        role = (item.get("role") or "").strip().lower()
        if role not in (HISTORY_ROLE_USER, HISTORY_ROLE_ASSISTANT):
            continue
        content = (item.get("content") or "").strip()
        if not content:
            continue
        safe.append(HISTORY_ITEM_TEMPLATE.format(role=role, content=content[:MAX_HISTORY_CHARS]))
    return safe


@api_view(["POST"])
@permission_classes([AllowAny])
def tool_chat_view(request):
    payload = request.data if isinstance(request.data, dict) else {}
    message = (payload.get("message") or "").strip()
    current_tool_id = (payload.get("currentToolId") or "").strip().lower() or None
    history = _sanitize_history(payload.get("history"))

    if not message:
        return Response(
            {"error": ERROR_MESSAGE_REQUIRED},
            status=status.HTTP_400_BAD_REQUEST,
        )

    api_key = os.getenv(ENV_OPENAI_API_KEY, "").strip()
    model = os.getenv(ENV_OPENAI_MODEL, DEFAULT_OPENAI_MODEL).strip() or DEFAULT_OPENAI_MODEL

    if not api_key:
        return Response(
            {"error": ERROR_CHAT_NOT_CONFIGURED},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        from openai import OpenAI
    except Exception:
        return Response(
            {"error": ERROR_OPENAI_SDK_MISSING},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        cards, category_map = _load_tool_metadata()
    except Exception as exc:
        payload = {"error": ERROR_TOOL_METADATA_UNAVAILABLE}
        if settings.DEBUG:
            payload["details"] = str(exc)
            payload["exceptionType"] = exc.__class__.__name__
        return Response(
            payload,
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    context_text, matched_tool = _build_context(
        cards=cards,
        category_map=category_map,
        query=message,
        current_tool_id=current_tool_id,
    )

    history_block = "\n".join(history) if history else NO_HISTORY_TEXT
    user_prompt = USER_PROMPT_TEMPLATE.format(
        message=message,
        current_tool_id=current_tool_id or NONE_TOOL_ID_TEXT,
        history_block=history_block,
        context_text=context_text,
    )

    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.create(
            model=model,
            input=[
                {"role": OPENAI_ROLE_SYSTEM, "content": SYSTEM_PROMPT},
                {"role": OPENAI_ROLE_USER, "content": user_prompt},
            ],
        )
        answer = (getattr(response, "output_text", "") or "").strip()
        if not answer or len(answer.split()) < 3:
            answer = _fallback_answer(matched_tool)
    except Exception as exc:
        payload = {"error": ERROR_ASSISTANT_REQUEST_FAILED}
        if settings.DEBUG:
            payload["details"] = str(exc)
            payload["exceptionType"] = exc.__class__.__name__
        return Response(
            payload,
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response(
        {
            "answer": answer,
            "matchedToolId": matched_tool.get("id") if isinstance(matched_tool, dict) else None,
            "model": model,
        },
        status=status.HTTP_200_OK,
    )
