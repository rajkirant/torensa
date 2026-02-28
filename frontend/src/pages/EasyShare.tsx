import React, { useEffect, useMemo, useRef, useState } from "react";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import RefreshIcon from "@mui/icons-material/Refresh";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DownloadIcon from "@mui/icons-material/Download";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import useToolStatus from "../hooks/useToolStatus";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

const CODE_LENGTH = 4;
const MAX_TEXT_LENGTH = 20000;
const MAX_FILE_SIZE = 10_485_760; // 10 MB per file
const MAX_FILES = 1;
const SHARE_DEBOUNCE_MS = 700;

const sanitizeCode = (value: string) =>
  value.replace(/\D/g, "").slice(0, CODE_LENGTH);

function getFileExt(name: string): string {
  const parts = name.split(".");
  return parts.length > 1
    ? parts[parts.length - 1].toUpperCase().slice(0, 4)
    : "FILE";
}

function getExtColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext))
    return "#10b981";
  if (["pdf"].includes(ext)) return "#ef4444";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "#f59e0b";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "#8b5cf6";
  if (["mp3", "wav", "flac", "aac"].includes(ext)) return "#ec4899";
  if (
    [
      "js",
      "ts",
      "tsx",
      "jsx",
      "py",
      "java",
      "go",
      "rs",
      "css",
      "html",
    ].includes(ext)
  )
    return "#3b82f6";
  if (["xls", "xlsx", "csv"].includes(ext)) return "#22c55e";
  if (["doc", "docx", "txt", "md"].includes(ext)) return "#64748b";
  return "#94a3b8";
}

// ── File Canvas Card ────────────────────────────────────────────────────────

type FileCardProps = {
  file: File;
  index: number;
  total: number;
  onRemove: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
};

const FileCard: React.FC<FileCardProps> = ({
  file,
  index,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const ext = getFileExt(file.name);
  const color = getExtColor(file.name);
  const sizeLabel =
    file.size >= 1_048_576
      ? `${(file.size / 1_048_576).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

  return (
    <Box
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.75,
        p: 1.5,
        borderRadius: 2,
        border: "1px solid rgba(148,163,184,0.2)",
        bgcolor: "rgba(15,23,42,0.4)",
        cursor: "grab",
        userSelect: "none",
        width: 110,
        transition: "border-color 0.15s, box-shadow 0.15s",
        "&:hover": {
          borderColor: "rgba(148,163,184,0.45)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        },
        "&:active": { cursor: "grabbing" },
      }}
    >
      {/* Remove button */}
      <IconButton
        size="small"
        onClick={() => onRemove(index)}
        sx={{
          position: "absolute",
          top: 4,
          right: 4,
          width: 20,
          height: 20,
          bgcolor: "rgba(0,0,0,0.55)",
          color: "#f87171",
          "&:hover": { bgcolor: "rgba(239,68,68,0.25)" },
        }}
      >
        <CloseIcon sx={{ fontSize: 12 }} />
      </IconButton>

      {/* Drag handle */}
      <DragIndicatorIcon
        sx={{
          position: "absolute",
          top: 5,
          left: 4,
          fontSize: 14,
          opacity: 0.35,
        }}
      />

      {/* File type badge */}
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: 1.5,
          bgcolor: `${color}22`,
          border: `1.5px solid ${color}55`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.25,
        }}
      >
        <InsertDriveFileIcon sx={{ fontSize: 20, color }} />
        <Typography sx={{ fontSize: 9, fontWeight: 700, color, lineHeight: 1 }}>
          {ext}
        </Typography>
      </Box>

      {/* File name */}
      <Tooltip title={file.name} placement="bottom" enterDelay={600}>
        <Typography
          variant="caption"
          sx={{
            maxWidth: 96,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "center",
            lineHeight: 1.3,
            fontSize: "0.68rem",
          }}
        >
          {file.name}
        </Typography>
      </Tooltip>

      {/* File size */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: "0.62rem" }}
      >
        {sizeLabel}
      </Typography>
    </Box>
  );
};

// ── Drop Zone ───────────────────────────────────────────────────────────────

type DropZoneProps = {
  onFiles: (files: File[]) => void;
  disabled: boolean;
  remaining: number;
};

const DropZone: React.FC<DropZoneProps> = ({
  onFiles,
  disabled,
  remaining,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files).slice(0, remaining);
    if (files.length) onFiles(files);
  };

  return (
    <Box
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        p: 2.5,
        borderRadius: 2,
        border: `2px dashed ${dragOver ? "rgba(59,130,246,0.7)" : "rgba(148,163,184,0.3)"}`,
        bgcolor: dragOver ? "rgba(59,130,246,0.07)" : "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "border-color 0.15s, background 0.15s",
        "&:hover": !disabled ? { borderColor: "rgba(148,163,184,0.55)" } : {},
      }}
    >
      <UploadFileIcon sx={{ fontSize: 30, opacity: 0.5 }} />
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {disabled
          ? "File slot full — remove the current file to select a new one"
          : "Drop a file here or click to browse"}
      </Typography>
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, remaining);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </Box>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────

const TextShareContent: React.FC = () => {
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [receivedFileInfo, setReceivedFileInfo] = useState<{
    name: string;
    size: number;
    contentType: string;
  } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileShared, setFileShared] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [lastSharedText, setLastSharedText] = useState("");
  const skipShareRef = useRef(false);
  const shareTimerRef = useRef<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const { error, success, info, setError, setSuccess, setInfo, clear } =
    useToolStatus();

  const remainingChars = useMemo(
    () => `${text.length}/${MAX_TEXT_LENGTH} characters`,
    [text.length],
  );

  // ── Sharing ────────────────────────────────────────────────────────────────

  const shareContent = async (value: string, files: File[]) => {
    const hasText = Boolean(value.trim());
    const hasFiles = files.length > 0;

    if (!hasText && !hasFiles) {
      setError("Enter text or select files to share.");
      return;
    }

    setIsSharing(true);
    clear();

    try {
      const formData = new FormData();
      if (hasText) formData.append("text", value);

      if (hasFiles) {
        formData.append("file", files[0]);
      }

      const res = await apiFetch("/api/text-share/", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Unable to generate a code.");
        return;
      }

      setCode(String(data.code || ""));
      setExpiresAt(data.expiresAt || null);
      setReceivedFileInfo(data.file || null);
      setLastSharedText(value);
      setFileShared(Boolean(data.file));
      setSuccess("Code generated. Share it with the other device.");
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setIsSharing(false);
    }
  };

  // ── Fetching ───────────────────────────────────────────────────────────────

  const fetchText = async (value: string) => {
    if (value.length !== CODE_LENGTH) {
      setError("Enter a 4-digit code.");
      return;
    }
    setIsFetching(true);
    clear();
    try {
      const res = await apiFetch(`/api/text-share/${value}/`, {
        method: "GET",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Code not found or expired.");
        return;
      }
      skipShareRef.current = true;
      setText(String(data.text || ""));
      setExpiresAt(data.expiresAt || null);
      setReceivedFileInfo(data.file || null);
      setSelectedFiles([]);
      setFileShared(Boolean(data.file));
      setSuccess("Text loaded from the shared code.");
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setIsFetching(false);
    }
  };

  const fetchLatestByIp = async () => {
    setIsFetching(true);
    try {
      const res = await apiFetch("/api/text-share/latest/", { method: "GET" });
      const data = await res.json().catch(() => null);
      if (!res.ok) return;
      skipShareRef.current = true;
      setCode(String(data.code || ""));
      setText(String(data.text || ""));
      setExpiresAt(data.expiresAt || null);
      setReceivedFileInfo(data.file || null);
      setSelectedFiles([]);
      setFileShared(Boolean(data.file));
      setSuccess("Loaded the latest shared text for this network.");
    } catch {
      // Silent fail
    } finally {
      setIsFetching(false);
    }
  };

  const downloadSharedFile = async () => {
    if (code.length !== CODE_LENGTH || !receivedFileInfo) return;
    clear();
    setIsFetching(true);
    try {
      const res = await apiFetch(`/api/text-share/file/${code}/download/`, {
        method: "GET",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Unable to download file.");
        return;
      }
      const blob = await res.blob();
      downloadBlob(blob, receivedFileInfo.name || "shared-file");
      setSuccess("File downloaded.");
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setIsFetching(false);
    }
  };

  // ── Auto-share on text change ──────────────────────────────────────────────

  useEffect(() => {
    if (shareTimerRef.current) window.clearTimeout(shareTimerRef.current);

    if (skipShareRef.current) {
      skipShareRef.current = false;
      return;
    }

    const hasText = Boolean(text.trim());
    const hasFiles = selectedFiles.length > 0;

    if (
      (!hasText && !hasFiles) ||
      (hasText && !hasFiles && text === lastSharedText)
    ) {
      if (!hasText && !hasFiles) {
        setCode("");
        setExpiresAt(null);
        setLastSharedText("");
        setReceivedFileInfo(null);
      }
      return;
    }

    shareTimerRef.current = window.setTimeout(() => {
      void shareContent(text, selectedFiles);
    }, SHARE_DEBOUNCE_MS);

    return () => {
      if (shareTimerRef.current) window.clearTimeout(shareTimerRef.current);
    };
  }, [text, lastSharedText, selectedFiles]);

  useEffect(() => {
    void fetchLatestByIp();
  }, []);

  // ── File handlers ──────────────────────────────────────────────────────────

  const addFiles = (incoming: File[]) => {
    const oversized = incoming.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length) {
      setError(`${oversized[0].name} exceeds 10 MB limit.`);
      return;
    }
    setSelectedFiles((prev) => {
      const combined = [...prev, ...incoming];
      return combined.slice(0, MAX_FILES);
    });
    setFileShared(false);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileShared(false);
  };

  // ── Drag-to-reorder handlers ───────────────────────────────────────────────

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, _index: number) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || fromIndex === targetIndex) return;
    setSelectedFiles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    dragIndexRef.current = null;
  };

  // ── Code input handler ─────────────────────────────────────────────────────

  const handleCodeChange = (value: string) => {
    const next = sanitizeCode(value);
    setCode(next);
    setError();
    setSuccess();
    if (next.length === CODE_LENGTH) void fetchText(next);
  };

  const handleClearAll = () => {
    setText("");
    setCode("");
    setExpiresAt(null);
    setReceivedFileInfo(null);
    setSelectedFiles([]);
    setFileShared(false);
    setLastSharedText("");
    clear();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Stack spacing={2.5}>
      <Stack
        spacing={2}
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderRadius: 2,
          border: "1px solid rgba(59,130,246,0.35)",
          background:
            "linear-gradient(140deg, rgba(59,130,246,0.16) 0%, rgba(15,23,42,0.12) 55%, rgba(14,165,233,0.12) 100%)",
        }}
      >
        {/* Code input */}
        <TextField
          label="Access Code"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 4 }}
          placeholder="0000"
          helperText={
            isFetching
              ? "Checking for recent shares on this network..."
              : "Enter a 4-digit code to load content from another device."
          }
          InputProps={{
            startAdornment: <InputAdornment position="start">#</InputAdornment>,
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Load latest shared content"
                  onClick={() => void fetchLatestByIp()}
                  disabled={isFetching}
                  edge="end"
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
          fullWidth
        />

        {/* Text input */}
        <TextField
          label="Shared Text"
          value={text}
          onChange={(e) => {
            const next = e.target.value.slice(0, MAX_TEXT_LENGTH);
            setText(next);
            setInfo("");
          }}
          placeholder="Paste or type text here to generate a code."
          multiline
          minRows={5}
          fullWidth
          helperText={remainingChars}
        />

        {/* File drop zone */}
        {selectedFiles.length < MAX_FILES && (
          <DropZone
            onFiles={addFiles}
            disabled={isSharing}
            remaining={MAX_FILES - selectedFiles.length}
          />
        )}

        {/* File canvas */}
        {selectedFiles.length > 0 && (
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1.5,
              p: 1.5,
              borderRadius: 2,
              border: "1px solid rgba(148,163,184,0.18)",
              bgcolor: "rgba(15,23,42,0.25)",
              minHeight: 100,
            }}
          >
            {selectedFiles.map((file, i) => (
              <FileCard
                key={`${file.name}-${i}`}
                file={file}
                index={i}
                total={selectedFiles.length}
                onRemove={removeFile}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
          </Box>
        )}

        {/* Received file info (from fetched code) */}
        {receivedFileInfo && selectedFiles.length === 0 && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              p: 1.25,
              borderRadius: 1.5,
              border: "1px solid rgba(148,163,184,0.3)",
              bgcolor: "rgba(15,23,42,0.35)",
            }}
          >
            <InsertDriveFileIcon fontSize="small" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2">{receivedFileInfo.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {receivedFileInfo.size >= 1_048_576
                  ? `${(receivedFileInfo.size / 1_048_576).toFixed(1)} MB`
                  : `${Math.round(receivedFileInfo.size / 1024)} KB`}
              </Typography>
            </Box>
            <IconButton
              aria-label="Download shared file"
              onClick={() => void downloadSharedFile()}
              disabled={isFetching || !fileShared}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label="Clear file"
              onClick={() => setReceivedFileInfo(null)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {/* Actions */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            onClick={() => void shareContent(text, selectedFiles)}
            disabled={(!text.trim() && selectedFiles.length === 0) || isSharing}
          >
            {isSharing ? "Generating..." : "Generate Code"}
          </Button>
          <Button variant="text" onClick={handleClearAll}>
            Clear
          </Button>
        </Stack>

        {/* Expiry */}
        {expiresAt && (
          <Typography variant="caption" color="text.secondary">
            Code expires around {new Date(expiresAt).toLocaleTimeString()}.
            {selectedFiles.length > 1 &&
              " Multiple files will be bundled as a ZIP."}
          </Typography>
        )}
      </Stack>

      <ToolStatusAlerts error={error} success={success} info={info} />
    </Stack>
  );
};

const TextShare: React.FC = () => {
  return (
    <PageContainer maxWidth={680}>
      <TextShareContent />
    </PageContainer>
  );
};

export default TextShare;
