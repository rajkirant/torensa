import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import { TransparentButton } from "../components/buttons/TransparentButton";
import FilePickerButton from "../components/inputs/FilePickerButton";
import FlexWrapRow from "../components/layout/FlexWrapRow";
import useToolStatus from "../hooks/useToolStatus";
import downloadBlob from "../utils/downloadBlob";
import { fitPagesToWidth, paginate } from "../utils/texPaginate";
import type { DocLayout, TikzJob } from "../utils/texToHtml";
import { renderTikz } from "../utils/tikzRender";
import katexCss from "katex/dist/katex.min.css?inline";
import libertinusSerif400 from "@fontsource/libertinus-serif/400.css?inline";
import libertinusSerif400Italic from "@fontsource/libertinus-serif/400-italic.css?inline";
import libertinusSerif700 from "@fontsource/libertinus-serif/700.css?inline";
import libertinusSerif700Italic from "@fontsource/libertinus-serif/700-italic.css?inline";
import libertinusSans400 from "@fontsource/libertinus-sans/400.css?inline";
import libertinusSans700 from "@fontsource/libertinus-sans/700.css?inline";
import tinos400 from "@fontsource/tinos/400.css?inline";
import tinos400Italic from "@fontsource/tinos/400-italic.css?inline";
import tinos700 from "@fontsource/tinos/700.css?inline";
import tinos700Italic from "@fontsource/tinos/700-italic.css?inline";

const STORAGE_KEY = "torensa_tex_viewer_source";
const VIEW_MODE_KEY = "torensa_tex_viewer_view";
const RENDER_DELAY_MS = 500;
const EDITOR_HEIGHT = 560;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MONOSPACE =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

type TemplateId = "article" | "math" | "blank";

const TEMPLATES: Record<TemplateId, { label: string; source: string }> = {
  article: {
    label: "Sample article",
    source: String.raw`\documentclass{article}
\usepackage{amsmath}
\usepackage{booktabs}

\title{A Short Guide to \LaTeX}
\author{Torensa}
\date{\today}

\begin{document}

\maketitle

\begin{abstract}
This document shows how the TeX Viewer renders sections, lists, tables,
citations and mathematics directly in your browser.
\end{abstract}

\section{Introduction}
\label{sec:intro}
\LaTeX{} is a document preparation system used for scientific papers,
theses and books~\cite{lamport}. You can write \textbf{bold}, \textit{italic},
\underline{underlined} and \texttt{monospaced} text, or change the
size from {\small small} to {\large large}.\footnote{Footnotes are collected
at the end of the preview.}

\subsection{Lists}
\begin{itemize}
  \item Unordered lists use \texttt{itemize}.
  \item Ordered lists use \texttt{enumerate}:
  \begin{enumerate}
    \item first item,
    \item second item.
  \end{enumerate}
\end{itemize}

\section{Mathematics}
Inline math such as $e^{i\pi} + 1 = 0$ sits within a sentence, while
display math gets its own line:
\[
  \int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
\]

The quadratic formula is given in Equation~\ref{eq:quadratic}:
\begin{equation}
  x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}.
  \label{eq:quadratic}
\end{equation}

Multi-line derivations use \texttt{align}:
\begin{align*}
  (a+b)^2 &= (a+b)(a+b) \\
          &= a^2 + 2ab + b^2.
\end{align*}

\section{Tables}
Table~\ref{tab:classes} lists common document classes, as described in
Section~\ref{sec:intro}.

\begin{table}[h]
\caption{Common document classes.}
\label{tab:classes}
\begin{tabular}{@{}l l r@{}}
\toprule
Class & Typical use & Levels \\
\midrule
article & Papers and reports & 3 \\
report  & Theses            & 4 \\
book    & Books             & 5 \\
\bottomrule
\end{tabular}
\end{table}

\begin{thebibliography}{9}
\bibitem{lamport}
L. Lamport.
\newblock \emph{\LaTeX: A Document Preparation System}.
\newblock Addison-Wesley, 2nd edition, 1994.
\end{thebibliography}

\end{document}
`,
  },
  math: {
    label: "Math cheat sheet",
    source: String.raw`\documentclass{article}

\begin{document}

\section*{Algebra}
$$ (a+b)^2 = a^2 + 2ab + b^2 $$
$$ \sum_{k=1}^{n} k = \frac{n(n+1)}{2} $$

\section*{Calculus}
$$ \frac{d}{dx}\sin x = \cos x \qquad \int x^n\,dx = \frac{x^{n+1}}{n+1} + C $$
$$ \lim_{x \to 0} \frac{\sin x}{x} = 1 $$

\section*{Linear algebra}
$$ A = \begin{pmatrix} a & b \\ c & d \end{pmatrix}, \qquad
   \det A = ad - bc $$

\section*{Greek letters}
$\alpha, \beta, \gamma, \delta, \epsilon, \theta, \lambda, \mu, \pi,
\sigma, \phi, \omega, \Gamma, \Delta, \Sigma, \Omega$

\end{document}
`,
  },
  blank: {
    label: "Blank document",
    source: String.raw`\documentclass{article}

\begin{document}

\end{document}
`,
  },
};

type RendererModule = typeof import("../utils/texToHtml");
type RenderResult = ReturnType<RendererModule["texToHtml"]>;

// Styles for the rendered document inside the preview frame. Sizes are in
// em so the same rules work for the continuous view and the page view.
const DOCUMENT_CSS = `
:root{--tex-serif:"Latin Modern Roman","CMU Serif","Libertinus Serif",Georgia,serif;--tex-sans:"Libertinus Sans","Helvetica Neue",Arial,sans-serif;--tex-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
body.tex-fam-acm{--tex-serif:"Libertinus Serif","Linux Libertine O",Georgia,serif}
body.tex-fam-times{--tex-serif:Tinos,"Times New Roman",Times,serif;--tex-sans:Arial,Helvetica,sans-serif}
html{background:#fff;color:#111}
body{margin:0 auto;max-width:46em;padding:2.5rem 2rem;font-family:var(--tex-serif);font-size:17px;line-height:1.45;text-align:justify;hyphens:auto;overflow-wrap:break-word}
a{color:#1a4fb5}
code{font-family:var(--tex-mono);font-size:.88em}
p{margin:0;text-indent:var(--tex-indent,1.5em)}
.katex{font-size:1em}
p.tex-noindent,p.tex-cont,h2+p,h3+p,h4+p,h1+p,hr+p,.tex-titleblock+p{text-indent:0}
p.tex-split{text-align-last:justify}
.tex-titleblock{text-align:center;margin-bottom:1.6em}
h1.tex-title{font-size:1.73em;line-height:1.25;margin:0 0 .6em}
.tex-authors{display:flex;flex-wrap:wrap;justify-content:center;gap:.4em 2.5em}
.tex-author{display:flex;flex-direction:column;font-size:1.2em}
.tex-affiliation,.tex-email{font-size:.8em}
.tex-aff-part+.tex-aff-part::before{content:", "}
.tex-date{margin-top:.5em;font-size:1.2em}
h2,h3,h4,h1.tex-part{text-align:left;line-height:1.25;margin:1.2em 0 .5em;text-indent:0}
h2{font-size:1.44em}h3{font-size:1.2em}h4{font-size:1em}
.tex-secnum{margin-right:.8em}
.tex-abstract-title{font-size:1em;text-align:center;margin:1em 0 .3em}
p.tex-abstract{font-size:.9em;margin:0 2.5em}
.tex-meta-head{font-size:1em}
.tex-keywords,.tex-ccs{margin-top:.4em}
.tex-par{display:block;height:.7em}
.tex-display{margin:.6em 0;overflow-x:auto;overflow-y:hidden}
.katex-display{margin:0}
.tex-float{margin:1em 0;text-align:center}
figcaption{margin:.5em 0;font-size:.9em;line-height:1.25;text-align:left}
.tex-table-wrap{overflow-x:auto}
table.tex-tabular{border-collapse:collapse;margin:.4em auto;text-align:left;line-height:1.25}
.tex-tabular td{padding:.2em .5em;vertical-align:top}
.tex-rule-top-heavy td{border-top:1.5px solid #111}
.tex-rule-top-light td{border-top:.75px solid #111}
.tex-rule-bottom-heavy td{border-bottom:1.5px solid #111}
.tex-rule-bottom-light td{border-bottom:.75px solid #111}
.tex-placeholder{display:inline-block;padding:1em 1.5em;border:1px dashed #999;color:#666;background:#fafafa;font-family:var(--tex-sans);font-size:.8em;text-indent:0}
blockquote{margin:.6em 2em}
pre.tex-verbatim{font-family:var(--tex-mono);font-size:.85em;background:#f6f6f6;padding:.8em;overflow-x:auto;text-align:left}
ul,ol{padding-left:1.6em;margin:.4em 0}
li{margin:.15em 0}
li.tex-custom-label,li.tex-cont-item{list-style:none}
.tex-item-label{font-weight:bold;margin-left:-1.2em}
dl.tex-description dt{font-weight:bold;float:left;margin-right:.5em}
dl.tex-description dd{margin:0 0 .4em 1.5em}
.tex-theorem,.tex-proof{margin:.6em 0}
.tex-qed{float:right}
.tex-bib-title{margin-top:1.2em}
.tex-bibitem{position:relative;padding-left:2.4em;margin:.2em 0;font-size:.85em;line-height:1.25;text-align:left;text-indent:0}
.tex-bib-label{position:absolute;left:0}
.tex-bibitem.tex-cont .tex-bib-label{display:none}
hr.tex-fn-rule{width:30%;margin:1.2em 0 .3em;border:0;border-top:1px solid #111}
.tex-footnote{font-size:.8em;line-height:1.25;text-indent:0}
.tex-fbox{border:1px solid #111;padding:0 .2em}
.tex-tikz{text-align:center;margin:.3em 0;line-height:1;text-indent:0}
.tex-tikz svg{max-width:100%;height:auto;overflow:visible}
.tex-fullwidth .tex-tikz svg{width:100%}
sup.tex-a{font-size:.75em;vertical-align:.3em;margin:0 -.15em 0 -.36em}
sub.tex-e{font-size:1em;vertical-align:-.5ex;margin:0 -.1em 0 -.15em}
/* acmart: title in Biolinum (sans), headings in Libertine bold 10.9pt */
.tex-cls-acmart{--tex-indent:1.1em}
.tex-cls-acmart h1.tex-title{font-family:var(--tex-sans);font-weight:bold;font-size:1.9em}
.tex-cls-acmart .tex-author{font-size:1.33em}
.tex-cls-acmart h2,.tex-cls-acmart h3,.tex-cls-acmart .tex-abstract-title,.tex-cls-acmart .tex-meta-head{font-family:var(--tex-serif);font-weight:bold;font-size:1.21em;line-height:1.1;text-align:left;margin:1.15em 0 .35em}
.tex-cls-acmart h2,.tex-cls-acmart .tex-abstract-title,.tex-cls-acmart .tex-meta-head{text-transform:uppercase}
.tex-cls-acmart .tex-abstract-title{margin-top:0}
.tex-cls-acmart p.tex-abstract{font-size:1em;margin:0}
.tex-cls-acmart .tex-secnum{margin-right:1em}
.tex-cls-acmart .tex-bibitem{font-size:.8em}
/* IEEEtran */
.tex-cls-ieeetran{--tex-indent:1em}
.tex-cls-ieeetran h1.tex-title{font-weight:normal;font-size:2.4em}
.tex-cls-ieeetran h2{font-size:1em;font-weight:normal;font-variant:small-caps;text-align:center;margin:.9em 0 .3em}
.tex-cls-ieeetran h3{font-size:1em;font-weight:normal;font-style:italic}
.tex-cls-ieeetran .tex-secnum{margin-right:.5em}
.tex-cls-ieeetran .tex-abstract-title{display:none}
.tex-cls-ieeetran p.tex-abstract{font-weight:bold;font-size:.9em;margin:0}
.tex-cls-ieeetran .tex-abstract-title+p.tex-abstract::before{content:"Abstract\\2014";font-style:italic}
/* page view */
html.tex-paged-root{background:#d6d6d6}
body.tex-pending{visibility:hidden}
body.tex-paged{max-width:none;margin:0;padding:16px 0;background:#d6d6d6;font-size:var(--tex-fs);line-height:var(--tex-lh);word-spacing:-.04em}
.tex-page{position:relative;margin:0 auto 16px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3);overflow:hidden}
.tex-page-body{position:absolute}
.tex-columns{display:flex;align-items:flex-start}
.tex-column{flex:none}
.tex-column>:first-child{margin-top:0}
.tex-page-number{position:absolute;left:0;right:0;text-align:center}
body.tex-paged .tex-titleblock{margin:0}
body.tex-paged ul,body.tex-paged ol{margin:.2em 0}
body.tex-paged .tex-float{margin:0 0 .8em}
@media (max-width:600px){body:not(.tex-paged){padding:1.25rem 1rem;font-size:16px}p.tex-abstract{margin:0}}
@media print{body:not(.tex-paged){padding:0;max-width:none}html.tex-paged-root{zoom:1!important;background:#fff}body.tex-paged{padding:0;background:#fff}.tex-page{margin:0;box-shadow:none;break-after:page}}
`;

const FONT_CSS = [
  libertinusSerif400,
  libertinusSerif400Italic,
  libertinusSerif700,
  libertinusSerif700Italic,
  libertinusSans400,
  libertinusSans700,
  tinos400,
  tinos400Italic,
  tinos700,
  tinos700Italic,
].join("\n");

type ViewMode = "pages" | "continuous";

type TikzSvgs = Record<string, string | null>;

/** Replaces TikZ placeholders with compiled SVGs, or a status box. */
function insertTikz(body: string, jobs: TikzJob[], svgs: TikzSvgs) {
  return body.replace(
    /<div class="tex-tikz" data-tikz="(\d+)"><\/div>/g,
    (match, index: string) => {
      const job = jobs[Number(index)];
      if (!job) return match;
      const svg = svgs[job.key];
      if (svg) return `<div class="tex-tikz">${svg}</div>`;
      if (svg === null) {
        return '<div class="tex-placeholder">TikZ diagram could not be rendered</div>';
      }
      return '<div class="tex-placeholder tex-tikz-loading">Rendering TikZ diagram\u2026</div>';
    },
  );
}

/** Wraps rendered body HTML in a standalone, styled HTML document. */
function buildHtmlDocument(
  body: string,
  title: string,
  layout: DocLayout,
  mode: ViewMode,
  hasTikz = false,
) {
  const escapedTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paged = mode === "pages";
  const bodyClass = `tex-fam-${layout.family} tex-cls-${layout.docClass.replace(/[^a-z0-9-]/g, "")}`;
  const bodyStyle = `--tex-fs:${layout.fontSize}pt;--tex-lh:${layout.baselineSkip}pt`;
  return `<!DOCTYPE html>
<html lang="en"${paged ? ' class="tex-paged-root"' : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapedTitle || "LaTeX document"}</title>
<base target="_blank">
${hasTikz ? `<link rel="stylesheet" href="${window.location.origin}/tikzjax/fonts.css">` : ""}
<style>${FONT_CSS}${katexCss}${DOCUMENT_CSS}</style>
</head>
<body class="${bodyClass}${paged ? " tex-pending" : ""}" style="${bodyStyle}">${body}</body>
</html>`;
}

/** Serialises the preview frame for download, with absolute asset URLs. */
function serializeDocument(doc: Document) {
  const root = doc.documentElement.cloneNode(true) as HTMLElement;
  root.style.removeProperty("zoom");
  if (!root.getAttribute("style")) root.removeAttribute("style");
  return `<!DOCTYPE html>\n${root.outerHTML}`.replace(
    /url\((['"]?)\//g,
    `url($1${window.location.origin}/`,
  );
}

function loadSource(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved;
  } catch {
    /* ignore */
  }
  return TEMPLATES.article.source;
}

function saveSource(source: string) {
  try {
    localStorage.setItem(STORAGE_KEY, source);
  } catch {
    /* ignore */
  }
}

function loadViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === "continuous" ? "continuous" : "pages";
  } catch {
    return "pages";
  }
}

function baseFileName(name: string) {
  return name.replace(/\.[^.]+$/, "") || "document";
}

export default function TexViewer() {
  const [source, setSource] = useState<string>(loadSource);
  const [template, setTemplate] = useState<TemplateId | "">("");
  const [fileName, setFileName] = useState("document");
  const [autoRender, setAutoRender] = useState(true);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [tikzSvgs, setTikzSvgs] = useState<TikzSvgs>({});
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { error, success, setError, setSuccess, clear } = useToolStatus();

  const rendererRef = useRef<RendererModule | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewRootRef = useRef<HTMLDivElement | null>(null);
  const renderIdRef = useRef(0);
  const scrollRef = useRef(0);
  const loadIdRef = useRef(0);

  const html = useMemo(
    () =>
      result
        ? buildHtmlDocument(
            insertTikz(result.html, result.tikz, tikzSvgs),
            result.title,
            result.layout,
            viewMode,
            result.tikz.length > 0,
          )
        : "",
    [result, viewMode, tikzSvgs],
  );
  const pendingDiagrams = result
    ? new Set(result.tikz.filter((job) => !(job.key in tikzSvgs)).map((job) => job.key)).size
    : 0;

  // Compile TikZ pictures in the background; the preview updates as each
  // one finishes.
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    for (const job of result.tikz) {
      if (job.key in tikzSvgs) continue;
      void renderTikz(job).then((svg) => {
        if (cancelled) return;
        setTikzSvgs((prev) => (job.key in prev ? prev : { ...prev, [job.key]: svg }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [result, tikzSvgs]);
  const notes = result?.notes ?? [];

  const render = useCallback(async (latexSource: string) => {
    const renderId = ++renderIdRef.current;
    if (!latexSource.trim()) {
      setResult(null);
      setRenderError(null);
      setRenderMs(null);
      setRendering(false);
      return;
    }
    setRendering(true);
    try {
      if (!rendererRef.current) {
        rendererRef.current = await import("../utils/texToHtml");
      }
      const started = performance.now();
      const rendered = rendererRef.current.texToHtml(latexSource);
      if (renderId !== renderIdRef.current) return;
      setResult(rendered);
      setRenderError(null);
      setRenderMs(Math.round(performance.now() - started));
    } catch (err) {
      if (renderId !== renderIdRef.current) return;
      setRenderError(
        err instanceof Error ? err.message : "Could not render this document.",
      );
    } finally {
      if (renderId === renderIdRef.current) setRendering(false);
    }
  }, []);

  // Lays the preview out on pages once it has loaded, then restores the
  // reader's scroll position.
  const handlePreviewLoad = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    const frame = iframeRef.current;
    const doc = frame?.contentDocument;
    const win = frame?.contentWindow;
    if (!doc || !win || !result) return;
    const restoreScroll = () => {
      win.scrollTo(0, scrollRef.current);
      win.addEventListener("scroll", () => {
        scrollRef.current = win.scrollY;
      });
    };
    if (viewMode !== "pages") {
      setPageCount(null);
      restoreScroll();
      return;
    }
    // Measure at full size with the fonts the page view uses.
    doc.documentElement.style.zoom = "1";
    void doc.body.offsetHeight;
    const family =
      result.layout.family === "acm"
        ? "Libertinus Serif"
        : result.layout.family === "times"
          ? "Tinos"
          : "Libertinus Serif";
    try {
      await Promise.all([
        doc.fonts.load(`400 12px "${family}"`),
        doc.fonts.load(`700 12px "${family}"`),
        doc.fonts.load(`italic 400 12px "${family}"`),
        doc.fonts.load(`700 12px "Libertinus Sans"`),
      ]);
      await doc.fonts.ready;
    } catch {
      /* lay out with whatever fonts are available */
    }
    if (loadId !== loadIdRef.current || frame.contentDocument !== doc) return;
    const pages = paginate(doc, result.layout);
    fitPagesToWidth(doc, result.layout);
    doc.body.classList.remove("tex-pending");
    setPageCount(pages);
    restoreScroll();
  }, [result, viewMode]);

  // Keep the pages scaled to the preview width.
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || viewMode !== "pages" || !result) return;
    const observer = new ResizeObserver(() => {
      const doc = frame.contentDocument;
      if (doc?.body?.classList.contains("tex-paged")) {
        fitPagesToWidth(doc, result.layout);
      }
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [viewMode, result]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    scrollRef.current = 0;
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  // Live preview: re-render shortly after the user stops typing.
  useEffect(() => {
    saveSource(source);
    if (!autoRender) return;
    const timer = window.setTimeout(() => {
      void render(source);
    }, RENDER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [source, autoRender, render]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(
        Boolean(
          previewRootRef.current &&
            document.fullscreenElement === previewRootRef.current,
        ),
      );
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleTemplateChange = (value: TemplateId) => {
    setTemplate(value);
    setSource(TEMPLATES[value].source);
    setFileName("document");
    clear();
  };

  const handleFilesSelected = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    clear();
    if (file.size > MAX_FILE_BYTES) {
      setError("File is too large. Please choose a .tex file under 2 MB.");
      return;
    }
    try {
      const text = await file.text();
      setSource(text);
      setTemplate("");
      setFileName(baseFileName(file.name));
      setSuccess(`Loaded ${file.name}.`);
    } catch {
      setError("Could not read the selected file.");
    }
  };

  const handleDownloadTex = () => {
    clear();
    downloadBlob(
      new Blob([source], { type: "application/x-tex;charset=utf-8" }),
      `${fileName}.tex`,
    );
  };

  const handleDownloadHtml = () => {
    clear();
    const doc = iframeRef.current?.contentDocument;
    if (!result || !doc?.body) {
      setError("Render the document before downloading HTML.");
      return;
    }
    const documentHtml = serializeDocument(doc);
    downloadBlob(
      new Blob([documentHtml], { type: "text/html;charset=utf-8" }),
      `${fileName}.html`,
    );
  };

  const handlePrint = () => {
    clear();
    const frameWindow = iframeRef.current?.contentWindow;
    if (!html || renderError || !frameWindow) {
      setError("Render the document before printing.");
      return;
    }
    frameWindow.focus();
    frameWindow.print();
  };

  const handleFullscreen = async () => {
    clear();
    const el = previewRootRef.current;
    if (!el?.requestFullscreen) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      setError("Fullscreen request was blocked by the browser.");
    }
  };

  const handleClear = () => {
    clear();
    setSource("");
    setTemplate("");
    setFileName("document");
    setResult(null);
    setRenderError(null);
    setRenderMs(null);
  };

  const lineCount = source ? source.split("\n").length : 0;

  return (
    <PageContainer maxWidth={1400}>
      <Stack spacing={2}>
        <FlexWrapRow sx={{ alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="tex-template-label">Template</InputLabel>
            <Select
              labelId="tex-template-label"
              label="Template"
              value={template}
              onChange={(e) => handleTemplateChange(e.target.value as TemplateId)}
            >
              {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => (
                <MenuItem key={id} value={id}>
                  {TEMPLATES[id].label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FilePickerButton
            variant="outlined"
            label="Open .tex file"
            accept=".tex,.latex,.ltx,text/x-tex,text/plain"
            onFilesSelected={handleFilesSelected}
            resetAfterSelect
            sx={{ textTransform: "none" }}
          />
          <TransparentButton label="Download .tex" onClick={handleDownloadTex} />
          <TransparentButton label="Clear" onClick={handleClear} />
          <Box sx={{ flex: 1 }} />
          <FormControlLabel
            control={
              <Switch
                checked={autoRender}
                onChange={(e) => setAutoRender(e.target.checked)}
              />
            }
            label="Live preview"
          />
          <ActionButton
            onClick={() => void render(source)}
            loading={rendering && !autoRender}
          >
            Render
          </ActionButton>
        </FlexWrapRow>

        <ToolStatusAlerts error={error} success={success} />

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <TextField
              label="LaTeX source"
              placeholder="\documentclass{article} ..."
              value={source}
              onChange={(e) => setSource(e.target.value)}
              multiline
              fullWidth
              spellCheck={false}
              InputProps={{
                sx: {
                  alignItems: "flex-start",
                  "& textarea": {
                    height: `${EDITOR_HEIGHT}px !important`,
                    overflow: "auto !important",
                    fontFamily: MONOSPACE,
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: "pre",
                  },
                },
              }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.5 }}
            >
              {lineCount} lines · {source.length} characters
            </Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              ref={previewRootRef}
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                "&:fullscreen": { p: 2, bgcolor: "background.default" },
              }}
            >
              <ToggleButtonGroup
                size="small"
                exclusive
                value={viewMode}
                onChange={(_e, mode: ViewMode | null) => {
                  if (mode) handleViewModeChange(mode);
                }}
                aria-label="Preview layout"
                sx={{ alignSelf: "flex-start" }}
              >
                <ToggleButton value="pages" sx={{ textTransform: "none", px: 1.5 }}>
                  Pages
                </ToggleButton>
                <ToggleButton value="continuous" sx={{ textTransform: "none", px: 1.5 }}>
                  Continuous
                </ToggleButton>
              </ToggleButtonGroup>
              <ToolStatusAlerts
                error={renderError ?? ""}
                info={
                  notes.length && !renderError
                    ? `Not everything could be shown in the preview: ${notes.join("; ")}.`
                    : ""
                }
              />
              <Box
                sx={{
                  position: "relative",
                  height: isFullscreen ? "calc(100vh - 120px)" : EDITOR_HEIGHT + 17,
                  borderRadius: 1,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.12)",
                  bgcolor: viewMode === "pages" ? "#d6d6d6" : "#fff",
                  opacity: renderError ? 0.6 : 1,
                }}
              >
                {html ? (
                  <Box
                    component="iframe"
                    ref={iframeRef}
                    title="LaTeX preview"
                    srcDoc={html}
                    onLoad={() => void handlePreviewLoad()}
                    sandbox="allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox"
                    sx={{ width: "100%", height: "100%", border: 0 }}
                  />
                ) : (
                  <Box
                    sx={{
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#666",
                      p: 3,
                      textAlign: "center",
                    }}
                  >
                    <Typography variant="body2">
                      {rendering
                        ? "Rendering…"
                        : "Your rendered document will appear here."}
                    </Typography>
                  </Box>
                )}
              </Box>
              <FlexWrapRow sx={{ alignItems: "center" }}>
                <Typography variant="caption" color="text.secondary">
                  {renderMs !== null && !renderError
                    ? `Rendered in ${renderMs} ms${
                        viewMode === "pages" && pageCount
                          ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}`
                          : ""
                      }${
                        pendingDiagrams
                          ? ` · rendering ${pendingDiagrams} diagram${pendingDiagrams === 1 ? "" : "s"}…`
                          : ""
                      }`
                    : ""}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <TransparentButton
                  label="Download HTML"
                  onClick={handleDownloadHtml}
                  size="small"
                />
                <TransparentButton
                  label="Print / Save as PDF"
                  onClick={handlePrint}
                  size="small"
                />
                <TransparentButton
                  label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  onClick={() => void handleFullscreen()}
                  size="small"
                />
              </FlexWrapRow>
            </Box>
          </Box>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          The preview is rendered in your browser and math is typeset with
          KaTeX. The page view follows the document class - paper size,
          margins, one or two columns and fonts close to acmart, IEEEtran and
          article - but line and page breaks can differ slightly from pdfLaTeX.
          TikZ pictures are compiled by TikZJax, a TeX engine that runs in
          your browser; the first diagram takes a few seconds while it loads.
          Images are shown as placeholders. For the exact PDF, compile the
          document with a full TeX distribution.
        </Typography>
      </Stack>
    </PageContainer>
  );
}
