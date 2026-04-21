import React, { useCallback, useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";

import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import StrikethroughSIcon from "@mui/icons-material/StrikethroughS";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatAlignJustifyIcon from "@mui/icons-material/FormatAlignJustify";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatColorTextIcon from "@mui/icons-material/FormatColorText";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import { TransparentButton } from "../components/buttons/TransparentButton";
import useToolStatus from "../hooks/useToolStatus";

const FONT_SIZES = ["10", "12", "14", "16", "18", "20", "24", "28", "32", "36", "48", "64"];
const FONT_FAMILIES = ["Arial", "Times New Roman", "Georgia", "Courier New", "Verdana", "Trebuchet MS"];
const TEXT_COLORS = ["#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#ffffff"];
const HIGHLIGHT_COLORS = ["transparent", "#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#fed7aa", "#e9d5ff"];

type PageSize = "a4" | "letter" | "legal";

const PAGE_SIZES: Record<PageSize, { width: number; height: number; label: string }> = {
  a4:     { width: 794,  height: 1123, label: "A4" },
  letter: { width: 816,  height: 1056, label: "Letter" },
  legal:  { width: 816,  height: 1344, label: "Legal" },
};

const INITIAL_HTML = `<h1 style="text-align:center">Document Title</h1><p>Start typing your document here. Use the toolbar above to apply formatting — bold, italic, underline, lists, alignment, font size, and more.</p><p><br></p>`;

function execFmt(command: string, value?: string) {
  document.execCommand(command, false, value);
}

const PdfBuilderContent: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const highlightInputRef = useRef<HTMLInputElement>(null);
  const { error, success, setError, setSuccess, clear } = useToolStatus();

  const [fontSize, setFontSize] = useState("14");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [fileName, setFileName] = useState("document");
  const [isExporting, setIsExporting] = useState(false);

  const applyFontSize = useCallback((size: string) => {
    setFontSize(size);
    execFmt("fontSize", "7");
    const editor = editorRef.current;
    if (!editor) return;
    const spans = editor.querySelectorAll<HTMLSpanElement>("font[size='7']");
    spans.forEach((span) => {
      span.removeAttribute("size");
      span.style.fontSize = `${size}px`;
    });
  }, []);

  const applyFontFamily = useCallback((family: string) => {
    setFontFamily(family);
    execFmt("fontName", family);
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!editor.innerText.trim()) {
      setError("The document is empty. Add some content before downloading.");
      return;
    }
    clear();
    setIsExporting(true);
    try {
      const { width, height } = PAGE_SIZES[pageSize];
      const canvas = await html2canvas(editor, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width,
        windowWidth: width,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [width, height],
      });
      const pageCount = Math.ceil(canvas.height / (height * 2));
      for (let i = 0; i < pageCount; i++) {
        if (i > 0) pdf.addPage();
        pdf.addImage(
          imgData,
          "PNG",
          0,
          -(i * height),
          width,
          canvas.height / 2,
        );
      }
      const name = fileName.trim() || "document";
      pdf.save(`${name}.pdf`);
      setSuccess("PDF downloaded successfully.");
    } catch {
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [pageSize, fileName, setError, setSuccess, clear]);

  const clearDocument = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
      editorRef.current.focus();
    }
    clear();
  }, [clear]);

  const { width: editorWidth, height: editorHeight } = PAGE_SIZES[pageSize];

  return (
    <Stack spacing={2.5}>
      {/* Controls row */}
      <Stack
        spacing={1.5}
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderRadius: 2,
          border: "1px solid rgba(59,130,246,0.35)",
          background:
            "linear-gradient(140deg, rgba(59,130,246,0.17) 0%, rgba(15,23,42,0.12) 55%, rgba(14,165,233,0.12) 100%)",
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} flexWrap="wrap" useFlexGap>
          <TextField
            label="File name"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            size="small"
            sx={{ width: 180 }}
          />
          <Select
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value as PageSize)}
            size="small"
            sx={{ minWidth: 110 }}
          >
            {(Object.keys(PAGE_SIZES) as PageSize[]).map((k) => (
              <MenuItem key={k} value={k}>{PAGE_SIZES[k].label}</MenuItem>
            ))}
          </Select>
          <Stack direction="row" spacing={1} sx={{ ml: { sm: "auto" } }}>
            <ActionButton
              startIcon={<DownloadIcon />}
              onClick={() => void handleDownloadPdf()}
              disabled={isExporting}
            >
              {isExporting ? "Exporting…" : "Download PDF"}
            </ActionButton>
            <TransparentButton
              label="Clear"
              onClick={clearDocument}
              startIcon={<DeleteOutlineIcon />}
            />
          </Stack>
        </Stack>

        {/* Formatting toolbar */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.5,
            alignItems: "center",
            p: 1,
            borderRadius: 1.5,
            bgcolor: "rgba(2,6,23,0.35)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          {/* Font family */}
          <Select
            value={fontFamily}
            onChange={(e) => applyFontFamily(e.target.value)}
            size="small"
            variant="outlined"
            sx={{ height: 32, minWidth: 140, fontSize: 13 }}
          >
            {FONT_FAMILIES.map((f) => (
              <MenuItem key={f} value={f} sx={{ fontFamily: f, fontSize: 13 }}>{f}</MenuItem>
            ))}
          </Select>

          {/* Font size */}
          <Select
            value={fontSize}
            onChange={(e) => applyFontSize(e.target.value)}
            size="small"
            variant="outlined"
            sx={{ height: 32, width: 72, fontSize: 13 }}
          >
            {FONT_SIZES.map((s) => (
              <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>{s}</MenuItem>
            ))}
          </Select>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* Basic formatting */}
          <Tooltip title="Bold (Ctrl+B)">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); execFmt("bold"); }}>
              <FormatBoldIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Italic (Ctrl+I)">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); execFmt("italic"); }}>
              <FormatItalicIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Underline (Ctrl+U)">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); execFmt("underline"); }}>
              <FormatUnderlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Strikethrough">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); execFmt("strikeThrough"); }}>
              <StrikethroughSIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* Headings */}
          {(["H1", "H2", "H3"] as const).map((h) => (
            <Tooltip key={h} title={`Heading ${h.slice(1)}`}>
              <IconButton
                size="small"
                onMouseDown={(e) => { e.preventDefault(); execFmt("formatBlock", h); }}
                sx={{ fontSize: 11, fontWeight: 700, width: 28, height: 28 }}
              >
                {h}
              </IconButton>
            </Tooltip>
          ))}
          <Tooltip title="Normal paragraph">
            <IconButton
              size="small"
              onMouseDown={(e) => { e.preventDefault(); execFmt("formatBlock", "P"); }}
              sx={{ fontSize: 11, width: 28, height: 28 }}
            >
              P
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* Alignment */}
          <Tooltip title="Align left">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); execFmt("justifyLeft"); }}>
              <FormatAlignLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Align center">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); execFmt("justifyCenter"); }}>
              <FormatAlignCenterIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Align right">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); execFmt("justifyRight"); }}>
              <FormatAlignRightIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Justify">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); execFmt("justifyFull"); }}>
              <FormatAlignJustifyIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* Lists */}
          <Tooltip title="Bullet list">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); execFmt("insertUnorderedList"); }}>
              <FormatListBulletedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Numbered list">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); execFmt("insertOrderedList"); }}>
              <FormatListNumberedIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* Text color */}
          <Tooltip title="Text color">
            <Box sx={{ position: "relative" }}>
              <IconButton
                size="small"
                onMouseDown={(e) => { e.preventDefault(); colorInputRef.current?.click(); }}
              >
                <FormatColorTextIcon fontSize="small" />
              </IconButton>
              <input
                ref={colorInputRef}
                type="color"
                defaultValue="#000000"
                style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
                onChange={(e) => execFmt("foreColor", e.target.value)}
              />
            </Box>
          </Tooltip>

          {/* Quick color swatches */}
          <Stack direction="row" spacing={0.25} alignItems="center">
            {TEXT_COLORS.map((c) => (
              <Box
                key={c}
                onMouseDown={(e) => { e.preventDefault(); execFmt("foreColor", c); }}
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  bgcolor: c,
                  border: "1px solid rgba(148,163,184,0.4)",
                  cursor: "pointer",
                  "&:hover": { transform: "scale(1.2)" },
                  transition: "transform 0.1s",
                  flexShrink: 0,
                }}
              />
            ))}
          </Stack>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* Highlight swatches */}
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
            BG
          </Typography>
          <Stack direction="row" spacing={0.25} alignItems="center">
            {HIGHLIGHT_COLORS.map((c) => (
              <Box
                key={c}
                onMouseDown={(e) => {
                  e.preventDefault();
                  execFmt("hiliteColor", c === "transparent" ? "transparent" : c);
                }}
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  bgcolor: c === "transparent" ? "rgba(148,163,184,0.2)" : c,
                  border: "1px solid rgba(148,163,184,0.4)",
                  cursor: "pointer",
                  "&:hover": { transform: "scale(1.2)" },
                  transition: "transform 0.1s",
                  flexShrink: 0,
                }}
              />
            ))}
          </Stack>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* Undo / Redo */}
          <Tooltip title="Undo (Ctrl+Z)">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); execFmt("undo"); }}>
              <UndoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Redo (Ctrl+Y)">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); execFmt("redo"); }}>
              <RedoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Stack>

      <ToolStatusAlerts error={error} success={success} />

      {/* Page canvas */}
      <Box
        sx={{
          overflowX: "auto",
          display: "flex",
          justifyContent: "center",
          pb: 2,
        }}
      >
        <Box
          sx={{
            width: editorWidth,
            minHeight: editorHeight,
            flexShrink: 0,
            boxShadow: "0 4px 32px rgba(0,0,0,0.45)",
            borderRadius: 1,
          }}
        >
          <Box
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: INITIAL_HTML }}
            onFocus={() => {
              const editor = editorRef.current;
              if (editor && editor.innerHTML === INITIAL_HTML) {
                execFmt("selectAll");
                execFmt("delete");
                editor.innerHTML = INITIAL_HTML;
              }
            }}
            sx={{
              width: editorWidth,
              minHeight: editorHeight,
              bgcolor: "#ffffff",
              color: "#111827",
              p: "48px 64px",
              boxSizing: "border-box",
              outline: "none",
              fontFamily: fontFamily,
              fontSize: `${fontSize}px`,
              lineHeight: 1.7,
              "& h1": { fontSize: "2em", fontWeight: 700, margin: "0.5em 0" },
              "& h2": { fontSize: "1.5em", fontWeight: 700, margin: "0.5em 0" },
              "& h3": { fontSize: "1.25em", fontWeight: 700, margin: "0.5em 0" },
              "& p": { margin: "0.4em 0" },
              "& ul, & ol": { paddingLeft: "2em", margin: "0.4em 0" },
              "& li": { margin: "0.15em 0" },
            }}
          />
        </Box>
      </Box>
    </Stack>
  );
};

const PdfBuilder: React.FC = () => {
  return (
    <PageContainer maxWidth={1000}>
      <PdfBuilderContent />
    </PageContainer>
  );
};

export default PdfBuilder;
