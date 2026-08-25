import React, { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PageContainer from "../components/PageContainer";
import { ActionButton } from "../components/buttons/ActionButton";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { TransparentButton } from "../components/buttons/TransparentButton";
import useToolStatus from "../hooks/useToolStatus";

const TICK_MS = 40;
const MONOSPACE =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const pad = (value: number, size = 2) => String(value).padStart(size, "0");

/** Formats milliseconds as HH:MM:SS.cs — hours are dropped below one hour. */
function formatDuration(ms: number, withCentiseconds: boolean) {
  const safe = Math.max(0, Math.round(ms));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const centiseconds = Math.floor((safe % 1000) / 10);

  const base =
    hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;

  return withCentiseconds ? `${base}.${pad(centiseconds)}` : base;
}

/** Short beep sequence played when a countdown reaches zero. */
function playAlarm() {
  type WindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };
  const AudioCtx =
    window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const start = ctx.currentTime;

  [0, 0.45, 0.9].forEach((offset) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, start + offset);
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.32);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.35);
  });

  window.setTimeout(() => void ctx.close(), 1600);
}

type Lap = {
  index: number;
  split: number;
  total: number;
};

const TimerStopwatch: React.FC = () => {
  const [tab, setTab] = useState<"stopwatch" | "timer">("stopwatch");
  const { error, success, info, setError, setSuccess, setInfo, clear } =
    useToolStatus();

  /* ===================== STOPWATCH ===================== */
  const [swElapsed, setSwElapsed] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [laps, setLaps] = useState<Lap[]>([]);
  const swBaseRef = useRef(0);
  const swStartedAtRef = useRef(0);

  // Elapsed time is always derived from wall-clock timestamps, so a throttled
  // tick never accumulates drift.
  useEffect(() => {
    if (!swRunning) return;
    const id = window.setInterval(() => {
      setSwElapsed(swBaseRef.current + (Date.now() - swStartedAtRef.current));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [swRunning]);

  const toggleStopwatch = () => {
    clear();
    if (swRunning) {
      swBaseRef.current += Date.now() - swStartedAtRef.current;
      setSwElapsed(swBaseRef.current);
      setSwRunning(false);
      return;
    }
    swStartedAtRef.current = Date.now();
    setSwRunning(true);
  };

  const resetStopwatch = () => {
    swBaseRef.current = 0;
    swStartedAtRef.current = 0;
    setSwRunning(false);
    setSwElapsed(0);
    setLaps([]);
    clear();
    setInfo("Stopwatch reset.");
  };

  const recordLap = () => {
    const total = swRunning
      ? swBaseRef.current + (Date.now() - swStartedAtRef.current)
      : swElapsed;

    setLaps((current) => {
      const previous = current.length > 0 ? current[0].total : 0;
      return [
        { index: current.length + 1, split: total - previous, total },
        ...current,
      ];
    });
    clear();
  };

  const copyLaps = async () => {
    const lines = [...laps]
      .reverse()
      .map(
        (lap) =>
          `Lap ${lap.index}\t${formatDuration(lap.split, true)}\t${formatDuration(
            lap.total,
            true,
          )}`,
      );

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      clear();
      setSuccess("Lap times copied to the clipboard.");
    } catch {
      clear();
      setError("Failed to copy to the clipboard.");
    }
  };

  const fastestLap = useMemo(() => {
    if (laps.length < 2) return null;
    return laps.reduce((best, lap) => (lap.split < best.split ? lap : best));
  }, [laps]);

  const slowestLap = useMemo(() => {
    if (laps.length < 2) return null;
    return laps.reduce((worst, lap) => (lap.split > worst.split ? lap : worst));
  }, [laps]);

  /* ===================== COUNTDOWN TIMER ===================== */
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("5");
  const [seconds, setSeconds] = useState("0");
  const [remaining, setRemaining] = useState(0);
  const [duration, setDuration] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const endsAtRef = useRef(0);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const parsedDuration = useMemo(() => {
    const toNumber = (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
    };
    return (
      toNumber(hours) * 3_600_000 +
      toNumber(minutes) * 60_000 +
      toNumber(seconds) * 1000
    );
  }, [hours, minutes, seconds]);

  const finishTimer = () => {
    setTimerRunning(false);
    setRemaining(0);
    endsAtRef.current = 0;
    clear();
    setSuccess("Time is up!");
    if (soundEnabledRef.current) playAlarm();
  };

  // Kept in a ref so the countdown interval never has to be torn down and
  // recreated on every tick-driven re-render.
  const finishTimerRef = useRef(finishTimer);
  useEffect(() => {
    finishTimerRef.current = finishTimer;
  });

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      const left = endsAtRef.current - Date.now();
      if (left <= 0) {
        finishTimerRef.current();
        return;
      }
      setRemaining(left);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const startTimer = () => {
    clear();
    // Resume a paused countdown, otherwise start a fresh one from the inputs.
    const target = remaining > 0 ? remaining : parsedDuration;

    if (target <= 0) {
      setError("Set a countdown longer than zero seconds.");
      return;
    }

    if (remaining <= 0) setDuration(target);
    endsAtRef.current = Date.now() + target;
    setRemaining(target);
    setTimerRunning(true);
  };

  const pauseTimer = () => {
    setRemaining(Math.max(0, endsAtRef.current - Date.now()));
    setTimerRunning(false);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setRemaining(0);
    setDuration(0);
    endsAtRef.current = 0;
    clear();
    setInfo("Timer reset.");
  };

  const applyPreset = (totalSeconds: number) => {
    setTimerRunning(false);
    setRemaining(0);
    setDuration(0);
    endsAtRef.current = 0;
    setHours(String(Math.floor(totalSeconds / 3600)));
    setMinutes(String(Math.floor((totalSeconds % 3600) / 60)));
    setSeconds(String(totalSeconds % 60));
    clear();
  };

  const presets = [60, 180, 300, 600, 900, 1500, 3600];
  const progress =
    duration > 0 ? Math.min(100, ((duration - remaining) / duration) * 100) : 0;
  const timerDisplay = remaining > 0 ? remaining : parsedDuration;

  const changeTab = (_: React.SyntheticEvent, value: "stopwatch" | "timer") => {
    setTab(value);
    clear();
  };

  const numberFieldProps = {
    type: "number",
    inputProps: { min: 0, max: 99 },
    sx: { width: { xs: "100%", sm: 110 } },
    disabled: timerRunning,
  } as const;

  return (
    <PageContainer maxWidth={860}>
      <Stack spacing={2}>
        <Tabs
          value={tab}
          onChange={changeTab}
          variant="fullWidth"
          sx={{ borderBottom: "1px solid rgba(148,163,184,0.25)" }}
        >
          <Tab
            value="stopwatch"
            label={"Stopwatch"}
            sx={{ textTransform: "none", fontWeight: 600 }}
          />
          <Tab
            value="timer"
            label={"Countdown timer"}
            sx={{ textTransform: "none", fontWeight: 600 }}
          />
        </Tabs>

        <Box
          sx={{
            p: { xs: 1.5, sm: 2.5 },
            borderRadius: 2,
            border: "1px solid rgba(59,130,246,0.35)",
            background:
              "linear-gradient(140deg, rgba(59,130,246,0.17) 0%, rgba(15,23,42,0.12) 55%, rgba(14,165,233,0.12) 100%)",
          }}
        >
          {tab === "stopwatch" ? (
            <Stack spacing={2} alignItems="center">
              <Typography
                component="p"
                sx={{
                  fontFamily: MONOSPACE,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  fontSize: { xs: "2.6rem", sm: "4rem" },
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: 1,
                }}
              >
                {formatDuration(swElapsed, true)}
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
                justifyContent="center"
              >
                <ActionButton onClick={toggleStopwatch}>
                  {swRunning
                    ? "Pause"
                    : swElapsed > 0
                      ? "Resume"
                      : "Start"}
                </ActionButton>
                <TransparentButton
                  label={"Lap"}
                  onClick={recordLap}
                  disabled={swElapsed === 0}
                />
                <TransparentButton
                  label={"Reset"}
                  onClick={resetStopwatch}
                  disabled={swElapsed === 0 && laps.length === 0}
                />
                <TransparentButton
                  label={"Copy laps"}
                  onClick={() => void copyLaps()}
                  disabled={laps.length === 0}
                />
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={2.5} alignItems="center">
              <Box sx={{ position: "relative", display: "inline-flex" }}>
                <CircularProgress
                  variant="determinate"
                  value={100}
                  size={190}
                  thickness={3}
                  sx={{ color: "rgba(148,163,184,0.25)" }}
                />
                <CircularProgress
                  variant="determinate"
                  value={progress}
                  size={190}
                  thickness={3}
                  sx={{ position: "absolute", left: 0 }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography
                    component="p"
                    sx={{
                      fontFamily: MONOSPACE,
                      fontWeight: 700,
                      fontSize: { xs: "1.8rem", sm: "2.2rem" },
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatDuration(timerDisplay, false)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {timerRunning || remaining > 0
                      ? "Remaining"
                      : "Ready to start"}
                  </Typography>
                </Box>
              </Box>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                justifyContent="center"
                sx={{ width: "100%" }}
              >
                <TextField
                  label={"Hours"}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  {...numberFieldProps}
                />
                <TextField
                  label={"Minutes"}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  {...numberFieldProps}
                />
                <TextField
                  label={"Seconds"}
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  {...numberFieldProps}
                />
              </Stack>

              <Stack spacing={1} sx={{ width: "100%" }} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  {"Quick presets"}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  useFlexGap
                  justifyContent="center"
                >
                  {presets.map((totalSeconds) => (
                    <Chip
                      key={totalSeconds}
                      size="small"
                      clickable
                      onClick={() => applyPreset(totalSeconds)}
                      label={
                        totalSeconds >= 3600
                          ? `${totalSeconds / 3600} h`
                          : `${totalSeconds / 60} min`
                      }
                      sx={{
                        bgcolor: "rgba(59,130,246,0.2)",
                        border: "1px solid rgba(59,130,246,0.45)",
                      }}
                    />
                  ))}
                </Stack>
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
                justifyContent="center"
              >
                <ActionButton onClick={timerRunning ? pauseTimer : startTimer}>
                  {timerRunning
                    ? "Pause"
                    : remaining > 0
                      ? "Resume"
                      : "Start"}
                </ActionButton>
                <TransparentButton
                  label={"Reset"}
                  onClick={resetTimer}
                  disabled={!timerRunning && remaining === 0 && duration === 0}
                />
              </Stack>

              <FormControlLabel
                control={
                  <Switch
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                  />
                }
                label={"Sound alert when time is up"}
              />
            </Stack>
          )}
        </Box>

        <ToolStatusAlerts error={error} success={success} info={info} />

        {tab === "stopwatch" && laps.length > 0 && (
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
              spacing={1}
              alignItems="center"
              sx={{
                px: 1.5,
                py: 1.2,
                borderBottom: "1px solid rgba(148,163,184,0.2)",
              }}
            >
              <Typography variant="subtitle2" fontWeight={700}>
                {"Lap times"}
              </Typography>
              <Chip
                size="small"
                label={laps.length}
                sx={{
                  bgcolor: "rgba(59,130,246,0.2)",
                  border: "1px solid rgba(59,130,246,0.45)",
                }}
              />
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "70px 1fr 1fr",
                gap: 1,
                px: 2.2,
                py: 0.9,
                borderBottom: "1px solid rgba(148,163,184,0.15)",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {"Lap"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {"Lap time"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {"Total time"}
              </Typography>
            </Box>

            <Box sx={{ maxHeight: 320, overflow: "auto", px: 1.2, py: 0.6 }}>
              {laps.map((lap) => {
                const isFastest = fastestLap?.index === lap.index;
                const isSlowest = slowestLap?.index === lap.index;

                return (
                  <Box
                    key={lap.index}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "70px 1fr 1fr",
                      gap: 1,
                      alignItems: "center",
                      px: 1,
                      py: 0.9,
                      borderRadius: 1,
                      "&:nth-of-type(odd)": {
                        bgcolor: "rgba(148,163,184,0.06)",
                      },
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      #{lap.index}
                    </Typography>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <Typography
                        sx={{
                          fontFamily: MONOSPACE,
                          fontSize: 13,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatDuration(lap.split, true)}
                      </Typography>
                      {isFastest && (
                        <Chip
                          size="small"
                          label={"Fastest"}
                          color="success"
                          variant="outlined"
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      )}
                      {isSlowest && (
                        <Chip
                          size="small"
                          label={"Slowest"}
                          color="warning"
                          variant="outlined"
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      )}
                    </Stack>
                    <Typography
                      sx={{
                        fontFamily: MONOSPACE,
                        fontSize: 13,
                        color: "text.secondary",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatDuration(lap.total, true)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Stack>
    </PageContainer>
  );
};

export default TimerStopwatch;
