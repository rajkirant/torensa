import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import DownloadIcon from "@mui/icons-material/Download";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CelebrationIcon from "@mui/icons-material/Celebration";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import BubbleChartIcon from "@mui/icons-material/BubbleChart";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { TransparentButton } from "../components/buttons/TransparentButton";
import FlexWrapRow from "../components/layout/FlexWrapRow";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

type FestivalOption = {
  id: string;
  label: string;
  templateUrl: string;
  messages: string[];
};

type EffectId =
  | "sparkles"
  | "fireworks"
  | "rockets"
  | "confetti"
  | "diyas"
  | "bokeh";

const SHARE_URL = "https://torensa.com/festival-greeting";

function base64ToBlob(b64: string, mime: string): Blob {
  const byteChars = atob(b64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteArray], { type: mime });
}

export default function FestivalGreeting() {
  const [festivals, setFestivals] = useState<FestivalOption[]>([]);
  const [festivalId, setFestivalId] = useState<string>("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [effect, setEffect] = useState<EffectId>("sparkles");
  const [loading, setLoading] = useState(false);
  const [gifData, setGifData] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    success?: string;
    error?: string;
  }>({});
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/ai/festival-greeting/options/")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const options: FestivalOption[] = data.festivals ?? [];
        setFestivals(options);
        if (options.length > 0) {
          setFestivalId(options[0].id);
          if (options[0].messages.length > 0) {
            setMessage(options[0].messages[0]);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatusMessage({ error: "Failed to load festival options." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedFestival = festivals.find((f) => f.id === festivalId);

  const handleFestivalChange = (id: string) => {
    setFestivalId(id);
    const option = festivals.find((f) => f.id === id);
    if (option && option.messages.length > 0) {
      setMessage(option.messages[0]);
    }
    setGifData(null);
  };

  const handleGenerate = async () => {
    if (!festivalId || !message.trim()) return;
    setLoading(true);
    setGifData(null);
    setStatusMessage({});

    try {
      const response = await apiFetch("/ai/festival-greeting/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          festival: festivalId,
          message: message.trim(),
          recipient: recipient.trim(),
          effect,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage({ error: data.error || "Failed to create greeting." });
        return;
      }

      const b64 = (data.image || "").trim();
      if (!b64) {
        setStatusMessage({ error: "No image returned. Please try again." });
        return;
      }

      setGifData(b64);
      setStatusMessage({ success: "Your greeting is ready!" });
      setTimeout(() => {
        resultRef.current?.scrollIntoView({
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

  const fileName = () => {
    const safeFest = festivalId || "festival";
    const safeName = recipient.trim()
      ? `-${recipient.trim().replace(/\s+/g, "-")}`
      : "";
    return `${safeFest}-greeting${safeName}.gif`;
  };

  const handleDownload = () => {
    if (!gifData) return;
    const blob = base64ToBlob(gifData, "image/gif");
    downloadBlob(blob, fileName());
  };

  const handleShareWhatsApp = async () => {
    if (!gifData) return;
    const blob = base64ToBlob(gifData, "image/gif");
    const name = fileName();
    const captionBase = selectedFestival
      ? `Happy ${selectedFestival.label}! Created with ${SHARE_URL}`
      : `A festive greeting from ${SHARE_URL}`;

    const file = new File([blob], name, { type: "image/gif" });
    const canShareFiles =
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });

    if (canShareFiles) {
      try {
        await navigator.share({ files: [file], text: captionBase });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }

    downloadBlob(blob, name);
    setStatusMessage({
      success: "GIF downloaded — attach it in WhatsApp to share.",
    });
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(captionBase)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const canGenerate = !loading && !!festivalId && message.trim().length > 0;

  return (
    <PageContainer maxWidth={780}>
      <Stack spacing={2.5}>
        <ToolStatusAlerts
          error={statusMessage.error ?? ""}
          success={statusMessage.success ?? ""}
        />

        <TextField
          select
          label="Festival"
          value={festivalId}
          onChange={(e) => handleFestivalChange(e.target.value)}
          fullWidth
          disabled={festivals.length === 0}
          helperText={
            festivals.length === 0
              ? "Loading festivals…"
              : "More festivals coming soon"
          }
        >
          {festivals.map((f) => (
            <MenuItem key={f.id} value={f.id}>
              {f.label}
            </MenuItem>
          ))}
        </TextField>

        {selectedFestival && (
          <Box
            component="img"
            src={`${import.meta.env.VITE_API_URL || ""}${selectedFestival.templateUrl}`}
            alt={`${selectedFestival.label} preview`}
            sx={{
              width: "100%",
              maxHeight: 320,
              objectFit: "cover",
              borderRadius: 2,
              boxShadow: 2,
            }}
          />
        )}

        <TextField
          label="Recipient name (optional)"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="e.g. Raj"
          fullWidth
          inputProps={{ maxLength: 40 }}
        />

        <TextField
          label="Greeting message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Your greeting message"
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          inputProps={{ maxLength: 140 }}
          helperText={
            selectedFestival && selectedFestival.messages.length > 0 ? (
              <Box
                sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}
              >
                {selectedFestival.messages.map((m) => (
                  <Box
                    key={m}
                    component="span"
                    onClick={() => setMessage(m)}
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
                      maxWidth: "100%",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={m}
                  >
                    {m.length > 40 ? `${m.slice(0, 40)}…` : m}
                  </Box>
                ))}
              </Box>
            ) : null
          }
        />

        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 0.75 }}
          >
            Animation effect
          </Typography>
          <ToggleButtonGroup
            value={effect}
            exclusive
            onChange={(_, val) => {
              if (val) setEffect(val as EffectId);
            }}
            size="small"
            color="primary"
            sx={{ flexWrap: "wrap", gap: 0.5 }}
          >
            <ToggleButton value="sparkles">
              <AutoAwesomeIcon fontSize="small" sx={{ mr: 0.75 }} />
              Sparkles
            </ToggleButton>
            <ToggleButton value="fireworks">
              <CelebrationIcon fontSize="small" sx={{ mr: 0.75 }} />
              Fireworks
            </ToggleButton>
            <ToggleButton value="rockets">
              <RocketLaunchIcon fontSize="small" sx={{ mr: 0.75 }} />
              Rockets
            </ToggleButton>
            <ToggleButton value="confetti">
              <EmojiEventsIcon fontSize="small" sx={{ mr: 0.75 }} />
              Confetti
            </ToggleButton>
            <ToggleButton value="diyas">
              <LocalFireDepartmentIcon fontSize="small" sx={{ mr: 0.75 }} />
              Diyas
            </ToggleButton>
            <ToggleButton value="bokeh">
              <BubbleChartIcon fontSize="small" sx={{ mr: 0.75 }} />
              Bokeh
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <FlexWrapRow>
          <TransparentButton
            label={loading ? "Creating…" : "Create Animated Greeting"}
            onClick={handleGenerate}
            disabled={!canGenerate}
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          />
        </FlexWrapRow>

        {!loading && !gifData && !statusMessage.error && (
          <Typography variant="caption" color="text.secondary">
            Pick a festival, optionally add a name, and choose or write a
            message. Generation takes just a few seconds.
          </Typography>
        )}

        {loading && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              py: 4,
              gap: 2,
            }}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              {
                {
                  sparkles: "Animating sparkles… just a few seconds",
                  fireworks: "Lighting up fireworks… just a few seconds",
                  rockets: "Launching rockets… just a few seconds",
                  confetti: "Dropping confetti… just a few seconds",
                  diyas: "Lighting the diyas… just a few seconds",
                  bokeh: "Conjuring warm bokeh… just a few seconds",
                }[effect]
              }
            </Typography>
          </Box>
        )}

        {gifData && (
          <Box
            ref={resultRef}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              mt: 1,
              gap: 1.5,
            }}
          >
            <Box
              component="img"
              src={`data:image/gif;base64,${gifData}`}
              alt={
                recipient
                  ? `${selectedFestival?.label ?? "Festival"} greeting for ${recipient}`
                  : `${selectedFestival?.label ?? "Festival"} greeting`
              }
              sx={{
                maxWidth: "100%",
                maxHeight: 640,
                borderRadius: 3,
                boxShadow: 4,
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
                label="Download GIF"
                onClick={handleDownload}
                startIcon={<DownloadIcon />}
              />
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
