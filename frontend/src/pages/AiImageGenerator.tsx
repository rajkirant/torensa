import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import DownloadIcon from "@mui/icons-material/Download";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import TelegramIcon from "@mui/icons-material/Telegram";
import TwitterIcon from "@mui/icons-material/Twitter";
import FacebookIcon from "@mui/icons-material/Facebook";
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

  const SHARE_URL = "https://torensa.com/ai-image-generator";
  const SHARE_TEXT = "Check out this AI-generated image!";

  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function";

  const shareImageFile = async (appText?: string) => {
    if (!imageData) return;
    const blob = base64ToBlob(imageData, "image/png");
    const file = new File([blob], "generated-image.png", { type: "image/png" });
    if (!canShareFiles || !navigator.canShare({ files: [file] })) return;
    try {
      await navigator.share({
        files: [file],
        text: appText ?? `${SHARE_TEXT} Generated from ${SHARE_URL}`,
      });
    } catch {
      // user cancelled or share failed
    }
  };

  const handleShareWhatsApp = () =>
    shareImageFile(`Generated from ${SHARE_URL}`);

  const handleShareTelegram = () => {
    if (canShareFiles) {
      shareImageFile(`${SHARE_TEXT} ${SHARE_URL}`);
    } else {
      window.open(
        `https://t.me/share/url?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  const handleShareTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${SHARE_TEXT} ${SHARE_URL}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleShareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`,
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

        {imageData && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
              Share:
            </Typography>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            {canShareFiles && (
              <Tooltip title="Share on WhatsApp">
                <IconButton
                  onClick={handleShareWhatsApp}
                  size="small"
                  sx={{ color: "#25D366" }}
                >
                  <WhatsAppIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Share on Telegram">
              <IconButton
                onClick={handleShareTelegram}
                size="small"
                sx={{ color: "#26A5E4" }}
              >
                <TelegramIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share on X (Twitter)">
              <IconButton
                onClick={handleShareTwitter}
                size="small"
                sx={{ color: "text.primary" }}
              >
                <TwitterIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share on Facebook">
              <IconButton
                onClick={handleShareFacebook}
                size="small"
                sx={{ color: "#1877F2" }}
              >
                <FacebookIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}

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
