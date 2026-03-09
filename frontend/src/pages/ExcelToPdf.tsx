import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import FilePickerButton from "../components/inputs/FilePickerButton";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

const ACCEPT_TYPES =
  ".xls,.xlsx,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ExcelToPdf() {
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

  const handleConvert = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setResultBlob(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiFetch("/api/doc-convert/excel-to-pdf/", {
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
      const outputName = file.name.replace(/\.(xlsx|xlsm|xls)$/i, ".pdf");
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
        <Box>
          <FilePickerButton
            accept={ACCEPT_TYPES}
            onFilesSelected={onFileSelected}
            label={file ? file.name : "Choose Excel file (.xls / .xlsx)"}
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
          onClick={handleConvert}
          disabled={!file || loading}
          startIcon={<PictureAsPdfIcon />}
        >
          {loading ? "Converting…" : "Convert to PDF"}
        </ActionButton>

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
