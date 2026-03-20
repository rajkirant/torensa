import React, { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import PageContainer from "../components/PageContainer";
import { ActionButton } from "../components/buttons/ActionButton";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import useToolStatus from "../hooks/useToolStatus";
import { apiFetch } from "../utils/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

/* ── types ─────────────────────────────────────────────── */

interface Habit {
  id: number;
  name: string;
  points: number;
}

/** dateKey → list of completed habit ids */
type DailyLog = Record<string, number[]>;

/* ── helpers ───────────────────────────────────────────── */

const dateKey = (d: Date) => d.toISOString().slice(0, 10); // "YYYY-MM-DD"
const today = () => dateKey(new Date());

/* ── chart colours ─────────────────────────────────────── */

const BAR_COLORS = [
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#eab308",
  "#f97316",
];

/* ── component ─────────────────────────────────────────── */

const HabitTracker: React.FC = () => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [log, setLog] = useState<DailyLog>({});
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newPoints, setNewPoints] = useState<number | "">(10);
  const { error, success, setError, setSuccess, clear } = useToolStatus();

  /* ── fetch habits + logs on mount ── */

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [habitsRes, logsRes] = await Promise.all([
          apiFetch("/api/habits/"),
          apiFetch("/api/habits/logs/?days=14"),
        ]);
        if (cancelled) return;
        if (habitsRes.ok && logsRes.ok) {
          setHabits(await habitsRes.json());
          setLog(await logsRes.json());
        } else {
          setError("Failed to load habits.");
        }
      } catch {
        if (!cancelled) setError("Network error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── add habit ── */

  const addHabit = async () => {
    clear();
    const name = newName.trim();
    if (!name) {
      setError("Enter a habit name.");
      return;
    }
    const pts = Number(newPoints);
    if (!pts || pts < 1 || pts > 1000) {
      setError("Points must be between 1 and 1000.");
      return;
    }

    try {
      const res = await apiFetch("/api/habits/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, points: pts }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add habit.");
        return;
      }
      setHabits((prev) => [...prev, data]);
      setNewName("");
      setNewPoints(10);
      setSuccess(`Added "${name}" (+${pts} pts).`);
    } catch {
      setError("Network error.");
    }
  };

  /* ── remove habit ── */

  const removeHabit = async (id: number) => {
    try {
      const res = await apiFetch(`/api/habits/${id}/`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to remove habit.");
        return;
      }
      setHabits((prev) => prev.filter((h) => h.id !== id));
      setLog((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = next[key].filter((hid) => hid !== id);
          if (next[key].length === 0) delete next[key];
        }
        return next;
      });
    } catch {
      setError("Network error.");
    }
  };

  /* ── toggle completion ── */

  const toggle = useCallback(
    async (habitId: number) => {
      const key = today();

      // optimistic update
      setLog((prev) => {
        const done = prev[key] ?? [];
        const next = done.includes(habitId)
          ? done.filter((id) => id !== habitId)
          : [...done, habitId];
        return { ...prev, [key]: next };
      });

      try {
        const res = await apiFetch(`/api/habits/${habitId}/toggle/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: key }),
        });
        if (!res.ok) {
          // revert on failure
          setLog((prev) => {
            const done = prev[key] ?? [];
            const next = done.includes(habitId)
              ? done.filter((id) => id !== habitId)
              : [...done, habitId];
            return { ...prev, [key]: next };
          });
          setError("Failed to toggle habit.");
        }
      } catch {
        // revert
        setLog((prev) => {
          const done = prev[key] ?? [];
          const next = done.includes(habitId)
            ? done.filter((id) => id !== habitId)
            : [...done, habitId];
          return { ...prev, [key]: next };
        });
        setError("Network error.");
      }
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isDone = (habitId: number) => (log[today()] ?? []).includes(habitId);

  /* ── points ── */

  const todayPoints = habits.reduce(
    (sum, h) => sum + (isDone(h.id) ? h.points : 0),
    0,
  );

  const maxPossible = habits.reduce((s, h) => s + h.points, 0);

  /* ── chart data (last 14 days) ── */

  const chartData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = dateKey(d);
    const completedIds = log[key] ?? [];
    const pts = habits.reduce(
      (sum, h) => sum + (completedIds.includes(h.id) ? h.points : 0),
      0,
    );
    return {
      date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      points: pts,
      isToday: key === today(),
    };
  });

  /* ── render ──────────────────────────────────────────── */

  if (loading) {
    return (
      <PageContainer maxWidth={900}>
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth={900}>
      <Stack spacing={3}>
        {/* ── add habit form ── */}
        <Box
          sx={{
            p: { xs: 1.5, sm: 2 },
            borderRadius: 2,
            border: "1px solid rgba(59,130,246,0.35)",
            background:
              "linear-gradient(140deg, rgba(59,130,246,0.17) 0%, rgba(15,23,42,0.12) 55%, rgba(14,165,233,0.12) 100%)",
          }}
        >
          <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
            Add a new habit
          </Typography>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ sm: "flex-start" }}
          >
            <TextField
              label="Habit name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addHabit()}
              sx={{ flex: 1 }}
              size="small"
            />
            <TextField
              label="Points"
              type="number"
              value={newPoints}
              onChange={(e) =>
                setNewPoints(e.target.value === "" ? "" : Number(e.target.value))
              }
              inputProps={{ min: 1, max: 1000 }}
              sx={{ width: { xs: "100%", sm: 120 } }}
              size="small"
            />
            <ActionButton onClick={() => void addHabit()} startIcon={<AddIcon />}>
              Add
            </ActionButton>
          </Stack>
        </Box>

        <ToolStatusAlerts error={error} success={success} />

        {/* ── today's checklist ── */}
        {habits.length > 0 && (
          <Box
            sx={{
              borderRadius: 2,
              border: "1px solid rgba(148,163,184,0.25)",
              bgcolor: "rgba(2,6,23,0.28)",
              overflow: "hidden",
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                px: 2,
                py: 1.2,
                borderBottom: "1px solid rgba(148,163,184,0.2)",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2" fontWeight={700}>
                  Today's Habits
                </Typography>
                <Chip
                  size="small"
                  label={`${habits.length} habit${habits.length === 1 ? "" : "s"}`}
                  sx={{
                    bgcolor: "rgba(59,130,246,0.2)",
                    border: "1px solid rgba(59,130,246,0.45)",
                  }}
                />
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" fontWeight={600}>
                  {todayPoints}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  / {maxPossible} pts
                </Typography>
              </Stack>
            </Stack>

            <Stack>
              {habits.map((habit) => {
                const done = isDone(habit.id);
                return (
                  <Stack
                    key={habit.id}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{
                      px: 2,
                      py: 1,
                      "&:nth-of-type(odd)": {
                        bgcolor: "rgba(148,163,184,0.06)",
                      },
                      transition: "background 0.15s",
                      "&:hover": { bgcolor: "rgba(59,130,246,0.08)" },
                    }}
                  >
                    <Checkbox
                      checked={done}
                      onChange={() => void toggle(habit.id)}
                      sx={{ p: 0.5 }}
                    />
                    <Typography
                      sx={{
                        flex: 1,
                        textDecoration: done ? "line-through" : "none",
                        opacity: done ? 0.6 : 1,
                        transition: "opacity 0.15s",
                      }}
                    >
                      {habit.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={`+${habit.points}`}
                      color={done ? "success" : "default"}
                      variant={done ? "filled" : "outlined"}
                      sx={{ minWidth: 48, fontWeight: 700 }}
                    />
                    <Tooltip title="Remove habit">
                      <IconButton
                        size="small"
                        onClick={() => void removeHabit(habit.id)}
                        sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* ── points chart (last 14 days) ── */}
        {habits.length > 0 && (
          <Box
            sx={{
              borderRadius: 2,
              border: "1px solid rgba(148,163,184,0.25)",
              bgcolor: "rgba(2,6,23,0.28)",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.2,
                borderBottom: "1px solid rgba(148,163,184,0.2)",
              }}
            >
              <Typography variant="subtitle2" fontWeight={700}>
                Points — Last 14 Days
              </Typography>
            </Box>

            <Box sx={{ width: "100%", height: 300, p: 2 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.15)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "rgba(148,163,184,0.7)" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(148,163,184,0.2)" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "rgba(148,163,184,0.7)" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(148,163,184,0.2)" }}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "rgba(15,23,42,0.95)",
                      border: "1px solid rgba(59,130,246,0.4)",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                    labelStyle={{ color: "#94a3b8", fontWeight: 600 }}
                    itemStyle={{ color: "#e2e8f0" }}
                  />
                  <Bar dataKey="points" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.isToday
                            ? "#22c55e"
                            : BAR_COLORS[i % BAR_COLORS.length]
                        }
                        opacity={entry.isToday ? 1 : 0.75}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        )}

        {habits.length === 0 && (
          <Box sx={{ textAlign: "center", py: 6, opacity: 0.5 }}>
            <Typography variant="h6">No habits yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Add your first habit above to start tracking!
            </Typography>
          </Box>
        )}
      </Stack>
    </PageContainer>
  );
};

export default HabitTracker;
