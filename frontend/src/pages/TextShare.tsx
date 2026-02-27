import React, { useEffect, useMemo, useRef, useState } from "react";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import RefreshIcon from "@mui/icons-material/Refresh";

import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import useToolStatus from "../hooks/useToolStatus";
import { apiFetch } from "../utils/api";

const CODE_LENGTH = 4;
const MAX_TEXT_LENGTH = 20000;
const SHARE_DEBOUNCE_MS = 700;

const sanitizeCode = (value: string) =>
  value.replace(/\D/g, "").slice(0, CODE_LENGTH);

const TextShareContent: React.FC = () => {
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [lastSharedText, setLastSharedText] = useState("");
  const skipShareRef = useRef(false);
  const shareTimerRef = useRef<number | null>(null);

  const { error, success, info, setError, setSuccess, setInfo, clear } =
    useToolStatus();

  const remainingChars = useMemo(
    () => `${text.length}/${MAX_TEXT_LENGTH} characters`,
    [text.length],
  );

  const shareText = async (value: string) => {
    if (!value.trim()) {
      setError("Enter some text to share.");
      return;
    }

    setIsSharing(true);
    clear();

    try {
      const res = await apiFetch("/api/text-share/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Unable to generate a code.");
        return;
      }

      setCode(String(data.code || ""));
      setExpiresAt(data.expiresAt || null);
      setLastSharedText(value);
      setSuccess("Code generated. Share it with the other device.");
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setIsSharing(false);
    }
  };

  const fetchText = async (value: string) => {
    if (value.length !== CODE_LENGTH) {
      setError("Enter a 4-digit code.");
      return;
    }

    setIsFetching(true);
    clear();

    try {
      const res = await apiFetch(`/api/text-share/${value}/`, {
        method: "GET",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Code not found or expired.");
        return;
      }

      skipShareRef.current = true;
      setText(String(data.text || ""));
      setExpiresAt(data.expiresAt || null);
      setSuccess("Text loaded from the shared code.");
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setIsFetching(false);
    }
  };

  const fetchLatestByIp = async () => {
    setIsFetching(true);

    try {
      const res = await apiFetch("/api/text-share/latest/", {
        method: "GET",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return;
      }

      skipShareRef.current = true;
      setCode(String(data.code || ""));
      setText(String(data.text || ""));
      setExpiresAt(data.expiresAt || null);
      setSuccess("Loaded the latest shared text for this network.");
    } catch {
      // Silent fail: no recent share for this IP or server unreachable.
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (shareTimerRef.current) {
      window.clearTimeout(shareTimerRef.current);
    }

    if (skipShareRef.current) {
      skipShareRef.current = false;
      return;
    }

    if (!text.trim() || text === lastSharedText) {
      if (!text.trim()) {
        setCode("");
        setExpiresAt(null);
        setLastSharedText("");
      }
      return;
    }

    shareTimerRef.current = window.setTimeout(() => {
      void shareText(text);
    }, SHARE_DEBOUNCE_MS);

    return () => {
      if (shareTimerRef.current) {
        window.clearTimeout(shareTimerRef.current);
      }
    };
  }, [text, lastSharedText]);

  useEffect(() => {
    void fetchLatestByIp();
  }, []);

  const handleCodeChange = (value: string) => {
    const next = sanitizeCode(value);
    setCode(next);
    setError();
    setSuccess();

    if (next.length === CODE_LENGTH) {
      void fetchText(next);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack
        spacing={2}
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderRadius: 2,
          border: "1px solid rgba(59,130,246,0.35)",
          background:
            "linear-gradient(140deg, rgba(59,130,246,0.16) 0%, rgba(15,23,42,0.12) 55%, rgba(14,165,233,0.12) 100%)",
        }}
      >
        <TextField
          label="Access Code"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 4 }}
          placeholder="0000"
          helperText={
            isFetching
              ? "Checking for recent shares on this network..."
              : "Enter a 4-digit code to load text from another device."
          }
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">#</InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Load latest shared text"
                  onClick={() => void fetchLatestByIp()}
                  disabled={isFetching}
                  edge="end"
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
          fullWidth
        />

        <TextField
          label="Shared Text"
          value={text}
          onChange={(e) => {
            const next = e.target.value.slice(0, MAX_TEXT_LENGTH);
            setText(next);
            setInfo("");
          }}
          placeholder="Paste or type text here to generate a code."
          multiline
          minRows={6}
          fullWidth
          helperText={remainingChars}
        />

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            onClick={() => void shareText(text)}
            disabled={!text.trim() || isSharing}
          >
            {isSharing ? "Generating..." : "Generate Code"}
          </Button>
          <Button
            variant="text"
            onClick={() => {
              setText("");
              setCode("");
              setExpiresAt(null);
              setLastSharedText("");
              clear();
            }}
          >
            Clear
          </Button>
        </Stack>

        {expiresAt && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Code expires around {new Date(expiresAt).toLocaleTimeString()}.
            </Typography>
          </Box>
        )}
      </Stack>

      <ToolStatusAlerts error={error} success={success} info={info} />
    </Stack>
  );
};

const TextShare: React.FC = () => {
  return (
    <PageContainer maxWidth={640}>
      <TextShareContent />
    </PageContainer>
  );
};

export default TextShare;
