import json
import os
import re
from pathlib import Path

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


TOOL_WORD_RE = re.compile(r"[a-z0-9_]+")
MAX_HISTORY_ITEMS = 6
MAX_HISTORY_CHARS = 450


def _metadata_paths():
    project_root = Path(__file__).resolve().parents[3]
    service_cards = project_root / "frontend" / "src" / "metadata" / "serviceCards.json"
    categories = project_root / "frontend" / "src" / "metadata" / "categories.json"
    return service_cards, categories


def _load_tool_metadata():
    service_cards_path, categories_path = _metadata_paths()
    with service_cards_path.open("r", encoding="utf-8") as file:
        cards = json.load(file)
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


def _score_tool(tool: dict, query: str, current_tool_id: str | None):
    score = 0.0
    q = (query or "").lower()
    current = (current_tool_id or "").strip().lower()
    tool_id = (tool.get("id") or "").strip().lower()
    title = (tool.get("title") or "").strip().lower()
    description = (tool.get("description") or "").strip().lower()
    detailed = (tool.get("detailedDescription") or "").strip().lower()
    path = (tool.get("path") or "").strip().lower()
    text_blob = " ".join([tool_id, title, description, detailed, path])

    if current and tool_id == current:
        score += 7

    if tool_id and tool_id in q:
        score += 6
    if title and title in q:
        score += 5
    if path and path in q:
        score += 4

    for token in _tokens(q):
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
    title = tool.get("title") or "Unknown tool"
    tool_id = tool.get("id") or ""
    description = tool.get("description") or ""
    detailed = tool.get("detailedDescription") or ""
    path = tool.get("path") or ""
    offline = bool(tool.get("offlineEnabled"))
    auth_required = bool(tool.get("authRequired"))

    return (
        f"- {title} (id: {tool_id}, category: {category_label}, path: {path})\n"
        f"  Short: {description}\n"
        f"  Details: {detailed}\n"
        f"  Offline: {'yes' if offline else 'no'}, Auth required: {'yes' if auth_required else 'no'}"
    )


def _fallback_answer(tool: dict | None):
    if not isinstance(tool, dict):
        return (
            "I can explain any Torensa tool. Tell me the tool name or open a tool page, "
            "and I will give a short summary."
        )

    title = (tool.get("title") or "This tool").strip()
    description = (tool.get("description") or "").strip()
    detailed = (tool.get("detailedDescription") or "").strip()
    path = (tool.get("path") or "").strip()
    offline = bool(tool.get("offlineEnabled"))
    auth_required = bool(tool.get("authRequired"))

    if not description and detailed:
        description = detailed[:220].rstrip()

    auth_text = "requires login" if auth_required else "does not require login"
    offline_text = "works offline after initial load" if offline else "needs internet access"

    return (
        f"{title}: {description} "
        f"It {auth_text}, {offline_text}, and is available at {path}."
    ).strip()


def _build_context(*, cards: list[dict], category_map: dict, query: str, current_tool_id: str | None):
    scored = sorted(
        (
            (_score_tool(tool, query, current_tool_id), tool)
            for tool in cards
            if isinstance(tool, dict)
        ),
        key=lambda item: item[0],
        reverse=True,
    )

    best_score, best_tool = scored[0] if scored else (0.0, None)
    top_tools = [tool for score, tool in scored[:3] if score > 0]

    if best_tool and best_score >= 2:
        selected = [best_tool]
    elif top_tools:
        selected = top_tools
    else:
        selected = cards[:3]

    lines = []
    for tool in selected:
        category_id = (tool.get("categoryId") or "").strip().lower()
        category_label = category_map.get(category_id, category_id or "Unknown")
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
        if role not in ("user", "assistant"):
            continue
        content = (item.get("content") or "").strip()
        if not content:
            continue
        safe.append(f"{role}: {content[:MAX_HISTORY_CHARS]}")
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
            {"error": "message is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("OPENAI_MODEL", "gpt-5-mini").strip() or "gpt-5-mini"

    if not api_key:
        return Response(
            {"error": "Chat assistant is not configured on server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        from openai import OpenAI
    except Exception:
        return Response(
            {"error": "OpenAI SDK is not installed on server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        cards, category_map = _load_tool_metadata()
    except Exception:
        return Response(
            {"error": "Tool metadata is unavailable."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    context_text, matched_tool = _build_context(
        cards=cards,
        category_map=category_map,
        query=message,
        current_tool_id=current_tool_id,
    )

    history_block = "\n".join(history) if history else "No previous chat history."
    system_prompt = (
        "You are Torensa's Tool Assistant.\n"
        "Only explain tools based on the provided metadata context.\n"
        "Keep answers short and simple (2-4 sentences).\n"
        "If user intent is unclear, ask one short clarifying question.\n"
        "Do not invent features that are not in the context."
    )
    user_prompt = (
        f"User question:\n{message}\n\n"
        f"Current tool id (if any): {current_tool_id or 'none'}\n\n"
        f"Recent chat history:\n{history_block}\n\n"
        f"Relevant tool metadata:\n{context_text}"
    )

    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_output_tokens=160,
        )
        answer = (getattr(response, "output_text", "") or "").strip()
        if not answer or len(answer.split()) < 3:
            answer = _fallback_answer(matched_tool)
    except Exception as exc:
        payload = {"error": "Assistant request failed. Please try again."}
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
