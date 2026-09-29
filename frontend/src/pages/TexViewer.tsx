import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
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
import katexCss from "katex/dist/katex.min.css?inline";

const STORAGE_KEY = "torensa_tex_viewer_source";
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

// Styles for the rendered document inside the preview frame.
const DOCUMENT_CSS = `
:root{--tex-serif:"Latin Modern Roman","CMU Serif",Georgia,Cambria,"Times New Roman",serif;--tex-sans:"Helvetica Neue",Arial,sans-serif;--tex-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
html{background:#fff;color:#111}
body{margin:0 auto;max-width:46em;padding:2.5rem 2rem;font-family:var(--tex-serif);font-size:17px;line-height:1.5;text-align:justify;hyphens:auto;overflow-wrap:break-word}
a{color:#1a4fb5}
code{font-family:var(--tex-mono);font-size:.88em}
h1.tex-title{font-size:1.75em;line-height:1.25;text-align:center;margin:0 0 .6em}
.tex-titleblock{margin-bottom:1.8em}
.tex-authors{display:flex;flex-wrap:wrap;justify-content:center;gap:.6em 2.5em;text-align:center}
.tex-author{display:flex;flex-direction:column}
.tex-affiliation,.tex-email{font-size:.9em}
.tex-aff-part+.tex-aff-part::before{content:", "}
.tex-date{text-align:center;margin-top:.6em}
.tex-abstract{margin:1.2em 2em;font-size:.95em}
.tex-abstract h2{font-size:1em;text-align:center;margin:0 0 .4em}
h2,h3,h4,h1.tex-part{text-align:left;line-height:1.3;margin:1.4em 0 .6em}
h2{font-size:1.3em}h3{font-size:1.12em}h4{font-size:1em}
.tex-secnum{margin-right:.8em}
.tex-par{display:block;height:.7em}
.tex-display{margin:.8em 0;overflow-x:auto;overflow-y:hidden}
.katex-display{margin:0}
.tex-float{margin:1.5em 0;text-align:center}
figcaption{margin:.6em auto;font-size:.92em;text-align:left;max-width:40em}
.tex-table-wrap{overflow-x:auto}
table.tex-tabular{border-collapse:collapse;margin:.5em auto;font-size:.95em;text-align:left}
.tex-tabular td{padding:.25em .6em;vertical-align:top}
.tex-rule-top-heavy td{border-top:2px solid #111}
.tex-rule-top-light td{border-top:1px solid #111}
.tex-rule-bottom-heavy td{border-bottom:2px solid #111}
.tex-rule-bottom-light td{border-bottom:1px solid #111}
.tex-placeholder{display:inline-block;padding:1em 1.5em;border:1px dashed #999;color:#666;background:#fafafa;font-family:var(--tex-sans);font-size:.8em}
blockquote{margin:1em 2.5em}
pre.tex-verbatim{font-family:var(--tex-mono);font-size:.85em;background:#f6f6f6;padding:.8em;overflow-x:auto;text-align:left}
ul,ol{padding-left:1.8em}
li.tex-custom-label{list-style:none}
.tex-item-label{font-weight:bold;margin-left:-1.2em}
dl.tex-description dt{font-weight:bold;float:left;margin-right:.5em}
dl.tex-description dd{margin:0 0 .4em 1.5em}
.tex-theorem,.tex-proof{margin:1em 0}
.tex-qed{float:right}
.tex-keywords,.tex-ccs{font-size:.92em}
.tex-bibliography ol{list-style:none;padding:0}
.tex-bibliography li{position:relative;padding-left:3em;margin:.4em 0;text-align:left;font-size:.95em}
.tex-bib-label{position:absolute;left:0}
.tex-footnotes{font-size:.85em;margin-top:2em}
.tex-fbox{border:1px solid #111;padding:0 .2em}
sup.tex-a{font-size:.75em;vertical-align:.3em;margin:0 -.15em 0 -.36em}
sub.tex-e{font-size:1em;vertical-align:-.5ex;margin:0 -.1em 0 -.15em}
@media (max-width:600px){body{padding:1.25rem 1rem;font-size:16px}.tex-abstract{margin:1em 0}}
@media print{body{padding:0;max-width:none}}
`;

/** Wraps rendered body HTML in a standalone, styled HTML document. */
function buildHtmlDocument(body: string, title: string, forDownload: boolean) {
  // KaTeX font URLs are root-relative; make them absolute for downloaded files.
  const css = forDownload
    ? katexCss.replace(/url\((['"]?)\//g, `url($1${window.location.origin}/`)
    : katexCss;
  const escapedTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapedTitle || "LaTeX document"}</title>
<base target="_blank">
<style>${css}${DOCUMENT_CSS}</style>
</head>
<body>${body}</body>
</html>`;
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

function baseFileName(name: string) {
  return name.replace(/\.[^.]+$/, "") || "document";
}

export default function TexViewer() {
  const [source, setSource] = useState<string>(loadSource);
  const [template, setTemplate] = useState<TemplateId | "">("");
  const [fileName, setFileName] = useState("document");
  const [autoRender, setAutoRender] = useState(true);
  const [html, setHtml] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { error, success, setError, setSuccess, clear } = useToolStatus();

  const rendererRef = useRef<RendererModule | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewRootRef = useRef<HTMLDivElement | null>(null);
  const renderIdRef = useRef(0);

  const render = useCallback(async (latexSource: string) => {
    const renderId = ++renderIdRef.current;
    if (!latexSource.trim()) {
      setHtml("");
      setNotes([]);
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
      const result = rendererRef.current.texToHtml(latexSource);
      if (renderId !== renderIdRef.current) return;
      setHtml(buildHtmlDocument(result.html, result.title, false));
      setNotes(result.notes);
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
    const result = rendererRef.current?.texToHtml(source);
    if (!result || !source.trim()) {
      setError("Render the document before downloading HTML.");
      return;
    }
    const documentHtml = buildHtmlDocument(result.html, result.title, true);
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
    setHtml("");
    setNotes([]);
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
                  bgcolor: "#fff",
                  opacity: renderError ? 0.6 : 1,
                }}
              >
                {html ? (
                  <Box
                    component="iframe"
                    ref={iframeRef}
                    title="LaTeX preview"
                    srcDoc={html}
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
                    ? `Rendered in ${renderMs} ms`
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
          KaTeX. It understands the structure most papers use - title block,
          sections, lists, tables, figures, citations and cross-references -
          and skips what it cannot show, such as TikZ drawings and images. For
          the exact PDF layout, compile the document with a full TeX
          distribution.
        </Typography>
      </Stack>
    </PageContainer>
  );
}
