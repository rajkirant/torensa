import { getCsrfToken } from "./csrf";

type FetchOptions = RequestInit & {
  csrf?: boolean;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

const CSRF_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

export async function apiFetch(url: string, options: FetchOptions = {}) {
  const { headers = {}, method = "GET", csrf = true, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  };

  // Add CSRF token only when required
  if (csrf && CSRF_METHODS.includes(method.toUpperCase())) {
    const csrfToken = getCsrfToken();
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
