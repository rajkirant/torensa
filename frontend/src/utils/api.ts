import { getCsrfToken } from "./csrf";

type FetchOptions = RequestInit & {
  csrf?: boolean;
};
const API_BASE_URL = import.meta.env.VITE_API_URL;
export async function apiFetch(url: string, options: FetchOptions = {}) {
  const { csrf = false, headers, ...rest } = options;

  // ✅ Force headers into a plain object
  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string> | undefined),
  };

  finalHeaders["X-CSRFToken"] = getCsrfToken();

  return fetch(`${API_BASE_URL}${url}`, {
    credentials: "include",
    ...options,
  });
}
