import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import DownloadIcon from "@mui/icons-material/Download";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { TransparentButton } from "../components/buttons/TransparentButton";
import FlexWrapRow from "../components/layout/FlexWrapRow";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

function base64ToBlob(b64: string, mime: string): Blob {
  const byteChars = atob(b64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteArray], { type: mime });
}

export default function AiImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    info?: string;
    success?: string;
    error?: string;
  }>({ info: "Describe what you want to see and click Generate." });

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setLoading(true);
    setImageData(null);
    setStatusMessage({});

    try {
      const response = await apiFetch("/api/image-generate/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage({
          error: data.error || "Failed to generate image.",
        });
        return;
      }

      const b64 = (data.image || "").trim();
      if (!b64) {
        setStatusMessage({ error: "No image returned. Please try again." });
        return;
      }

      setImageData(b64);
      setStatusMessage({ success: "Image generated successfully." });
    } catch {
      setStatusMessage({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imageData) return;
    const blob = base64ToBlob(imageData, "image/png");
    downloadBlob(blob, "generated-image.png");
  };

  return (
    <PageContainer maxWidth={980}>
      <Stack spacing={2}>
        <ToolStatusAlerts
          error={statusMessage.error ?? ""}
          success={statusMessage.success ?? ""}
          info={statusMessage.info ?? ""}
        />

        <TextField
          label="Describe the image you want"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder='e.g. "a lion flying with golden wings over a sunset mountain range"'
          fullWidth
          multiline
          minRows={2}
          maxRows={5}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleGenerate();
            }
          }}
        />

        <FlexWrapRow>
          <TransparentButton
            label={loading ? "Generating…" : "Generate Image"}
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          />
          {imageData && (
            <TransparentButton
              label="Download PNG"
              onClick={handleDownload}
              startIcon={<DownloadIcon />}
            />
          )}
        </FlexWrapRow>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {imageData && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mt: 2,
            }}
          >
            <Box
              component="img"
              src={`data:image/png;base64,${imageData}`}
              alt="AI generated image"
              sx={{
                maxWidth: "100%",
                maxHeight: 600,
                borderRadius: 2,
                boxShadow: 3,
              }}
            />
          </Box>
        )}
      </Stack>
    </PageContainer>
  );
}
