// Worker entry for the TeX Viewer's TikZ rendering (copied to /tikzjax/ at
// build time, see vite.config.ts).
//
// TikZJax fetches its .gz files and inflates them itself. Some servers send
// them with "Content-Encoding: gzip", in which case the browser has already
// inflated the body; re-compress it so TikZJax gets the bytes it expects.
const nativeFetch = self.fetch.bind(self);

self.fetch = async (input, init) => {
  const response = await nativeFetch(input, init);
  const url = new URL(typeof input === "string" ? input : input.url, self.location.href);
  // A missing TeX file must look missing. Single-page-app hosting answers
  // unknown paths with index.html, which TeX would try to read as input.
  if (/text\/html/i.test(response.headers.get("content-type") || "")) {
    return new Response(null, { status: 404 });
  }
  const encoding = response.headers.get("content-encoding") || "";
  if (response.ok && response.body && url.pathname.endsWith(".gz") && /gzip/i.test(encoding)) {
    return new Response(response.body.pipeThrough(new CompressionStream("gzip")), {
      status: response.status,
      headers: { "content-type": "application/gzip" },
    });
  }
  return response;
};

self.importScripts("run-tex.js");
