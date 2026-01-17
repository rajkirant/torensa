const CSRF_COOKIE_NAME = "csrf_token";

/**
 * Read masked CSRF token from frontend cookie (torensa.com)
 */
export function getCsrfToken(): string {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));

  return match ? decodeURIComponent(match.split("=")[1]) : "";
}

/**
 * Store masked CSRF token in frontend cookie
 * Call this AFTER login
 */
export function setCsrfToken(token: string) {
  document.cookie = [
    `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "SameSite=Lax", // frontend-only, same-site
    "Secure", // HTTPS only
    `Max-Age=${60 * 60 * 2}`, // 2 hours (adjust if needed)
  ].join("; ");
}

/**
 * Clear CSRF token on logout
 */
export function clearCsrfToken() {
  document.cookie = `${CSRF_COOKIE_NAME}=; Path=/; Max-Age=0`;
}
