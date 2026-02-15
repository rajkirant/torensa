import re


TOOL_WORD_RE = re.compile(r"[a-z0-9_]+")
MAX_HISTORY_ITEMS = 6
MAX_HISTORY_CHARS = 450

QUERY_STOP_TOKENS = {
    "a",
    "an",
    "and",
    "are",
    "be",
    "can",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "me",
    "of",
    "on",
    "please",
    "that",
    "the",
    "to",
    "what",
    "which",
    "with",
    "you",
}

LIST_INTENT_TOKENS = {
    "all",
    "category",
    "categories",
    "list",
    "name",
    "names",
    "related",
    "tool",
    "tools",
}

MULTI_TOOL_QUERY_PHRASES = (
    "all tools",
    "list tools",
    "list of tools",
    "names of tools",
    "which tools",
    "what tools",
    "what are the tools",
)
ALL_TOOLS_QUERY_PHRASE = "all tools"

ENV_TOOL_METADATA_DIR = "TOOL_METADATA_DIR"
ENV_OPENAI_API_KEY = "OPENAI_API_KEY"
ENV_OPENAI_MODEL = "OPENAI_MODEL"
DEFAULT_OPENAI_MODEL = "gpt-5-mini"

SERVICE_CARDS_FILENAME = "serviceCards.json"
CATEGORIES_FILENAME = "categories.json"
BACKEND_METADATA_PATH_PARTS = ("backend", "metadata")
ROOT_METADATA_PATH_PARTS = ("metadata",)
FRONTEND_METADATA_PATH_PARTS = ("frontend", "src", "metadata")
METADATA_NOT_FOUND_PREFIX = "Could not locate tool metadata files. Searched common locations:\n"

NO_HISTORY_TEXT = "No previous chat history."
NONE_TOOL_ID_TEXT = "none"

SYSTEM_PROMPT = (
    "You are Torensa's Tool Assistant.\n"
    "Only explain tools based on the provided metadata context.\n"
    "Use clear, helpful language.\n"
    "If the user asks for a list/category, return all matching tool names as bullets.\n"
    "If user intent is unclear, ask one short clarifying question.\n"
    "Do not invent features that are not in the context."
)

USER_PROMPT_TEMPLATE = (
    "User question:\n{message}\n\n"
    "Current tool id (if any): {current_tool_id}\n\n"
    "Recent chat history:\n{history_block}\n\n"
    "Relevant tool metadata:\n{context_text}"
)

ERROR_MESSAGE_REQUIRED = "message is required"
ERROR_CHAT_NOT_CONFIGURED = "Chat assistant is not configured on server."
ERROR_OPENAI_SDK_MISSING = "OpenAI SDK is not installed on server."
ERROR_TOOL_METADATA_UNAVAILABLE = "Tool metadata is unavailable."
ERROR_ASSISTANT_REQUEST_FAILED = "Assistant request failed. Please try again."

FALLBACK_NO_TOOL = (
    "I can explain any Torensa tool. Tell me the tool name or open a tool page, "
    "and I will give a short summary."
)
UNKNOWN_TOOL_TITLE = "Unknown tool"
THIS_TOOL_TITLE = "This tool"
UNKNOWN_CATEGORY_LABEL = "Unknown"
YES_TEXT = "yes"
NO_TEXT = "no"
AUTH_REQUIRED_TEXT = "requires login"
AUTH_NOT_REQUIRED_TEXT = "does not require login"
OFFLINE_ENABLED_TEXT = "works offline after initial load"
OFFLINE_DISABLED_TEXT = "needs internet access"

TOOL_CONTEXT_TEMPLATE = (
    "- {title} (id: {tool_id}, category: {category_label}, path: {path})\n"
    "  Short: {description}\n"
    "  Details: {detailed}\n"
    "  Offline: {offline}, Auth required: {auth_required}"
)

FALLBACK_ANSWER_TEMPLATE = (
    "{title}: {description} "
    "It {auth_text}, {offline_text}, and is available at {path}."
)

HISTORY_ROLE_USER = "user"
HISTORY_ROLE_ASSISTANT = "assistant"
HISTORY_ITEM_TEMPLATE = "{role}: {content}"

OPENAI_ROLE_SYSTEM = "system"
OPENAI_ROLE_USER = "user"

TOOL_TOKEN = "tool"
TOOLS_TOKEN = "tools"
