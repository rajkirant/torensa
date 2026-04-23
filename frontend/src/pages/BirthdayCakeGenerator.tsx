import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import DownloadIcon from "@mui/icons-material/Download";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { TransparentButton } from "../components/buttons/TransparentButton";
import FlexWrapRow from "../components/layout/FlexWrapRow";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

const CAKE_THEMES = [
  "chocolate",
  "vanilla",
  "strawberry",
  "rainbow",
  "floral",
  "galaxy",
  "unicorn",
  "elegant white",
];

function base64ToBlob(b64: string, mime: string): Blob {
  const byteChars = atob(b64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteArray], { type: mime });
}

export default function BirthdayCakeGenerator() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    success?: string;
    error?: string;
  }>({});
  const imageRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setImageData(null);
    setStatusMessage({});

    try {
      const body: Record<string, unknown> = {};
      if (name.trim()) body.name = name.trim();
      if (age.trim()) body.age = parseInt(age.trim(), 10);
      if (theme.trim()) body.theme = theme.trim();

      const response = await apiFetch("/ai/birthday-cake/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage({ error: data.error || "Failed to generate cake image." });
        return;
      }

      const b64 = (data.image || "").trim();
      if (!b64) {
        setStatusMessage({ error: "No image returned. Please try again." });
        return;
      }

      setImageData(b64);
      setStatusMessage({ success: "Your birthday cake is ready!" });
      setTimeout(() => {
        imageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    const safeName = name.trim() ? name.trim().replace(/\s+/g, "-") : "birthday-cake";
    downloadBlob(blob, `${safeName}-birthday-cake.png`);
  };

  const handleShareWhatsApp = () => {
    if (!imageData) return;
    const blob = base64ToBlob(imageData, "image/png");
    const safeName = name.trim() ? name.trim().replace(/\s+/g, "-") : "birthday-cake";
    downloadBlob(blob, `${safeName}-birthday-cake.png`);
    const text = name.trim()
      ? `Happy Birthday ${name.trim()}! 🎂 Generated at https://torensa.com/birthday-cake-generator`
      : `Happy Birthday! 🎂 Generated at https://torensa.com/birthday-cake-generator`;
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const isValid = !loading;

  return (
    <PageContainer maxWidth={780}>
      <Stack spacing={2.5}>
        <ToolStatusAlerts
          error={statusMessage.error ?? ""}
          success={statusMessage.success ?? ""}
        />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sarah"
            fullWidth
            inputProps={{ maxLength: 60 }}
          />
          <TextField
            label="Age (optional)"
            value={age}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "");
              setAge(val);
            }}
            placeholder="e.g. 30"
            fullWidth
            inputProps={{ maxLength: 3, inputMode: "numeric" }}
            sx={{ maxWidth: { sm: 160 } }}
          />
        </Stack>

        <TextField
          label="Cake theme (optional)"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder='e.g. chocolate, floral, galaxy…'
          fullWidth
          inputProps={{ maxLength: 100 }}
          helperText={
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
              {CAKE_THEMES.map((t) => (
                <Box
                  key={t}
                  component="span"
                  onClick={() => setTheme(t)}
                  sx={{
                    cursor: "pointer",
                    fontSize: 12,
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    "&:hover": { bgcolor: "action.hover" },
                    userSelect: "none",
                  }}
                >
                  {t}
                </Box>
              ))}
            </Box>
          }
        />

        <FlexWrapRow>
          <TransparentButton
            label={loading ? "Generating…" : "Generate Birthday Cake"}
            onClick={handleGenerate}
            disabled={!isValid}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          />
        </FlexWrapRow>

        {!loading && !imageData && !statusMessage.error && (
          <Typography variant="caption" color="text.secondary">
            Optionally enter a name, age, and theme — or leave blank for a surprise cake!
            Generation takes 10–30 seconds.
          </Typography>
        )}

        {loading && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4, gap: 2 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Baking your cake… this takes 10–30 seconds
            </Typography>
          </Box>
        )}

        {imageData && (
          <Box
            ref={imageRef}
            sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 1, gap: 1.5 }}
          >
            <Box
              component="img"
              src={`data:image/png;base64,${imageData}`}
              alt={name ? `Birthday cake for ${name}` : "Birthday cake"}
              sx={{
                maxWidth: "100%",
                maxHeight: 640,
                borderRadius: 3,
                boxShadow: 4,
              }}
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap", justifyContent: "center" }}>
              <TransparentButton
                label="Download PNG"
                onClick={handleDownload}
                startIcon={<DownloadIcon />}
              />
              <Tooltip title="Share on WhatsApp">
                <IconButton onClick={handleShareWhatsApp} size="small" sx={{ color: "#25D366" }}>
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
