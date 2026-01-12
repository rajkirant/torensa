import { getCsrfToken } from "./csrf";

type FetchOptions = RequestInit & {
  csrf?: boolean;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

const CSRF_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

export async function apiFetch(url: string, options: FetchOptions = {}) {
  const { headers, method = "GET", ...rest } = options;

  // Ensure headers are a plain object
  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string> | undefined),
  };

  // Add CSRF token only for non-safe methods
  if (CSRF_METHODS.includes(method.toUpperCase())) {
    finalHeaders["X-CSRFToken"] = getCsrfToken();
  }

  return fetch(`${API_BASE_URL}${url}`, {
    method,
    credentials: "include",
    headers: finalHeaders,
    ...rest,
  });
}
