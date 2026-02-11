type ApiErrorPayload = {
  error?: unknown;
  details?: unknown;
  detail?: unknown;
};

export function formatApiError(
  data: ApiErrorPayload | null | undefined,
  fallback: string,
) {
  const baseError =
    typeof data?.error === "string" && data.error.trim()
      ? data.error.trim()
      : fallback;

  const detail =
    typeof data?.detail === "string" && data.detail.trim()
      ? data.detail.trim()
      : "";

  const details =
    typeof data?.details === "string" && data.details.trim()
      ? data.details.trim()
      : detail;

  if (!details) return baseError;

  const lower = details.toLowerCase();
  if (lower.includes("csrf")) {
    return "Session security token is missing. Refresh the page and try again. If it continues, sign in again.";
  }

  if (
    lower.includes("authentication credentials were not provided") ||
    lower.includes("not authenticated")
  ) {
    return "Please sign in again and retry.";
  }

  if (lower.includes("invalid_grant") || lower.includes("expired") || lower.includes("revoked")) {
    return "Your Gmail connection expired or was revoked. Please reconnect Gmail.";
  }

  return `${baseError}: ${details}`;
}
