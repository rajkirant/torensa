import { useState } from "react";
import { Stack, TextField } from "@mui/material";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { TransparentButton } from "../components/buttons/TransparentButton";
import FlexWrapRow from "../components/layout/FlexWrapRow";
import useToolStatus from "../hooks/useToolStatus";

type ParseResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      message: string;
      line?: number;
      column?: number;
    };

function indexToLineColumn(input: string, index: number) {
  const safeIndex = Math.max(0, Math.min(index, input.length));
  let line = 1;
  let column = 1;

  for (let i = 0; i < safeIndex; i += 1) {
    if (input[i] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function parseJsonText(text: string): ParseResult {
  const source = text.replace(/\r\n/g, "\n");
  if (!source.trim()) {
    return {
      ok: false,
      message: "Input is empty.",
      line: 1,
      column: 1,
    };
  }

  try {
    return { ok: true, value: JSON.parse(source) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to parse JSON.";
    const positionMatch = message.match(/position\s+(\d+)/i);

    if (!positionMatch) {
      return { ok: false, message };
    }

    const position = Number(positionMatch[1]);
    if (!Number.isFinite(position)) {
      return { ok: false, message };
    }

    const { line, column } = indexToLineColumn(source, position);
    return { ok: false, message, line, column };
  }
}

const SAMPLE_JSON = JSON.stringify(
  {
    project: "torensa",
    tools: ["json-formatter", "json-validator", "json-minifier"],
    settings: {
      version: 1,
      active: true,
    },
  },
  null,
  2,
);

export default function JsonFormatterDiff() {
  const [jsonText, setJsonText] = useState("");
  const { error, success, info, setError, setSuccess, setInfo } = useToolStatus();

  const clearAlerts = () => {
    setError();
    setSuccess();
  };

  const handleValidate = () => {
    clearAlerts();
    const parsed = parseJsonText(jsonText);
    if (parsed.ok) {
      setSuccess("Valid JSON.");
      return;
    }

    const location =
      parsed.line && parsed.column
        ? ` (line ${parsed.line}, col ${parsed.column})`
        : "";
    setError(`${parsed.message}${location}`);
  };

  const handleFormat = () => {
    clearAlerts();
    const parsed = parseJsonText(jsonText);
    if (!parsed.ok) {
      const location =
        parsed.line && parsed.column
          ? ` (line ${parsed.line}, col ${parsed.column})`
          : "";
      setError(`${parsed.message}${location}`);
      return;
    }

    setJsonText(JSON.stringify(parsed.value, null, 2));
    setSuccess("Formatted with 2-space indentation.");
  };

  const handleMinify = () => {
    clearAlerts();
    const parsed = parseJsonText(jsonText);
    if (!parsed.ok) {
      const location =
        parsed.line && parsed.column
          ? ` (line ${parsed.line}, col ${parsed.column})`
          : "";
      setError(`${parsed.message}${location}`);
      return;
    }

    setJsonText(JSON.stringify(parsed.value));
    setSuccess("Minified JSON.");
  };

  const handleCopy = async () => {
    clearAlerts();
    if (!jsonText.trim()) {
      setInfo("Editor is empty.");
      return;
    }

    try {
      await navigator.clipboard.writeText(jsonText);
      setSuccess("Copied to clipboard.");
    } catch {
      setError("Copy failed. Clipboard permission may be blocked.");
    }
  };

  const handleClear = () => {
    clearAlerts();
    setJsonText("");
  };

  const handleSample = () => {
    clearAlerts();
    setJsonText(SAMPLE_JSON);
    setSuccess("Sample JSON loaded.");
  };

  return (
    <PageContainer maxWidth={960}>
      <Stack spacing={2}>
        <ToolStatusAlerts error={error} success={success} info={info} />

        <FlexWrapRow>
          <TransparentButton label="Validate" onClick={handleValidate} />
          <TransparentButton label="Format" onClick={handleFormat} />
          <TransparentButton label="Minify" onClick={handleMinify} />
          <TransparentButton label="Load Sample" onClick={handleSample} />
          <TransparentButton label="Copy" onClick={handleCopy} />
          <TransparentButton label="Clear" onClick={handleClear} />
        </FlexWrapRow>

        <TextField
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          placeholder='Paste JSON here, for example: {"name":"torensa"}'
          multiline
          fullWidth
          minRows={16}
          InputProps={{
            sx: {
              "& textarea": {
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 13,
                lineHeight: 1.6,
              },
            },
          }}
        />
      </Stack>
    </PageContainer>
  );
}
