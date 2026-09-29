/**
 * Renders TikZ pictures to SVG with TikZJax (TeX compiled to WebAssembly),
 * running in a web worker. The worker files are copied to /tikzjax at build
 * time (see vite.config.ts).
 *
 * TikZJax's own loader inserts TeX's SVG straight into the page. We talk to
 * its worker directly instead so the SVG can be parsed inertly and sanitised
 * before it is placed in the (script-free) preview frame.
 */

export type TikzJob = {
  /** Cache key covering the source and everything that affects the output. */
  key: string;
  source: string;
  dataset: {
    tikzLibraries?: string;
    texPackages?: string;
    addToPreamble?: string;
  };
};

const BASE = "/tikzjax";
const TIMEOUT_MS = 60_000;
const CACHE_KEY = "torensa_tikz_cache_v1";
const CACHE_LIMIT = 25;

type WorkerMessage = {
  type?: string;
  uid?: number;
  complete?: boolean;
  payload?: unknown;
  error?: { message?: string };
};

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let nextUid = 0;
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();
let queue: Promise<unknown> = Promise.resolve();
const memoryCache = new Map<string, Promise<string | null>>();

/** Short stable hash, used to give each diagram's ids a unique prefix. */
function hashKey(key: string) {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function resetWorker(reason: string) {
  worker?.terminate();
  worker = null;
  ready = null;
  for (const { reject } of pending.values()) reject(new Error(reason));
  pending.clear();
}

function call(method: string, args: unknown[]) {
  const uid = ++nextUid;
  return new Promise<unknown>((resolve, reject) => {
    pending.set(uid, { resolve, reject });
    worker?.postMessage({ type: "run", uid, method, args });
  });
}

function startWorker(): Promise<void> {
  if (ready) return ready;
  ready = new Promise<void>((resolve, reject) => {
    const w = new Worker(`${BASE}/worker.js`);
    worker = w;
    w.onmessage = (event: MessageEvent<WorkerMessage | string>) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return; // TeX console output
      if (msg.type === "init") {
        resolve();
        return;
      }
      const job = msg.uid !== undefined ? pending.get(msg.uid) : undefined;
      if (msg.type === "result" && msg.complete && job) {
        pending.delete(msg.uid!);
        job.resolve(msg.payload);
      } else if (msg.type === "error" && job) {
        pending.delete(msg.uid!);
        job.reject(new Error(msg.error?.message ?? "TeX failed"));
      } else if (msg.type === "uncaughtError") {
        resetWorker(msg.error?.message ?? "TeX worker crashed");
      }
    };
    w.onerror = () => {
      reject(new Error("Could not start the TeX worker"));
      resetWorker("TeX worker failed");
    };
  }).then(() => call("load", [new URL(BASE, window.location.origin).href]).then(() => undefined));
  ready.catch(() => resetWorker("TeX worker failed to load"));
  return ready;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      // TeX can wait forever on some errors; restart the worker.
      resetWorker("TikZ rendering timed out");
      reject(new Error("TikZ rendering timed out"));
    }, TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const BLOCKED_ELEMENTS =
  "script,foreignObject,iframe,object,embed,animate,animateMotion,animateTransform,set,handler,audio,video";

/** Parses TeX's SVG inertly and removes anything that could run code. */
function sanitizeSvg(markup: string, prefix: string): string | null {
  const doc = new DOMParser().parseFromString(markup, "text/html");
  const svg = doc.querySelector("svg");
  if (!svg) return null;
  svg.querySelectorAll(BLOCKED_ELEMENTS).forEach((el) => el.remove());
  for (const el of [svg, ...Array.from(svg.querySelectorAll("*"))]) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if ((name === "href" || name === "xlink:href") && !value.startsWith("#")) {
        el.removeAttribute(attr.name);
      } else if (/javascript:|url\(\s*['"]?(?!#)/i.test(value)) {
        el.removeAttribute(attr.name);
      }
    }
  }
  svg.setAttribute("role", "img");
  // Make PGF's ids unique so several diagrams can share one document.
  return svg.outerHTML.replace(/\b(id="|#)pgf/g, `$1pgf${prefix}`);
}

function readCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache(key: string, svg: string) {
  try {
    const cache = readCache();
    delete cache[key];
    cache[key] = svg;
    const keys = Object.keys(cache);
    for (const old of keys.slice(0, Math.max(0, keys.length - CACHE_LIMIT))) {
      delete cache[old];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full or unavailable */
  }
}

/** Renders one TikZ picture. Resolves to sanitised SVG markup, or null on failure. */
export function renderTikz(job: TikzJob): Promise<string | null> {
  const cached = memoryCache.get(job.key);
  if (cached) return cached;

  const stored = readCache()[job.key];
  if (stored) {
    const result = Promise.resolve(stored);
    memoryCache.set(job.key, result);
    return result;
  }

  const result = (queue = queue
    .catch(() => undefined)
    .then(async () => {
      await withTimeout(startWorker());
      const html = await withTimeout(call("texify", [job.source, job.dataset]));
      if (typeof html !== "string") return null;
      const svg = sanitizeSvg(html, `d${hashKey(job.key)}x`);
      if (svg) writeCache(job.key, svg);
      return svg;
    })
    .catch(() => null)) as Promise<string | null>;

  memoryCache.set(job.key, result);
  // Let a failed diagram be retried after the source changes back.
  result.then((svg) => {
    if (!svg) memoryCache.delete(job.key);
  });
  return result;
}
