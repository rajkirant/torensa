import React, { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import PageContainer from "../components/PageContainer";
import { TransparentButton } from "../components/buttons/TransparentButton";

type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "TRACE";
type BodyMode = "json" | "raw";

type KeyValueRow = { id: string; key: string; value: string };
type ApiResponse = {
  method: string;
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  headers: Array<[string, string]>;
  body: string;
};

const HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "TRACE",
];

function createRow(key = "", value = ""): KeyValueRow {
  const id = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id, key, value };
}

function methodColor(method: string) {
  const value = method.toUpperCase();
  if (value === "GET") return "success";
  if (value === "POST") return "primary";
  if (value === "PUT") return "warning";
  if (value === "PATCH") return "secondary";
  if (value === "DELETE") return "error";
  return "default";
}

function statusColor(status: number) {
  if (status >= 200 && status < 300) return "success";
  if (status >= 300 && status < 400) return "info";
  if (status >= 400 && status < 500) return "warning";
  if (status >= 500) return "error";
  return "default";
}

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ParamEditor({
  title,
  rows,
  setRows,
}: {
  title: string;
  rows: KeyValueRow[];
  setRows: React.Dispatch<React.SetStateAction<KeyValueRow[]>>;
}) {
  return (
    <Paper variant="outlined" sx={{ borderColor: "divider", p: 1.25 }}>
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center">
          <Typography variant="subtitle2">{title}</Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            onClick={() => setRows((current) => [...current, createRow()])}
            sx={{ textTransform: "none" }}
          >
            Add
          </Button>
        </Stack>
        {rows.map((row) => (
          <Stack key={row.id} direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              label="Key"
              value={row.key}
              onChange={(event) =>
                setRows((current) =>
                  current.map((item) =>
                    item.id === row.id ? { ...item, key: event.target.value } : item,
                  ),
                )
              }
            />
            <TextField
              fullWidth
              size="small"
              label="Value"
              value={row.value}
              onChange={(event) =>
                setRows((current) =>
                  current.map((item) =>
                    item.id === row.id
                      ? { ...item, value: event.target.value }
                      : item,
                  ),
                )
              }
            />
            <Button
              size="small"
              color="error"
              onClick={() =>
                setRows((current) => {
                  const next = current.filter((item) => item.id !== row.id);
                  return next.length ? next : [createRow()];
                })
              }
              sx={{ minWidth: 74, textTransform: "none" }}
            >
              Remove
            </Button>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

const ApiForge: React.FC = () => {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [requestUrl, setRequestUrl] = useState("");
  const [pathRows, setPathRows] = useState<KeyValueRow[]>([createRow()]);
  const [queryRows, setQueryRows] = useState<KeyValueRow[]>([createRow()]);
  const [headerRows, setHeaderRows] = useState<KeyValueRow[]>([createRow()]);
  const [bearerToken, setBearerToken] = useState("");
  const [bodyMode, setBodyMode] = useState<BodyMode>("json");
  const [requestBody, setRequestBody] = useState("");
  const [runError, setRunError] = useState("");
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  const canHaveBody = method !== "GET" && method !== "HEAD";

  const sendRequest = async () => {
    const rawUrl = requestUrl.trim();
    if (!rawUrl) {
      setRunError("Request URL is required.");
      return;
    }
    setRunError("");
    setResponse(null);

    let resolvedUrl = rawUrl;
    const missingPathValues: string[] = [];
    for (const row of pathRows) {
      const key = row.key.trim();
      if (!key) continue;
      const tokenRegex = new RegExp(`\\{${escapeRegExp(key)}\\}`, "g");
      if (!tokenRegex.test(resolvedUrl)) continue;
      const value = row.value.trim();
      if (!value) {
        missingPathValues.push(key);
        continue;
      }
      resolvedUrl = resolvedUrl.replace(tokenRegex, encodeURIComponent(value));
    }
    if (missingPathValues.length) {
      setRunError(`Missing path values for: ${missingPathValues.join(", ")}`);
      return;
    }
    const unresolved = resolvedUrl.match(/\{[^}]+\}/g);
    if (unresolved?.length) {
      setRunError(`Unresolved URL placeholders: ${unresolved.join(", ")}`);
      return;
    }

    let url: URL;
    try {
      url = isAbsoluteUrl(resolvedUrl)
        ? new URL(resolvedUrl)
        : new URL(resolvedUrl, window.location.origin);
    } catch {
      setRunError("Invalid request URL.");
      return;
    }

    for (const row of queryRows) {
      if (row.key.trim()) url.searchParams.set(row.key.trim(), row.value);
    }

    const headers: Record<string, string> = {};
    for (const row of headerRows) {
      if (row.key.trim()) headers[row.key.trim()] = row.value;
    }
    if (bearerToken.trim()) headers.Authorization = `Bearer ${bearerToken.trim()}`;

    let body: string | undefined;
    if (canHaveBody && requestBody.trim()) {
      if (bodyMode === "json") {
        try {
          body = JSON.stringify(JSON.parse(requestBody));
        } catch {
          setRunError("Request body is not valid JSON.");
          return;
        }
      } else {
        body = requestBody;
      }
      const hasContentType = Object.keys(headers).some(
        (name) => name.toLowerCase() === "content-type",
      );
      if (!hasContentType) {
        headers["Content-Type"] =
          bodyMode === "json" ? "application/json" : "text/plain";
      }
    }

    setRunning(true);
    const started = performance.now();
    const finalUrl = url.toString();
    try {
      const result = await fetch(finalUrl, {
        method,
        headers,
        body,
        credentials: "include",
      });
      const rawBody = await result.text();
      const contentType = (result.headers.get("content-type") || "").toLowerCase();
      let formattedBody = rawBody;
      if (rawBody && (contentType.includes("application/json") || contentType.includes("+json"))) {
        try {
          formattedBody = JSON.stringify(JSON.parse(rawBody), null, 2);
        } catch {
          formattedBody = rawBody;
        }
      }
      setResponse({
        method,
        url: finalUrl,
        status: result.status,
        statusText: result.statusText,
        durationMs: Math.round(performance.now() - started),
        headers: Array.from(result.headers.entries()),
        body: formattedBody,
      });
    } catch {
      setRunError(
        "Request failed. Common causes: CORS, invalid host, SSL issues, or network errors.",
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <PageContainer maxWidth={1320}>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ borderColor: "divider", p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="h6">API Tester</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <Select
                size="small"
                value={method}
                onChange={(event) => setMethod(event.target.value as HttpMethod)}
                sx={{ minWidth: 120 }}
              >
                {HTTP_METHODS.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
              <TextField
                fullWidth
                size="small"
                label="Request URL"
                placeholder="https://api.example.com/users/{id}"
                value={requestUrl}
                onChange={(event) => setRequestUrl(event.target.value)}
              />
              <Button variant="contained" onClick={sendRequest} disabled={running}>
                {running ? "Sending..." : "Send"}
              </Button>
            </Stack>

            <TextField
              fullWidth
              size="small"
              label="JWT Bearer Token (optional)"
              value={bearerToken}
              onChange={(event) => setBearerToken(event.target.value)}
              placeholder="eyJhbGciOi..."
            />

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <TransparentButton
                label="Clear Request"
                onClick={() => {
                  setMethod("GET");
                  setRequestUrl("");
                  setPathRows([createRow()]);
                  setQueryRows([createRow()]);
                  setHeaderRows([createRow()]);
                  setBearerToken("");
                  setBodyMode("json");
                  setRequestBody("");
                  setRunError("");
                }}
              />
              <TransparentButton
                label="Clear Response"
                onClick={() => {
                  setRunError("");
                  setResponse(null);
                }}
              />
            </Stack>

            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr 1fr" },
              }}
            >
              <ParamEditor title="Path Params" rows={pathRows} setRows={setPathRows} />
              <ParamEditor
                title="Query Params"
                rows={queryRows}
                setRows={setQueryRows}
              />
              <ParamEditor title="Headers" rows={headerRows} setRows={setHeaderRows} />
            </Box>

            <Paper variant="outlined" sx={{ borderColor: "divider", p: 1.25 }}>
              <Stack spacing={1}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Typography variant="subtitle2">Request Body</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Select
                    size="small"
                    value={bodyMode}
                    onChange={(event) => setBodyMode(event.target.value as BodyMode)}
                    sx={{ minWidth: 140 }}
                  >
                    <MenuItem value="json">JSON</MenuItem>
                    <MenuItem value="raw">Raw Text</MenuItem>
                  </Select>
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  minRows={8}
                  label={`Body (${bodyMode.toUpperCase()})`}
                  value={requestBody}
                  onChange={(event) => setRequestBody(event.target.value)}
                  disabled={!canHaveBody}
                  helperText={
                    canHaveBody ? "Included in request." : "GET/HEAD ignore body."
                  }
                  InputProps={{
                    sx: {
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: 13,
                    },
                  }}
                />
              </Stack>
            </Paper>

            {runError && <Alert severity="error">{runError}</Alert>}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ borderColor: "divider", p: 2 }}>
          <Stack spacing={1.2}>
            <Typography variant="h6">Response</Typography>
            {!response ? (
              <Typography color="text.secondary">
                Send a request to see status, timing, headers, and body.
              </Typography>
            ) : (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                  <Chip
                    size="small"
                    label={`${response.status} ${response.statusText}`}
                    color={statusColor(response.status)}
                  />
                  <Chip
                    size="small"
                    label={response.method}
                    color={methodColor(response.method)}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {response.url}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    {response.durationMs} ms
                  </Typography>
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Response Headers"
                  value={
                    response.headers.length
                      ? response.headers.map(([k, v]) => `${k}: ${v}`).join("\n")
                      : "(none)"
                  }
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={10}
                  label="Response Body"
                  value={response.body || "(empty response body)"}
                  InputProps={{
                    readOnly: true,
                    sx: {
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: 13,
                    },
                  }}
                />
              </>
            )}
          </Stack>
        </Paper>

      </Stack>
    </PageContainer>
  );
};

export default ApiForge;
