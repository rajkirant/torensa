import { getCsrfToken, setCsrfToken } from "./csrf";

type FetchOptions = RequestInit & {
  csrf?: boolean;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

const CSRF_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

async function ensureCsrfToken() {
  const existing = getCsrfToken();
  if (existing) return existing;

  try {
    const res = await fetch(`${API_BASE_URL}/api/me/`, {
      method: "GET",
      credentials: "include",
    });

    if (!res.ok) return "";

    const data = await res.json().catch(() => null);
    const token =
      typeof data?.csrfToken === "string" && data.csrfToken.trim()
        ? data.csrfToken
        : "";

    if (token) {
      setCsrfToken(token);
    }

    return token;
  } catch {
    return "";
  }
}

export async function apiFetch(url: string, options: FetchOptions = {}) {
  const { headers = {}, method = "GET", csrf = true, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  };

  // Add CSRF token only when required
  if (csrf && CSRF_METHODS.includes(method.toUpperCase())) {
    const csrfToken = (await ensureCsrfToken()) || getCsrfToken();
    if (csrfToken) {
      finalHeaders["X-CSRFToken"] = csrfToken;
    }
  }

  return fetch(`${API_BASE_URL}${url}`, {
    method,
    credentials: "include",
    headers: finalHeaders,
    ...rest,
  });
}
