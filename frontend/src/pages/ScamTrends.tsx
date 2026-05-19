import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import { useTheme, alpha } from "@mui/material/styles";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VerifiedIcon from "@mui/icons-material/Verified";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { apiFetch } from "../utils/api";

type SourceType = "government" | "news" | "blog" | "forum" | "other";

interface TrendSource {
  title: string;
  url: string;
  published: string;
  source_type: SourceType;
}

interface ScoringBreakdown {
  source_count: number;
  distinct_source_types: SourceType[];
  diversity_weight: number;
  recency_factor: number;
  newest_published: string | null;
}

interface Trend {
  rank: number;
  score: number;
  pattern_name: string;
  channel: string;
  lure: string;
  payload: string;
  victim_profile: string;
  sources: TrendSource[];
  scoring_breakdown: ScoringBreakdown;
}

interface TrendsResponse {
  trends: Trend[];
  sources_considered: number;
  records_extracted?: number;
  clusters_found?: number;
  last_updated: string;
  cached: boolean;
  elapsed_seconds?: number;
  method?: Record<string, string>;
}

const CHANNEL_COLOR: Record<string, string> = {
  sms: "#0ea5e9",
  email: "#8b5cf6",
  phone: "#f59e0b",
  social: "#ec4899",
  web: "#10b981",
  in_person: "#ef4444",
  unknown: "#64748b",
};

const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  government: "Govt",
  news: "News",
  blog: "Blog",
  forum: "Forum",
  other: "Other",
};

const SOURCE_TYPE_COLOR: Record<SourceType, string> = {
  government: "#16a34a",
  news: "#2563eb",
  blog: "#7c3aed",
  forum: "#f59e0b",
  other: "#64748b",
};

function prettyChannel(c: string) {
  if (!c) return "Unknown";
  return c.charAt(0).toUpperCase() + c.slice(1).replace("_", " ");
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatRelative(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return `${days} d ago`;
}

export default function ScamTrends() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ success?: string; error?: string }>({});

  const load = async (refresh = false) => {
    setLoading(true);
    setStatusMessage({});
    try {
      const response = await apiFetch("/ai/scam-trends/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatusMessage({ error: payload.error || "Failed to load scam trends." });
        return;
      }
      setData(payload as TrendsResponse);
      setStatusMessage({
        success: refresh
          ? "Refreshed from the web."
          : payload.cached
          ? "Loaded from cache (refreshes every 6 hours)."
          : "Loaded.",
      });
    } catch {
      setStatusMessage({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(false);
  }, []);

  const trends = data?.trends || [];

  return (
    <PageContainer>
      <Stack spacing={3}>
        <ToolStatusAlerts success={statusMessage.success} error={statusMessage.error} />

        <Box>
          <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
            <TrendingUpIcon sx={{ color: theme.palette.primary.main }} />
            <Typography variant="h5" fontWeight={800}>
              Scam Trend Tracker
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            The top 5 emerging scam patterns from the last 7 days. Sources are collected
            from news, government advisories, and consumer-protection sites, then
            structured by AI, clustered by similarity, and ranked by corroboration,
            source diversity, and recency.
          </Typography>
        </Box>

        <Paper
          elevation={1}
          sx={{
            p: 2,
            borderRadius: "14px",
            border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                LAST UPDATED
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {data?.last_updated
                  ? `${formatDate(data.last_updated)} · ${formatRelative(data.last_updated)}`
                  : "—"}
                {data?.cached ? "  ·  cached" : ""}
              </Typography>
              {data && (
                <Typography variant="caption" color="text.secondary">
                  {data.sources_considered} sources considered
                  {data.records_extracted != null ? ` · ${data.records_extracted} patterns extracted` : ""}
                  {data.clusters_found != null ? ` · ${data.clusters_found} clusters` : ""}
                </Typography>
              )}
            </Box>
            <Tooltip title="Force a fresh fetch from the web (bypasses 6h cache)">
              <span>
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <RefreshIcon />}
                  onClick={() => load(true)}
                  disabled={loading}
                  sx={{ borderRadius: "10px", fontWeight: 700 }}
                >
                  {loading ? "Refreshing…" : "Refresh"}
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Paper>

        {loading && !data && (
          <Paper
            elevation={1}
            sx={{
              p: 4,
              borderRadius: "14px",
              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
            }}
          >
            <Stack alignItems="center" spacing={1.5}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary">
                Searching the web and analyzing patterns…
              </Typography>
            </Stack>
          </Paper>
        )}

        {!loading && data && trends.length === 0 && (
          <Paper
            elevation={1}
            sx={{
              p: 4,
              borderRadius: "14px",
              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
            }}
          >
            <Typography variant="body2" color="text.secondary" textAlign="center">
              No trends found in the latest fetch. Try refreshing in a few hours.
            </Typography>
          </Paper>
        )}

        <Stack spacing={2}>
          {trends.map((trend) => {
            const channelColor = CHANNEL_COLOR[trend.channel] || CHANNEL_COLOR.unknown;
            return (
              <Paper
                key={trend.rank}
                elevation={2}
                sx={{
                  p: 2.5,
                  borderRadius: "14px",
                  border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        color: theme.palette.primary.main,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      #{trend.rank}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                        {trend.pattern_name}
                      </Typography>
                      <Stack direction="row" spacing={0.75} mt={0.5} flexWrap="wrap" useFlexGap>
                        <Chip
                          label={prettyChannel(trend.channel)}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            bgcolor: alpha(channelColor, 0.15),
                            color: channelColor,
                            border: `1px solid ${alpha(channelColor, 0.4)}`,
                          }}
                        />
                        <Chip
                          label={`${trend.sources.length} source${trend.sources.length === 1 ? "" : "s"}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                        {trend.scoring_breakdown.distinct_source_types.includes("government") && (
                          <Tooltip title="Corroborated by a government advisory">
                            <Chip
                              icon={<VerifiedIcon />}
                              label="Govt-cited"
                              size="small"
                              sx={{
                                fontWeight: 700,
                                bgcolor: alpha("#16a34a", 0.15),
                                color: "#16a34a",
                                border: `1px solid ${alpha("#16a34a", 0.4)}`,
                              }}
                            />
                          </Tooltip>
                        )}
                      </Stack>
                    </Box>
                    <Tooltip title="Trend score (corroboration × source-type diversity × recency)">
                      <Box sx={{ textAlign: "right" }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>
                          SCORE
                        </Typography>
                        <Typography variant="h6" fontWeight={800} sx={{ color: theme.palette.primary.main }}>
                          {trend.score.toFixed(2)}
                        </Typography>
                      </Box>
                    </Tooltip>
                  </Stack>

                  <Divider />

                  {trend.lure && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        HOW THEY HOOK YOU
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.25 }}>
                        {trend.lure}
                      </Typography>
                    </Box>
                  )}

                  {trend.payload && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        WHAT THEY WANT
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.25 }}>
                        {trend.payload}
                      </Typography>
                    </Box>
                  )}

                  {trend.victim_profile && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        TYPICAL VICTIM
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.25 }}>
                        {trend.victim_profile}
                      </Typography>
                    </Box>
                  )}

                  <Accordion
                    elevation={0}
                    disableGutters
                    sx={{
                      "&:before": { display: "none" },
                      bgcolor: isDark
                        ? alpha(theme.palette.background.paper, 0.6)
                        : alpha(theme.palette.grey[50], 0.95),
                      borderRadius: "8px",
                      border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2" fontWeight={700}>
                        Sources ({trend.sources.length})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1}>
                        {trend.sources.map((src, i) => {
                          const stColor = SOURCE_TYPE_COLOR[src.source_type] || SOURCE_TYPE_COLOR.other;
                          return (
                            <Box
                              key={i}
                              sx={{
                                p: 1,
                                borderRadius: "6px",
                                border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                              }}
                            >
                              <Stack direction="row" spacing={1} alignItems="flex-start">
                                <Chip
                                  label={SOURCE_TYPE_LABEL[src.source_type] || src.source_type}
                                  size="small"
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: 10,
                                    height: 20,
                                    bgcolor: alpha(stColor, 0.15),
                                    color: stColor,
                                    border: `1px solid ${alpha(stColor, 0.4)}`,
                                  }}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Link
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    underline="hover"
                                    sx={{ fontWeight: 600, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 0.5 }}
                                  >
                                    {src.title || src.url}
                                    <OpenInNewIcon sx={{ fontSize: 12 }} />
                                  </Link>
                                  {src.published && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                      {formatDate(src.published)}
                                    </Typography>
                                  )}
                                </Box>
                              </Stack>
                            </Box>
                          );
                        })}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              </Paper>
            );
          })}
        </Stack>

        {data?.method && (
          <Accordion
            elevation={0}
            disableGutters
            sx={{
              "&:before": { display: "none" },
              borderRadius: "10px",
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" fontWeight={700} color="text.secondary">
                How these trends are produced
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={0.75}>
                {Object.entries(data.method).map(([step, desc]) => (
                  <Box key={step}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {step.toUpperCase()}
                    </Typography>
                    <Typography variant="body2">{desc}</Typography>
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}
      </Stack>
    </PageContainer>
  );
}
