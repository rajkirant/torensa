let refreshInFlight: Promise<void> | null = null;

const LAST_BUILD_NUMBER_KEY = "torensa:last-build-number";
const LAST_BUILD_TIMESTAMP_KEY = "torensa:last-build-timestamp";
const RELOAD_GUARD_KEY = "torensa:reload-target-build";
const BUILD_INFO_URL = "/metadata/build-info.json";

export type BuildInfo = {
  buildNumber?: string | number | null;
  buildTimestamp?: string | null;
} | null;

function normalizeBuildNumber(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeBuildTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

async function refreshServiceWorkerAndReload() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(
          registrations.map((registration) => registration.unregister()),
        );
      }
    } catch {
      // Fallback below performs a hard reload.
    }

    window.location.reload();
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export function syncBuildAndMaybeReload(build: BuildInfo): boolean {
  const incomingBuildNumber = normalizeBuildNumber(build?.buildNumber);
  const incomingBuildTimestamp = normalizeBuildTimestamp(build?.buildTimestamp);

  if (!incomingBuildNumber) return false;

  let previousBuildNumber: string | null = null;
  try {
    previousBuildNumber = localStorage.getItem(LAST_BUILD_NUMBER_KEY);
    localStorage.setItem(LAST_BUILD_NUMBER_KEY, incomingBuildNumber);
    if (incomingBuildTimestamp) {
      localStorage.setItem(LAST_BUILD_TIMESTAMP_KEY, incomingBuildTimestamp);
    }
  } catch {
    return false;
  }

  if (!previousBuildNumber || previousBuildNumber === incomingBuildNumber) {
    try {
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
    } catch {
      // Ignore storage failures.
    }
    return false;
  }

  try {
    const guard = sessionStorage.getItem(RELOAD_GUARD_KEY);
    if (guard === incomingBuildNumber) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, incomingBuildNumber);
  } catch {
    // If sessionStorage fails, continue and attempt one best-effort refresh.
  }

  void refreshServiceWorkerAndReload();
  return true;
}

export async function syncBuildFromStaticFile(): Promise<boolean> {
  try {
    // Query param avoids stale precache matches from older service workers.
    const response = await fetch(`${BUILD_INFO_URL}?v=${Date.now()}`, {
      cache: "no-store",
      credentials: "omit",
    });
    if (!response.ok) return false;
    const build = (await response.json()) as BuildInfo;
    return syncBuildAndMaybeReload(build);
  } catch {
    // Ignore and continue app bootstrap.
    return false;
  }
}
