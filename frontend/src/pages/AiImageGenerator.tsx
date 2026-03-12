import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import DownloadIcon from "@mui/icons-material/Download";
import ShareIcon from "@mui/icons-material/Share";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
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
  const imageRef = useRef<HTMLDivElement>(null);
  const [statusMessage, setStatusMessage] = useState<{
    success?: string;
    error?: string;
  }>({});

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setLoading(true);
    setImageData(null);
    setStatusMessage({});

    try {
      const response = await apiFetch("/ai/image-generate/", {
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
      setTimeout(() => {
        imageRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
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

  const SHARE_URL = "https://torensa.com/image-generator";

  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function";

  const handleShare = async () => {
    if (!imageData) return;
    const blob = base64ToBlob(imageData, "image/png");
    const file = new File([blob], "generated-image.png", { type: "image/png" });
    if (!canShareFiles || !navigator.canShare({ files: [file] })) return;
    try {
      await navigator.share({
        files: [file],
        text: `Generated from ${SHARE_URL}`,
      });
    } catch {
      // user cancelled
    }
  };

  const handleShareWhatsApp = () => {
    if (!imageData) return;
    const blob = base64ToBlob(imageData, "image/png");
    downloadBlob(blob, "generated-image.png");
    const text = `Check out this AI-generated image! Generated from ${SHARE_URL}`;
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <PageContainer maxWidth={980}>
      <Stack spacing={2}>
        <ToolStatusAlerts
          error={statusMessage.error ?? ""}
          success={statusMessage.success ?? ""}
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
        </FlexWrapRow>

        {!loading && !imageData && !statusMessage.error && (
          <Typography variant="caption" color="text.secondary">
            Describe what you want to see and click Generate.
          </Typography>
        )}

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {imageData && (
          <Box
            ref={imageRef}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              mt: 2,
              gap: 1.5,
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

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <TransparentButton
                label="Download PNG"
                onClick={handleDownload}
                startIcon={<DownloadIcon />}
              />
              {canShareFiles && (
                <Tooltip title="Share image">
                  <IconButton onClick={handleShare} size="small">
                    <ShareIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Share on WhatsApp">
                <IconButton
                  onClick={handleShareWhatsApp}
                  size="small"
                  sx={{ color: "#25D366" }}
                >
                  <WhatsAppIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
      </Stack>
    </PageContainer>
  );
}
