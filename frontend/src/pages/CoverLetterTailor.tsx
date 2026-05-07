import { useState } from "react";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import EditNoteIcon from "@mui/icons-material/EditNote";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import FileDropZone from "../components/inputs/FileDropZone";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

const ACCEPT_TYPES =
  ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MAX_JOB_DESCRIPTION_CHARS = 12000;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function outputNameFor(file: File) {
  return file.name.replace(/\.docx$/i, "") + "-tailored.docx";
}

export default function CoverLetterTailor() {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState("");

  const onFileSelected = (files: FileList | null) => {
    if (!files?.length) return;
    setFile(files[0]);
    setResultBlob(null);
    setResultName("");
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

  const handleGenerate = async () => {
    const trimmedDescription = jobDescription.trim();
    if (!file || !trimmedDescription || loading) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setResultBlob(null);
    setResultName("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jobDescription", trimmedDescription);

      const response = await apiFetch("/ai/cover-letter-update/", {
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
      const name = outputNameFor(file);
      setResultBlob(blob);
      setResultName(name);
      setSuccess(`Cover letter updated successfully - ${formatBytes(blob.size)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update the cover letter.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (resultBlob && resultName) {
      downloadBlob(resultBlob, resultName);
    }
  };

  const descriptionLength = jobDescription.length;
  const isDescriptionTooLong = descriptionLength > MAX_JOB_DESCRIPTION_CHARS;
  const canGenerate = Boolean(file && jobDescription.trim()) && !isDescriptionTooLong && !loading;

  return (
    <PageContainer maxWidth={900}>
      <ToolStatusAlerts error={error} success={success} />

      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
          <Box sx={{ flex: 1 }}>
            <FileDropZone
              accept={ACCEPT_TYPES}
              disabled={loading}
              onFilesSelected={onFileSelected}
              onClear={clearSelection}
              clearDisabled={loading || !file}
              fileType="document"
              label={file ? file.name : "Drag & drop your .docx cover letter here, or tap to browse"}
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

          <Paper
            variant="outlined"
            sx={{
              flex: 1.3,
              display: "flex",
              flexDirection: "column",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.25,
                display: "flex",
                justifyContent: "space-between",
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                Job description
              </Typography>
              <Typography
                variant="caption"
                color={isDescriptionTooLong ? "error.main" : "text.disabled"}
              >
                {descriptionLength}/{MAX_JOB_DESCRIPTION_CHARS}
              </Typography>
            </Box>
            <TextField
              multiline
              fullWidth
              minRows={10}
              maxRows={18}
              placeholder="Paste the job description here..."
              value={jobDescription}
              onChange={(event) => {
                setJobDescription(event.target.value);
                setError(null);
                setSuccess(null);
                setResultBlob(null);
                setResultName("");
              }}
              error={isDescriptionTooLong}
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: { p: 2, alignItems: "flex-start", fontSize: "0.9rem" },
              }}
            />
          </Paper>
        </Stack>

        <ActionButton
          onClick={handleGenerate}
          disabled={!canGenerate}
          startIcon={<EditNoteIcon />}
        >
          {loading ? "Updating cover letter..." : "Update Cover Letter"}
        </ActionButton>

        {loading && (
          <Box>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              Matching the letter to the job description and preparing a new DOCX.
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
