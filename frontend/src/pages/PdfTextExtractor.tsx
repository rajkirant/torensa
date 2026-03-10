import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import FilePickerButton from "../components/inputs/FilePickerButton";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

const ACCEPT_TYPES = ".pdf,application/pdf";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function PdfTextExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const onFileSelected = (files: FileList | null) => {
    if (!files?.length) return;
    setFile(files[0]);
    setExtractedText("");
    setError(null);
    setSuccess(null);
  };

  const handleExtract = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setExtractedText("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiFetch("/api/doc-convert/pdf-extract-text/", {
        method: "POST",
        body: formData,
        csrf: true,
      });

      if (!response.ok) {
        let msg = `Server error (${response.status})`;
        try {
          const data = await response.json();
          msg = data?.error || msg;
        } catch {
          // ignore JSON parse error
        }
        throw new Error(msg);
      }

      const data = await response.json();
      const text = data.text ?? "";
      setExtractedText(text);
      setSuccess(
        text.length > 0
          ? `Extracted ${text.length.toLocaleString()} characters`
          : "No text found in PDF — the document may contain only images.",
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Text extraction failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy text to clipboard.");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([extractedText], {
      type: "text/plain;charset=utf-8",
    });
    const name = file
      ? file.name.replace(/\.pdf$/i, ".txt")
      : "extracted-text.txt";
    downloadBlob(blob, name);
  };

  return (
    <PageContainer>
      <ToolStatusAlerts error={error} success={success} />

      <Stack spacing={3} sx={{ maxWidth: 640 }}>
        <Box>
          <FilePickerButton
            accept={ACCEPT_TYPES}
            onFilesSelected={onFileSelected}
            label={file ? file.name : "Choose PDF file (.pdf)"}
          />
          {file && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: "block" }}
            >
              {file.name} &bull; {formatBytes(file.size)}
            </Typography>
          )}
        </Box>

        <ActionButton
          onClick={handleExtract}
          disabled={!file || loading}
          startIcon={<TextSnippetIcon />}
        >
          {loading ? "Extracting…" : "Extract Text"}
        </ActionButton>

        {loading && (
          <Box>
            <LinearProgress />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Extracting text — scanned pages may take longer for OCR
              processing…
            </Typography>
          </Box>
        )}

        {extractedText && (
          <>
            <TextField
              multiline
              minRows={8}
              maxRows={24}
              fullWidth
              value={extractedText}
              slotProps={{ input: { readOnly: true } }}
              label="Extracted Text"
            />

            <Stack direction="row" spacing={2}>
              <ActionButton
                onClick={handleCopy}
                startIcon={<ContentCopyIcon />}
                variant="outlined"
              >
                {copied ? "Copied!" : "Copy Text"}
              </ActionButton>
              <ActionButton
                onClick={handleDownload}
                startIcon={<DownloadIcon />}
                variant="outlined"
              >
                Download .txt
              </ActionButton>
            </Stack>
          </>
        )}
      </Stack>
    </PageContainer>
  );
}
