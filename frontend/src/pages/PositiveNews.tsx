import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";
import FavoriteIcon from "@mui/icons-material/Favorite";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlaceIcon from "@mui/icons-material/Place";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { apiFetch } from "../utils/api";

type PositiveNewsItem = {
  title: string;
  scope?: string;
  url: string;
  summary: string;
  published: string;
  source: string;
};

type PositiveNewsResponse = {
  location: {
    name: string;
    city?: string;
    region?: string;
    country?: string;
    source?: string;
    detected?: boolean;
    ipDetected?: boolean;
  };
  items: PositiveNewsItem[];
  window_days?: number;
  pool_size?: number;
  last_updated: string;
  cached: boolean;
};

const STORED_COORDS_KEY = "positive-news-coords";

const SCOPE_LABELS: Record<string, string> = {
  local: "Local",
  regional: "Regional",
  national: "National",
  world: "World",
};

const LOCATION_SOURCE_LABELS: Record<string, string> = {
  device: "Precise",
  manual: "Manual",
  headers: "Network",
  ip: "Approx (IP)",
  "server-ip": "Approx (IP)",
};

function readStoredCoords(): { lat: number; lon: number } | undefined {
  try {
    const raw = localStorage.getItem(STORED_COORDS_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat === "number" && typeof parsed?.lon === "number") {
      return { lat: parsed.lat, lon: parsed.lon };
    }
  } catch {
    // Ignore unreadable or blocked storage.
  }
  return undefined;
}

function formatDate(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export default function PositiveNews() {
  const theme = useTheme();
  const [data, setData] = useState<PositiveNewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    success?: string;
    error?: string;
  }>({});

  const load = async (
    refresh = false,
    coords?: { lat: number; lon: number },
  ) => {
    setLoading(true);
    setStatusMessage({});
    try {
      const response = await apiFetch("/ai/positive-news/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coords ? { refresh, ...coords } : { refresh }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatusMessage({
          error: payload.error || "Failed to load positive news.",
        });
        return;
      }
      setData(payload as PositiveNewsResponse);
      setStatusMessage({
        success: refresh
          ? "Refreshed from the web."
          : payload.cached
            ? "Loaded from cache."
            : "Loaded.",
      });
    } catch {
      setStatusMessage({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setStatusMessage({ error: "This browser cannot share a location." });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        try {
          localStorage.setItem(STORED_COORDS_KEY, JSON.stringify(coords));
        } catch {
          // A blocked storage API should not stop the lookup.
        }
        void load(true, coords);
      },
      () => {
        setLoading(false);
        setStatusMessage({
          error: "Location permission denied. Showing your approximate area.",
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  };

  useEffect(() => {
    void load(false, readStoredCoords());
  }, []);

  const items = data?.items ?? [];

  return (
    <PageContainer maxWidth={980}>
      <Stack spacing={3}>
        <ToolStatusAlerts success={statusMessage.success} error={statusMessage.error} />

        <Paper
          elevation={1}
          sx={{
            p: 2,
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.divider, 0.65)}`,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                <PlaceIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={800}>
                  {data?.location?.name || "Detecting your area"}
                </Typography>
                {data?.location?.source && (
                  <Chip
                    size="small"
                    label={LOCATION_SOURCE_LABELS[data.location.source] ?? "Approx"}
                    variant="outlined"
                    sx={{ height: 22, fontWeight: 700 }}
                  />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {data?.last_updated
                  ? `Updated ${formatRelative(data.last_updated)}`
                  : "Finding recent uplifting local stories"}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
            <Tooltip title="Use your exact location for nearby stories">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<MyLocationIcon />}
                  onClick={useMyLocation}
                  disabled={loading}
                  sx={{ borderRadius: 2, fontWeight: 800 }}
                >
                  Use my location
                </Button>
              </span>
            </Tooltip>

            <Tooltip title="Fetch the latest positive local news">
              <span>
                <Button
                  variant="contained"
                  startIcon={
                    loading ? (
                      <CircularProgress size={16} sx={{ color: "#fff" }} />
                    ) : (
                      <RefreshIcon />
                    )
                  }
                  onClick={() => load(true, readStoredCoords())}
                  disabled={loading}
                  sx={{ borderRadius: 2, fontWeight: 800 }}
                >
                  {loading ? "Refreshing" : "Refresh"}
                </Button>
              </span>
            </Tooltip>
            </Stack>
          </Stack>
        </Paper>

        {loading && !data && (
          <Paper
            elevation={1}
            sx={{
              p: 4,
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.divider, 0.65)}`,
            }}
          >
            <Stack alignItems="center" spacing={1.5}>
              <CircularProgress size={30} />
              <Typography variant="body2" color="text.secondary">
                Looking for good news near you...
              </Typography>
            </Stack>
          </Paper>
        )}

        {!loading && data && items.length === 0 && (
          <Paper
            elevation={1}
            sx={{
              p: 4,
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.divider, 0.65)}`,
            }}
          >
            <Typography variant="body2" color="text.secondary" textAlign="center">
              No positive local stories found right now. Try refreshing later.
            </Typography>
          </Paper>
        )}

        <Stack spacing={1.5}>
          {items.map((item) => (
            <Paper
              key={item.url}
              elevation={1}
              sx={{
                p: 2,
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.divider, 0.65)}`,
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <FavoriteIcon
                    sx={{
                      color: theme.palette.success.main,
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="subtitle1" fontWeight={800} sx={{ flex: 1, minWidth: 220 }}>
                    {item.title}
                  </Typography>
                </Stack>

                {item.summary && (
                  <Typography variant="body2" color="text.secondary">
                    {item.summary}
                  </Typography>
                )}

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  {item.scope && (
                    <Chip
                      size="small"
                      label={SCOPE_LABELS[item.scope] ?? item.scope}
                      color={item.scope === "local" ? "primary" : "default"}
                      variant={item.scope === "local" ? "filled" : "outlined"}
                      sx={{ fontWeight: 700 }}
                    />
                  )}
                  {item.source && <Chip size="small" label={item.source} variant="outlined" />}
                  {item.published && (
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(item.published)}
                    </Typography>
                  )}
                  <Box sx={{ flex: 1 }} />
                  <Link
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="hover"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    Open
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </Link>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Stack>
    </PageContainer>
  );
}
