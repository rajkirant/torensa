import { Fragment } from "react";
import {
  Alert,
  Box,
  TextField,
  Typography,
  Stack,
} from "@mui/material";
import { TransparentButton } from "../../components/buttons/TransparentButton";

type HoverTip = { x: number; y: number; text: string } | null;

const prettyJson = (obj: unknown) => JSON.stringify(obj, null, 2);

const formatEpochSec = (epochSec: number) =>
  new Date(epochSec * 1000).toLocaleString();

const isEpochSeconds = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v < 99999999999;

function JsonWithTimeTooltips({
  obj,
  onHover,
}: {
  obj: any;
  onHover: (tip: HoverTip) => void;
}) {
  const renderValue = (
    key: string | null,
    value: any,
    indent: number,
  ): React.ReactNode => {
    const pad = " ".repeat(indent);

    if (value === null) return <span>null</span>;
    if (typeof value === "string") return <span>"{value}"</span>;
    if (typeof value === "boolean")
      return <span>{value ? "true" : "false"}</span>;

    if (typeof value === "number") {
      const isTimeKey = key === "exp" || key === "iat" || key === "nbf";
      if (isTimeKey && isEpochSeconds(value)) {
        return (
          <span
            style={{
              textDecoration: "underline dotted",
              cursor: "help",
            }}
            onMouseMove={(e) => {
              onHover({
                x: e.clientX + 12,
                y: e.clientY + 12,
                text: `${key}: ${formatEpochSec(value)} (${value})`,
              });
            }}
            onMouseLeave={() => onHover(null)}
          >
            {value}
          </span>
        );
      }
      return <span>{value}</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return <span>[]</span>;
      return (
        <>
          <span>[</span>
          {"\n"}
          {value.map((item, idx) => (
            <Fragment key={idx}>
              {pad}
              {"  "}
              {renderValue(null, item, indent + 2)}
              {idx < value.length - 1 ? "," : ""}
              {"\n"}
            </Fragment>
          ))}
          {pad}
          <span>]</span>
        </>
      );
    }

    const entries = Object.entries(value ?? {});
    if (entries.length === 0) return <span>{"{}"}</span>;

    return (
      <>
        <span>{"{"}</span>
        {"\n"}
        {entries.map(([k, v], idx) => (
          <Fragment key={k}>
            {pad}
            {"  "}
            <span>"{k}"</span>: {renderValue(k, v, indent + 2)}
            {idx < entries.length - 1 ? "," : ""}
            {"\n"}
          </Fragment>
        ))}
        {pad}
        <span>{"}"}</span>
      </>
    );
  };

  return (
    <pre
      style={{
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.6,
      }}
      onMouseLeave={() => onHover(null)}
    >
      {renderValue(null, obj, 0)}
    </pre>
  );
}

type DecodeAccordionProps = {
  jwtInput: string;
  setJwtInput: (value: string) => void;
  decoded: { header: Record<string, unknown>; payload: Record<string, unknown> } | null;
  onDecodeToInputs: () => void;
  onCopyJwt: () => Promise<void>;
  onClear: () => void;
  hoverTip: HoverTip;
  setHoverTip: (tip: HoverTip) => void;
  clearStatus: () => void;
};

export default function DecodeAccordion({
  jwtInput,
  setJwtInput,
  decoded,
  onDecodeToInputs,
  onCopyJwt,
  onClear,
  hoverTip,
  setHoverTip,
  clearStatus,
}: DecodeAccordionProps) {
  return (
    <Stack spacing={1.5}>
      <TextField
        label="JWT"
        placeholder="Paste a JWT here..."
        value={jwtInput}
        onChange={(e) => {
          setJwtInput(e.target.value);
          clearStatus();
        }}
        fullWidth
        multiline
        minRows={3}
      />

      <Stack direction="row" spacing={1} flexWrap="wrap">
        <TransparentButton label="Clear" onClick={onClear} />
        <TransparentButton
          label="Copy JWT"
          disabled={!jwtInput.trim()}
          onClick={() => void onCopyJwt()}
        />
        <TransparentButton
          label="Use decoded values in encoder"
          disabled={!decoded}
          onClick={onDecodeToInputs}
        />
      </Stack>

      {decoded ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
            alignItems: "stretch",
          }}
        >
          <TextField
            label="Header (decoded)"
            value={prettyJson(decoded.header)}
            fullWidth
            multiline
            minRows={10}
            InputProps={{
              readOnly: true,
              sx: {
                "& textarea": {
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                },
              },
            }}
          />

          <Box sx={{ position: "relative", minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              Payload (decoded) - hover exp/iat/nbf values for date
            </Typography>

            <Box
              sx={{
                mt: 0.75,
                p: 2,
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.12)",
                backgroundColor: "rgba(255,255,255,0.03)",
                minHeight: 260,
                width: "100%",
                minWidth: 0,
                overflow: "auto",
              }}
            >
              <JsonWithTimeTooltips obj={decoded.payload} onHover={setHoverTip} />
            </Box>
          </Box>

          {hoverTip && (
            <Box
              sx={{
                position: "fixed",
                left: hoverTip.x,
                top: hoverTip.y,
                zIndex: 2000,
                pointerEvents: "none",
                px: 1.2,
                py: 0.8,
                borderRadius: 1,
                bgcolor: "rgba(0,0,0,0.85)",
                color: "#fff",
                fontSize: 12,
                maxWidth: 360,
                boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
              }}
            >
              {hoverTip.text}
            </Box>
          )}
        </Box>
      ) : (
        jwtInput.trim() && (
          <Alert severity="warning">
            Could not decode this JWT (is it well-formed?).
          </Alert>
        )
      )}
    </Stack>
  );
}
