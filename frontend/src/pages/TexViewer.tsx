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

// latex.js ships its stylesheets and fonts separately from the parser; they are
// loaded from a CDN pinned to the installed version so the preview matches it.
const LATEXJS_ASSETS_BASE = "https://cdn.jsdelivr.net/npm/latex.js@0.12.6/dist/";

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

\title{A Short Guide to \LaTeX}
\author{Torensa}
\date{\today}

\begin{document}

\maketitle

\begin{abstract}
This document shows how the TeX Viewer renders sections, lists,
text formatting and mathematics directly in your browser.
\end{abstract}

\section{Introduction}
\LaTeX{} is a document preparation system used for scientific papers,
theses and books. You can write \textbf{bold}, \textit{italic},
\underline{underlined} and \texttt{monospaced} text, or change the
size from {\small small} to {\large large}.

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

The quadratic formula is
\begin{equation}
  x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}.
\end{equation}

Multi-line derivations use \texttt{align}:
\begin{align*}
  (a+b)^2 &= (a+b)(a+b) \\
          &= a^2 + 2ab + b^2.
\end{align*}

\section{Quotes}
\begin{quote}
  Simplicity is prerequisite for reliability.
\end{quote}

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

type LatexModule = typeof import("latex.js");

type RenderError = {
  message: string;
  line?: number;
  column?: number;
};

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

// amsmath display environments that latex.js does not know, mapped to the
// KaTeX environment used inside \[ ... \] (null keeps the body as-is).
const DISPLAY_MATH_ENVS: Record<string, string | null> = {
  equation: null,
  align: "aligned",
  gather: "gathered",
  multline: "gathered",
};

const DISPLAY_MATH_ENV_PATTERN =
  /\\begin\{(equation|align|gather|multline)(\*?)\}([\s\S]*?)\\end\{\1\2\}/g;

/**
 * Rewrites amsmath display environments into \[ ... \] blocks that latex.js
 * renders with KaTeX. Line breaks are preserved so error positions still match
 * the editor. Equation numbers and labels are dropped.
 */
function rewriteDisplayMath(source: string): string {
  return source.replace(
    DISPLAY_MATH_ENV_PATTERN,
    (_match, env: string, _star: string, body: string) => {
      const inner = body.replace(/\\(label\{[^}]*\}|nonumber|notag)/g, "");
      const katexEnv = DISPLAY_MATH_ENVS[env];
      return katexEnv
        ? `\\[\\begin{${katexEnv}}${inner}\\end{${katexEnv}}\\]`
        : `\\[${inner}\\]`;
    },
  );
}

/** Renders LaTeX source into a complete standalone HTML document string. */
function renderLatexToHtml(latex: LatexModule, source: string): string {
  const generator = new latex.HtmlGenerator({ hyphenate: false });
  const doc = latex.parse(rewriteDisplayMath(source), { generator }).htmlDocument(
    LATEXJS_ASSETS_BASE,
  );

  // The preview iframe does not run scripts, so drop latex.js's helper script.
  doc.querySelectorAll("script").forEach((script) => script.remove());

  // Open links in a new tab instead of navigating the preview frame.
  const base = doc.createElement("base");
  base.target = "_blank";
  doc.head.prepend(base);

  const style = doc.createElement("style");
  style.textContent =
    "html{background:#fff;color:#000}body{margin:0 auto;padding:2rem 1.5rem}" +
    "@media print{body{padding:0}}";
  doc.head.appendChild(style);

  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

function toRenderError(err: unknown): RenderError {
  const location = (err as { location?: RenderError & { start?: RenderError } })
    ?.location?.start;
  const message =
    err instanceof Error ? err.message : String(err ?? "Unknown error");
  return {
    message,
    line: location?.line,
    column: location?.column,
  };
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
  const [renderError, setRenderError] = useState<RenderError | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { error, success, setError, setSuccess, clear } = useToolStatus();

  const latexRef = useRef<LatexModule | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewRootRef = useRef<HTMLDivElement | null>(null);
  const renderIdRef = useRef(0);

  const render = useCallback(async (latexSource: string) => {
    const renderId = ++renderIdRef.current;
    if (!latexSource.trim()) {
      setHtml("");
      setRenderError(null);
      setRenderMs(null);
      setRendering(false);
      return;
    }
    setRendering(true);
    try {
      if (!latexRef.current) {
        latexRef.current = await import("latex.js");
      }
      const started = performance.now();
      const output = renderLatexToHtml(latexRef.current, latexSource);
      if (renderId !== renderIdRef.current) return;
      setHtml(output);
      setRenderError(null);
      setRenderMs(Math.round(performance.now() - started));
    } catch (err) {
      if (renderId !== renderIdRef.current) return;
      setRenderError(toRenderError(err));
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
    if (!html || renderError) {
      setError("Fix the errors in your document before downloading HTML.");
      return;
    }
    downloadBlob(
      new Blob([html], { type: "text/html;charset=utf-8" }),
      `${fileName}.html`,
    );
  };

  const handlePrint = () => {
    clear();
    const frameWindow = iframeRef.current?.contentWindow;
    if (!html || renderError || !frameWindow) {
      setError("Fix the errors in your document before printing.");
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
              {renderError && (
                <ToolStatusAlerts
                  error={
                    renderError.line
                      ? `Line ${renderError.line}, column ${renderError.column}: ${renderError.message}`
                      : renderError.message
                  }
                />
              )}
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
          Rendering happens in your browser with latex.js. It supports common
          LaTeX (sections, lists, formatting and KaTeX math, including equation and
          align blocks) but not every package - documents that need tables,
          footnotes, TikZ, BibTeX or custom classes should be compiled with a
          full TeX distribution.
        </Typography>
      </Stack>
    </PageContainer>
  );
}
