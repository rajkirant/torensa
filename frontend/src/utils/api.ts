import { getCsrfToken } from "./csrf";

type FetchOptions = RequestInit & {
  csrf?: boolean;
};

export async function apiFetch(url: string, options: FetchOptions = {}) {
  const { csrf = false, headers, ...rest } = options;

  // ✅ Force headers into a plain object
  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string> | undefined),
  };

  finalHeaders["X-CSRFToken"] = getCsrfToken();

  return fetch(url, {
    credentials: "include",
    headers: finalHeaders,
    ...rest,
  });
}
