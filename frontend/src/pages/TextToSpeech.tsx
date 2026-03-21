import { useState, useRef, useCallback } from "react";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { TransparentButton } from "../components/buttons/TransparentButton";
import { ActionButton } from "../components/buttons/ActionButton";
import FlexWrapRow from "../components/layout/FlexWrapRow";
import useToolStatus from "../hooks/useToolStatus";

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function getVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis?.getVoices() ?? [];
}

function estimateDuration(text: string, rate: number): string {
  const words = text.trim().split(/\s+/).length;
  const wpm = 150 * rate;
  const seconds = Math.round((words / wpm) * 60);
  if (seconds < 60) return `~${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `~${m}m ${s}s`;
}

const SAMPLE_TEXT = `The quick brown fox jumps over the lazy dog. This sentence contains every letter of the English alphabet. Text-to-speech technology converts written text into natural-sounding audio, making content accessible to everyone.`;

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export default function TextToSpeech() {
  const [text, setText] = useState("");
  const [voiceUri, setVoiceUri] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(getVoices);

  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { error, success, info, setError, setSuccess, setInfo } =
    useToolStatus();

  // Voices may load asynchronously
  const refreshVoices = useCallback(() => {
    const v = getVoices();
    setVoices(v);
    if (v.length > 0 && !voiceUri) {
      const defaultVoice = v.find((voice) => voice.default) ?? v[0];
      setVoiceUri(defaultVoice.voiceURI);
    }
  }, [voiceUri]);

  // Trigger voice loading
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = refreshVoices;
    if (voices.length === 0) refreshVoices();
  }

  const clearAlerts = () => {
    setError();
    setSuccess();
    setInfo();
  };

  const handleSpeak = () => {
    clearAlerts();
    if (!text.trim()) {
      setInfo("Enter some text first.");
      return;
    }
    if (!window.speechSynthesis) {
      setError("Your browser does not support the Web Speech API.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = voices.find((v) => v.voiceURI === voiceUri);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    utterance.onstart = () => {
      setSpeaking(true);
      setPaused(false);
    };
    utterance.onend = () => {
      setSpeaking(false);
      setPaused(false);
      setSuccess("Finished speaking.");
    };
    utterance.onerror = (e) => {
      setSpeaking(false);
      setPaused(false);
      if (e.error !== "canceled") {
        setError(`Speech error: ${e.error}`);
      }
    };

    utterRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  };

  const handleResume = () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  };

  const handleClear = () => {
    clearAlerts();
    handleStop();
    setText("");
  };

  const handleSample = () => {
    clearAlerts();
    handleStop();
    setText(SAMPLE_TEXT);
    setSuccess("Sample text loaded.");
  };

  // Group voices by language
  const voicesByLang = voices.reduce(
    (acc, v) => {
      const lang = v.lang;
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push(v);
      return acc;
    },
    {} as Record<string, SpeechSynthesisVoice[]>,
  );

  const sortedLangs = Object.keys(voicesByLang).sort();

  return (
    <PageContainer maxWidth={960}>
      <Stack spacing={2}>
        <ToolStatusAlerts error={error} success={success} info={info} />

        <TextField
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste the text you want to hear spoken aloud..."
          multiline
          fullWidth
          minRows={8}
          InputProps={{
            sx: {
              "& textarea": {
                fontSize: 14,
                lineHeight: 1.7,
              },
            },
          }}
        />

        {text.trim() && (
          <Typography variant="body2" color="text.secondary">
            {text.trim().split(/\s+/).length} words &middot;{" "}
            {text.length} characters &middot; Est. duration:{" "}
            {estimateDuration(text, rate)}
          </Typography>
        )}

        <FormControl size="small" fullWidth>
          <InputLabel>Voice</InputLabel>
          <Select
            value={voiceUri}
            label="Voice"
            onChange={(e) => setVoiceUri(e.target.value)}
          >
            {sortedLangs.map((lang) =>
              voicesByLang[lang].map((v) => (
                <MenuItem key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang}){v.default ? " — Default" : ""}
                </MenuItem>
              )),
            )}
            {voices.length === 0 && (
              <MenuItem value="" disabled>
                No voices available
              </MenuItem>
            )}
          </Select>
        </FormControl>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={3}
          sx={{ px: 1 }}
        >
          <Stack spacing={0.5} sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Speed: {rate.toFixed(1)}x
            </Typography>
            <Slider
              value={rate}
              onChange={(_, v) => setRate(v as number)}
              min={0.5}
              max={2}
              step={0.1}
              size="small"
            />
          </Stack>
          <Stack spacing={0.5} sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Pitch: {pitch.toFixed(1)}
            </Typography>
            <Slider
              value={pitch}
              onChange={(_, v) => setPitch(v as number)}
              min={0}
              max={2}
              step={0.1}
              size="small"
            />
          </Stack>
          <Stack spacing={0.5} sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Volume: {Math.round(volume * 100)}%
            </Typography>
            <Slider
              value={volume}
              onChange={(_, v) => setVolume(v as number)}
              min={0}
              max={1}
              step={0.05}
              size="small"
            />
          </Stack>
        </Stack>

        <FlexWrapRow>
          {!speaking && (
            <ActionButton onClick={handleSpeak}>Speak</ActionButton>
          )}
          {speaking && !paused && (
            <TransparentButton label="Pause" onClick={handlePause} />
          )}
          {speaking && paused && (
            <ActionButton onClick={handleResume}>Resume</ActionButton>
          )}
          {speaking && (
            <TransparentButton label="Stop" onClick={handleStop} />
          )}
          <TransparentButton label="Load Sample" onClick={handleSample} />
          <TransparentButton label="Clear" onClick={handleClear} />
        </FlexWrapRow>
      </Stack>
    </PageContainer>
  );
}
