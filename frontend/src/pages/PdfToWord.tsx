import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import FileDropZone from "../components/inputs/FileDropZone";
import DownloadIcon from "@mui/icons-material/Download";
import ArticleIcon from "@mui/icons-material/Article";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

const ACCEPT_TYPES = ".pdf,application/pdf";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function PdfToWord() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState<string>("");

  const onFileSelected = (files: FileList | null) => {
    if (!files?.length) return;
    setFile(files[0]);
    setResultBlob(null);
    setError(null);
    setSuccess(null);
  };

  const clearSelection = () => {
    setFile(null);
    setResultBlob(null);
    setResultName("");
    setError(null);
    setSuccess(null);
  };

  const handleConvert = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setResultBlob(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiFetch("/api/doc-convert/pdf-to-word/", {
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

      const blob = await response.blob();
      const outputName = file.name.replace(/\.pdf$/i, ".docx");
      setResultBlob(blob);
      setResultName(outputName);
      setSuccess(`Converted successfully — ${formatBytes(blob.size)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (resultBlob) downloadBlob(resultBlob, resultName);
  };

  return (
    <PageContainer>
      <ToolStatusAlerts error={error} success={success} />

      <Stack spacing={3} sx={{ maxWidth: 520 }}>
        {/* File picker */}
        <Box>
          <FileDropZone
            accept={ACCEPT_TYPES}
            disabled={loading}
            onFilesSelected={onFileSelected}
            onClear={clearSelection}
            clearDisabled={loading || !file}
            fileType="pdf"
            label={file ? file.name : "Drag & drop a PDF here, or tap to browse"}
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

        {/* Convert button */}
        <ActionButton
          onClick={handleConvert}
          disabled={!file || loading}
          startIcon={<ArticleIcon />}
        >
          {loading ? "Converting…" : "Convert to Word"}
        </ActionButton>

        {/* Progress */}
        {loading && (
          <Box>
            <LinearProgress />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Running LibreOffice conversion — this may take a few seconds…
            </Typography>
          </Box>
        )}

        {/* Download */}
        {resultBlob && (
          <ActionButton
            onClick={handleDownload}
            startIcon={<DownloadIcon />}
            variant="outlined"
          >
            Download {resultName}
          </ActionButton>
        )}
      </Stack>
    </PageContainer>
  );
}
