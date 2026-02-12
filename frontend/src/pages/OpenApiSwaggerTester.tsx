import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

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
type SpecMethod = Lowercase<HttpMethod>;
type BodyMode = "json" | "raw";
type ParamLocation = "path" | "query" | "header" | "cookie";

type KeyValueRow = { id: string; key: string; value: string };
type OpenApiParameter = {
  name: string;
  in: ParamLocation;
  required?: boolean;
  description?: string;
  example?: unknown;
};
type OpenApiOperation = {
  summary?: string;
  description?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    content?: Record<string, { example?: unknown }>;
  };
};
type OpenApiPathItem = {
  parameters?: OpenApiParameter[];
} & Partial<Record<SpecMethod, OpenApiOperation>>;
type OpenApiSpec = {
  info?: { title?: string; version?: string };
  servers?: Array<{ url?: string }>;
  paths?: Record<string, OpenApiPathItem>;
};
type Endpoint = {
  id: string;
  method: SpecMethod;
  path: string;
  summary: string;
  parameters: OpenApiParameter[];
  requestBody?: OpenApiOperation["requestBody"];
};
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
const SPEC_METHODS: SpecMethod[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
];

function createRow(key = "", value = ""): KeyValueRow {
  const id = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id, key, value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function normalizeParams(value: unknown): OpenApiParameter[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is OpenApiParameter => {
    if (!isRecord(item)) return false;
    return typeof item.name === "string" && typeof item.in === "string";
  });
}

function mergeParams(
  pathParams: OpenApiParameter[],
  opParams: OpenApiParameter[],
) {
  const map = new Map<string, OpenApiParameter>();
  for (const param of pathParams) map.set(`${param.in}:${param.name}`, param);
  for (const param of opParams) map.set(`${param.in}:${param.name}`, param);
  return Array.from(map.values());
}

function formatUnknown(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function bodyExample(endpoint: Endpoint) {
  const content = endpoint.requestBody?.content;
  if (!content || !isRecord(content)) return "";
  const jsonContent =
    content["application/json"] ??
    Object.entries(content).find(([key]) => key.toLowerCase().includes("json"))
      ?.[1];
  return formatUnknown(jsonContent?.example);
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

const OpenApiSwaggerTester: React.FC = () => {
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

  const [specUrl, setSpecUrl] = useState("");
  const [specText, setSpecText] = useState("");
  const [specError, setSpecError] = useState("");
  const [parsedSpec, setParsedSpec] = useState<OpenApiSpec | null>(null);
  const [loadingSpec, setLoadingSpec] = useState(false);
  const [specServerUrl, setSpecServerUrl] = useState("");
  const [endpointSearch, setEndpointSearch] = useState("");

  const canHaveBody = method !== "GET" && method !== "HEAD";

  const endpoints = useMemo<Endpoint[]>(() => {
    if (!parsedSpec?.paths) return [];
    const items: Endpoint[] = [];

    for (const [path, pathItemRaw] of Object.entries(parsedSpec.paths)) {
      if (!isRecord(pathItemRaw)) continue;
      const pathItem = pathItemRaw as OpenApiPathItem;
      const pathLevelParams = normalizeParams(pathItem.parameters);

      for (const methodName of SPEC_METHODS) {
        const operation = pathItem[methodName];
        if (!isRecord(operation)) continue;
        const params = mergeParams(
          pathLevelParams,
          normalizeParams(operation.parameters),
        );
        items.push({
          id: `${methodName}:${path}`,
          method: methodName,
          path,
          summary: operation.summary || "No summary",
          parameters: params,
          requestBody: operation.requestBody,
        });
      }
    }
    return items.sort((a, b) =>
      a.path === b.path
        ? a.method.localeCompare(b.method)
        : a.path.localeCompare(b.path),
    );
  }, [parsedSpec]);

  const filteredEndpoints = useMemo(() => {
    const query = endpointSearch.trim().toLowerCase();
    if (!query) return endpoints;
    return endpoints.filter((item) =>
      [item.method, item.path, item.summary].join(" ").toLowerCase().includes(query),
    );
  }, [endpointSearch, endpoints]);

  const parseSpec = (raw: string) => {
    const input = raw.trim();
    if (!input) {
      setSpecError("Paste an OpenAPI/Swagger JSON document first.");
      setParsedSpec(null);
      return;
    }
    let parsed: OpenApiSpec;
    try {
      parsed = JSON.parse(input) as OpenApiSpec;
    } catch {
      setSpecError("Invalid JSON. YAML is not supported yet.");
      setParsedSpec(null);
      return;
    }
    if (!parsed.paths || !isRecord(parsed.paths)) {
      setSpecError("Spec must contain a valid `paths` object.");
      setParsedSpec(null);
      return;
    }
    setParsedSpec(parsed);
    setSpecError("");
    const firstServer = parsed.servers?.[0]?.url || "";
    if (!specServerUrl.trim() && firstServer) setSpecServerUrl(firstServer);
  };

  const loadSpecFromUrl = async () => {
    const targetUrl = specUrl.trim();
    if (!targetUrl) {
      setSpecError("Enter a spec URL first.");
      return;
    }
    setLoadingSpec(true);
    setSpecError("");
    try {
      const result = await fetch(targetUrl);
      if (!result.ok) {
        setSpecError(`Failed to load spec (${result.status} ${result.statusText}).`);
        return;
      }
      const text = await result.text();
      setSpecText(text);
      parseSpec(text);
    } catch {
      setSpecError("Could not fetch spec URL. CORS may block this request.");
    } finally {
      setLoadingSpec(false);
    }
  };

  const useEndpoint = (endpoint: Endpoint) => {
    const root = specServerUrl.trim().replace(/\/+$/, "");
    const path = endpoint.path.startsWith("/") ? endpoint.path : `/${endpoint.path}`;
    setMethod(endpoint.method.toUpperCase() as HttpMethod);
    setRequestUrl(root ? `${root}${path}` : path);
    setPathRows(
      endpoint.parameters
        .filter((p) => p.in === "path")
        .map((p) => createRow(p.name, formatUnknown(p.example))) || [createRow()],
    );
    setQueryRows(
      endpoint.parameters
        .filter((p) => p.in === "query")
        .map((p) => createRow(p.name, formatUnknown(p.example))) || [createRow()],
    );
    const headers = endpoint.parameters
      .filter((p) => p.in === "header")
      .map((p) => createRow(p.name, formatUnknown(p.example)));
    setHeaderRows(headers.length ? headers : [createRow()]);
    setBodyMode("json");
    setRequestBody(bodyExample(endpoint));
    setRunError("");
    setResponse(null);
  };

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
        <Alert severity="info">
          Postman-style tester first. OpenAPI import is optional for quickly filling
          endpoint details.
        </Alert>

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

            <Stack direction="row" spacing={1}>
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

        <Paper variant="outlined" sx={{ borderColor: "divider", p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">OpenAPI Assistant (Optional)</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <TextField
                fullWidth
                size="small"
                label="Spec URL"
                value={specUrl}
                onChange={(event) => setSpecUrl(event.target.value)}
                placeholder="https://example.com/openapi.json"
              />
              <Button variant="outlined" onClick={loadSpecFromUrl} disabled={loadingSpec}>
                {loadingSpec ? "Loading..." : "Load URL"}
              </Button>
              <Button variant="contained" onClick={() => parseSpec(specText)}>
                Parse Spec
              </Button>
            </Stack>
            <TextField
              fullWidth
              multiline
              minRows={6}
              label="OpenAPI / Swagger JSON"
              value={specText}
              onChange={(event) => setSpecText(event.target.value)}
            />
            {specError && <Alert severity="error">{specError}</Alert>}
            {parsedSpec && (
              <Alert severity="success">
                Loaded {parsedSpec.info?.title || "API"}{" "}
                {parsedSpec.info?.version ? `(v${parsedSpec.info.version})` : ""} with{" "}
                {endpoints.length} endpoint{endpoints.length === 1 ? "" : "s"}.
              </Alert>
            )}
            {parsedSpec && (
              <>
                <TextField
                  fullWidth
                  size="small"
                  label="Server URL for imported endpoints (optional)"
                  value={specServerUrl}
                  onChange={(event) => setSpecServerUrl(event.target.value)}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Search endpoints"
                  value={endpointSearch}
                  onChange={(event) => setEndpointSearch(event.target.value)}
                />
                <Paper variant="outlined" sx={{ borderColor: "divider", maxHeight: 360, overflow: "auto" }}>
                  {!filteredEndpoints.length ? (
                    <Typography sx={{ p: 2 }} color="text.secondary">
                      No endpoints found.
                    </Typography>
                  ) : (
                    filteredEndpoints.map((endpoint) => (
                      <Box
                        key={endpoint.id}
                        sx={{
                          display: "grid",
                          gap: 1,
                          gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
                          px: 1.25,
                          py: 1,
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              size="small"
                              label={endpoint.method.toUpperCase()}
                              color={methodColor(endpoint.method)}
                            />
                            <Typography variant="body2">{endpoint.path}</Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {endpoint.summary}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => useEndpoint(endpoint)}
                          >
                            Use In Tester
                          </Button>
                        </Box>
                      </Box>
                    ))
                  )}
                </Paper>
              </>
            )}
          </Stack>
        </Paper>
      </Stack>
    </PageContainer>
  );
};

export default OpenApiSwaggerTester;
