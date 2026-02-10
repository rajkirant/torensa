type ApiErrorPayload = {
  error?: unknown;
  details?: unknown;
};

export function formatApiError(
  data: ApiErrorPayload | null | undefined,
  fallback: string,
) {
  const baseError =
    typeof data?.error === "string" && data.error.trim()
      ? data.error.trim()
      : fallback;

  const details =
    typeof data?.details === "string" && data.details.trim()
      ? data.details.trim()
      : "";

  if (!details) return baseError;

  const lower = details.toLowerCase();
  if (lower.includes("invalid_grant") || lower.includes("expired") || lower.includes("revoked")) {
    return "Your Gmail connection expired or was revoked. Please reconnect Gmail.";
  }

  return `${baseError}: ${details}`;
}
