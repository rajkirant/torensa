import { useState } from "react";
import {
  Alert,
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { TransparentButton } from "../components/buttons/TransparentButton";
import FlexWrapRow from "../components/layout/FlexWrapRow";
import FilePickerButton from "../components/inputs/FilePickerButton";
import useToolStatus from "../hooks/useToolStatus";
import downloadBlob from "../utils/downloadBlob";

const LOG_LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

type LogEntry = {
  index: number;
  raw: string;
  firstLine: string;
  timestamp?: string;
  level?: LogLevel;
  logger?: string;
  message: string;
  exceptionType?: string;
  exceptionMessage?: string;
  causeChain: string[];
  stackFrames: string[];
  appFrames: string[];
  traceIds: string[];
  requestIds: string[];
  correlationIds: string[];
};

type FailureInsight = {
  entryIndex: number;
  message: string;
  timestamp?: string;
  logger?: string;
  exception?: string;
  cause?: string;
  location?: string;
  correlationId?: string;
};

type HistogramRow = {
  name: string;
  count: number;
};

type CorrelationRow = {
  id: string;
  errors: number;
  total: number;
};

type AnalysisResult = {
  entryCount: number;
  levelCount: Record<LogLevel, number>;
  errorCount: number;
  warningCount: number;
  exceptionCounts: HistogramRow[];
  loggerCounts: HistogramRow[];
  correlationRows: CorrelationRow[];
  missingCorrelationErrors: number;
  outOfOrderCount: number;
  primaryFailure?: FailureInsight;
  errorEntries: LogEntry[];
  reportText: string;
};

const LOG_START_REGEX =
  /^(?:\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}|TRACE\b|DEBUG\b|INFO\b|WARN\b|ERROR\b|FATAL\b)/;

const TIMESTAMP_LEVEL_REGEX =
  /^(?<timestamp>\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:[.,]\d{3,9})?(?:Z|[+-]\d{2}:?\d{2})?)\s+(?<level>TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\b(?<rest>.*)$/;

const LEVEL_ONLY_REGEX =
  /^(?<level>TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\b(?<rest>.*)$/;

const SPRING_REST_REGEX =
  /^(?:\d+\s+)?---\s+\[[^\]]+\]\s+(?<logger>[^:]+)\s*:\s*(?<message>.*)$/;

const SIMPLE_LOGGER_REGEX =
  /^(?<logger>[A-Za-z_$][A-Za-z0-9_.$-]+)\s*:\s*(?<message>.*)$/;

const EXCEPTION_REGEX =
  /^\s*([A-Za-z_$][A-Za-z0-9_.$]*(?:Exception|Error))(?::\s*(.+))?\s*$/;

const CAUSED_BY_REGEX =
  /^\s*Caused by:\s+([A-Za-z_$][A-Za-z0-9_.$]*(?:Exception|Error))(?::\s*(.+))?\s*$/;

const STACK_FRAME_REGEX = /^\s*at\s+([A-Za-z0-9_.$<>$]+)\(([^)]*)\)/;

const TRACE_ID_REGEX =
  /\b(?:traceid|trace_id|trace-id)\s*[=:]\s*([A-Za-z0-9-]{6,})\b/gi;

const REQUEST_ID_REGEX =
  /\b(?:requestid|request_id|request-id|x-request-id|correlationid|correlation_id|correlation-id)\s*[=:]\s*([A-Za-z0-9-]{6,})\b/gi;

const SLEUTH_TRACE_REGEX = /\[([A-Fa-f0-9]{8,64}),\s*[A-Fa-f0-9]{8,32}\]/g;

const FRAMEWORK_PREFIXES = [
  "java.",
  "javax.",
  "jakarta.",
  "sun.",
  "jdk.",
  "org.springframework.",
  "org.apache.",
  "org.hibernate.",
  "com.fasterxml.",
  "io.netty.",
  "reactor.",
  "kotlin.",
];

const SAMPLE_LOG = `2026-02-14 10:15:12.331 INFO 24560 --- [nio-8080-exec-4] c.torensa.order.OrderController : Creating order requestId=REQ-44 traceId=abc123def456
2026-02-14 10:15:12.519 ERROR 24560 --- [nio-8080-exec-4] c.torensa.order.OrderService : Failed to create order for customer=982 requestId=REQ-44 traceId=abc123def456
java.lang.IllegalStateException: Inventory service returned null payload
	at com.torensa.order.InventoryClient.fetchStock(InventoryClient.java:88)
	at com.torensa.order.OrderService.reserveStock(OrderService.java:145)
	at com.torensa.order.OrderService.create(OrderService.java:71)
Caused by: java.net.SocketTimeoutException: Read timed out
	at java.base/sun.nio.ch.NioSocketImpl.timedRead(NioSocketImpl.java:278)
	at java.base/sun.nio.ch.NioSocketImpl.implRead(NioSocketImpl.java:304)
2026-02-14 10:15:12.610 WARN 24560 --- [nio-8080-exec-4] o.s.w.s.m.m.a.ExceptionHandlerExceptionResolver : Resolved [org.springframework.web.HttpMediaTypeNotAcceptableException: No acceptable representation]
2026-02-14 10:16:04.001 ERROR 24560 --- [nio-8080-exec-7] c.torensa.user.UserController : Unexpected user lookup error requestId=REQ-45 traceId=fff999aaa222
java.lang.NullPointerException: Cannot invoke "String.length()" because "email" is null
	at com.torensa.user.UserService.findByEmail(UserService.java:53)
	at com.torensa.user.UserController.lookup(UserController.java:47)`;

function createLevelCount(): Record<LogLevel, number> {
  return {
    TRACE: 0,
    DEBUG: 0,
    INFO: 0,
    WARN: 0,
    ERROR: 0,
    FATAL: 0,
  };
}

function isLogLevel(level: string | undefined): level is LogLevel {
  if (!level) return false;
  return LOG_LEVELS.includes(level as LogLevel);
}

function splitLogEntries(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const entries: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const isStart = LOG_START_REGEX.test(line);
    if (isStart && current.length > 0) {
      entries.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    entries.push(current.join("\n"));
  }

  return entries.map((entry) => entry.trimEnd()).filter((entry) => entry.trim().length > 0);
}

function parseRest(rest: string): { logger?: string; message: string } {
  const cleaned = rest.trim();
  if (!cleaned) return { message: "" };

  const springMatch = cleaned.match(SPRING_REST_REGEX);
  if (springMatch) {
    return {
      logger: springMatch.groups?.logger?.trim(),
      message: springMatch.groups?.message?.trim() ?? "",
    };
  }

  const simpleMatch = cleaned.match(SIMPLE_LOGGER_REGEX);
  if (simpleMatch) {
    return {
      logger: simpleMatch.groups?.logger?.trim(),
      message: simpleMatch.groups?.message?.trim() ?? "",
    };
  }

  return { message: cleaned };
}

function parseHeader(firstLine: string): {
  timestamp?: string;
  level?: LogLevel;
  logger?: string;
  message: string;
} {
  const tsMatch = firstLine.match(TIMESTAMP_LEVEL_REGEX);
  if (tsMatch) {
    const levelText = tsMatch.groups?.level?.toUpperCase();
    const parsedRest = parseRest(tsMatch.groups?.rest ?? "");
    return {
      timestamp: tsMatch.groups?.timestamp?.trim(),
      level: isLogLevel(levelText) ? levelText : undefined,
      logger: parsedRest.logger,
      message: parsedRest.message,
    };
  }

  const levelMatch = firstLine.match(LEVEL_ONLY_REGEX);
  if (levelMatch) {
    const levelText = levelMatch.groups?.level?.toUpperCase();
    const parsedRest = parseRest(levelMatch.groups?.rest ?? "");
    return {
      level: isLogLevel(levelText) ? levelText : undefined,
      logger: parsedRest.logger,
      message: parsedRest.message,
    };
  }

  return { message: firstLine.trim() };
}

function extractException(lines: string[]) {
  let exceptionType: string | undefined;
  let exceptionMessage: string | undefined;
  const causeChain: string[] = [];

  for (const line of lines) {
    const causedByMatch = line.match(CAUSED_BY_REGEX);
    if (causedByMatch) {
      const causeType = causedByMatch[1]?.trim();
      const causeMessage = causedByMatch[2]?.trim();
      if (causeType) {
        const causeText = causeMessage ? `${causeType}: ${causeMessage}` : causeType;
        causeChain.push(causeText);
      }
      if (!exceptionType && causeType) {
        exceptionType = causeType;
        exceptionMessage = causeMessage;
      }
      continue;
    }

    const exceptionMatch = line.match(EXCEPTION_REGEX);
    if (exceptionMatch) {
      const type = exceptionMatch[1]?.trim();
      const message = exceptionMatch[2]?.trim();
      if (type && !exceptionType) {
        exceptionType = type;
        exceptionMessage = message;
      }
    }
  }

  return {
    exceptionType,
    exceptionMessage,
    causeChain,
  };
}

function extractStackFrames(lines: string[]) {
  const stackFrames: string[] = [];
  const appFrames: string[] = [];

  for (const line of lines) {
    const frameMatch = line.match(STACK_FRAME_REGEX);
    if (!frameMatch) continue;

    const methodPath = frameMatch[1].trim();
    const location = frameMatch[2].trim();
    const frame = `${methodPath}(${location})`;
    stackFrames.push(frame);

    const classSeparatorIndex = methodPath.lastIndexOf(".");
    const className =
      classSeparatorIndex > -1 ? methodPath.slice(0, classSeparatorIndex) : methodPath;
    const frameworkFrame = FRAMEWORK_PREFIXES.some((prefix) => className.startsWith(prefix));

    if (!frameworkFrame) {
      appFrames.push(frame);
    }
  }

  return { stackFrames, appFrames };
}

function uniqueMatches(input: string, pattern: RegExp): string[] {
  const values = new Set<string>();
  const matcher = new RegExp(pattern.source, pattern.flags);
  for (const match of input.matchAll(matcher)) {
    const value = match[1]?.trim();
    if (value) {
      values.add(value);
    }
  }
  return Array.from(values);
}

function extractCorrelationIds(raw: string) {
  const traceIds = new Set<string>(uniqueMatches(raw, TRACE_ID_REGEX));
  const requestIds = new Set<string>(uniqueMatches(raw, REQUEST_ID_REGEX));

  const sleuthMatcher = new RegExp(SLEUTH_TRACE_REGEX.source, SLEUTH_TRACE_REGEX.flags);
  for (const match of raw.matchAll(sleuthMatcher)) {
    const trace = match[1]?.trim();
    if (trace) traceIds.add(trace);
  }

  const correlationIds = new Set<string>([...traceIds, ...requestIds]);

  return {
    traceIds: Array.from(traceIds),
    requestIds: Array.from(requestIds),
    correlationIds: Array.from(correlationIds),
  };
}

function parseTimestampValue(timestamp?: string): number | undefined {
  if (!timestamp) return undefined;

  let normalized = timestamp.replace(",", ".");
  if (normalized.includes(" ") && !normalized.includes("T")) {
    normalized = normalized.replace(" ", "T");
  }

  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

function incrementCounter(map: Map<string, number>, key: string) {
  const previous = map.get(key) ?? 0;
  map.set(key, previous + 1);
}

function parseLogEntry(rawEntry: string, index: number): LogEntry {
  const lines = rawEntry.split("\n");
  const firstLine = lines[0] ?? "";
  const header = parseHeader(firstLine);
  const exception = extractException(lines);
  const stacks = extractStackFrames(lines);
  const correlations = extractCorrelationIds(rawEntry);

  const message =
    header.message ||
    exception.exceptionMessage ||
    exception.causeChain[exception.causeChain.length - 1] ||
    firstLine.trim();

  return {
    index,
    raw: rawEntry,
    firstLine,
    timestamp: header.timestamp,
    level: header.level,
    logger: header.logger,
    message,
    exceptionType: exception.exceptionType,
    exceptionMessage: exception.exceptionMessage,
    causeChain: exception.causeChain,
    stackFrames: stacks.stackFrames,
    appFrames: stacks.appFrames,
    traceIds: correlations.traceIds,
    requestIds: correlations.requestIds,
    correlationIds: correlations.correlationIds,
  };
}

function toSortedHistogram(map: Map<string, number>, limit = 8): HistogramRow[] {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function formatFailure(entry: LogEntry): FailureInsight {
  const exception = entry.exceptionType
    ? entry.exceptionMessage
      ? `${entry.exceptionType}: ${entry.exceptionMessage}`
      : entry.exceptionType
    : undefined;

  return {
    entryIndex: entry.index + 1,
    message: entry.message,
    timestamp: entry.timestamp,
    logger: entry.logger,
    exception,
    cause: entry.causeChain[entry.causeChain.length - 1],
    location: entry.appFrames[0] ?? entry.stackFrames[0],
    correlationId: entry.correlationIds[0],
  };
}

function buildReport(result: Omit<AnalysisResult, "reportText">): string {
  const lines: string[] = [];

  lines.push("Spring Boot Log Incident Report");
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`Entries analyzed: ${result.entryCount}`);
  lines.push(`Potential error entries: ${result.errorCount}`);
  lines.push(`Warning entries: ${result.warningCount}`);
  lines.push(
    `Out-of-order timestamps detected: ${result.outOfOrderCount}`,
  );
  lines.push(
    `Errors without correlation id: ${result.missingCorrelationErrors}`,
  );
  lines.push("");
  lines.push(
    `Level distribution: TRACE ${result.levelCount.TRACE}, DEBUG ${result.levelCount.DEBUG}, INFO ${result.levelCount.INFO}, WARN ${result.levelCount.WARN}, ERROR ${result.levelCount.ERROR}, FATAL ${result.levelCount.FATAL}`,
  );

  if (result.primaryFailure) {
    lines.push("");
    lines.push("Likely first failure");
    lines.push(`Entry: #${result.primaryFailure.entryIndex}`);
    if (result.primaryFailure.timestamp) {
      lines.push(`Timestamp: ${result.primaryFailure.timestamp}`);
    }
    if (result.primaryFailure.logger) {
      lines.push(`Logger: ${result.primaryFailure.logger}`);
    }
    lines.push(`Message: ${result.primaryFailure.message}`);
    if (result.primaryFailure.exception) {
      lines.push(`Exception: ${result.primaryFailure.exception}`);
    }
    if (result.primaryFailure.cause) {
      lines.push(`Cause: ${result.primaryFailure.cause}`);
    }
    if (result.primaryFailure.location) {
      lines.push(`Likely location: ${result.primaryFailure.location}`);
    }
    if (result.primaryFailure.correlationId) {
      lines.push(`Correlation id: ${result.primaryFailure.correlationId}`);
    }
  }

  if (result.exceptionCounts.length > 0) {
    lines.push("");
    lines.push("Top exceptions");
    for (const row of result.exceptionCounts) {
      lines.push(`- ${row.name}: ${row.count}`);
    }
  }

  if (result.correlationRows.length > 0) {
    lines.push("");
    lines.push("Top failing correlations");
    for (const row of result.correlationRows.slice(0, 5)) {
      lines.push(`- ${row.id}: errors ${row.errors}, total entries ${row.total}`);
    }
  }

  return lines.join("\n");
}

function analyzeLogText(text: string): AnalysisResult | null {
  const rawEntries = splitLogEntries(text);
  if (rawEntries.length === 0) return null;

  const parsedEntries = rawEntries.map((rawEntry, index) => parseLogEntry(rawEntry, index));
  const levelCount = createLevelCount();
  const exceptionMap = new Map<string, number>();
  const loggerMap = new Map<string, number>();
  const correlationMap = new Map<string, { errors: number; total: number }>();
  const errorEntries: LogEntry[] = [];
  let missingCorrelationErrors = 0;
  let outOfOrderCount = 0;
  let warningCount = 0;
  let previousTimestamp: number | undefined;

  for (const entry of parsedEntries) {
    if (entry.level) {
      levelCount[entry.level] += 1;
      if (entry.level === "WARN") {
        warningCount += 1;
      }
    }

    if (entry.exceptionType) {
      incrementCounter(exceptionMap, entry.exceptionType);
    }

    if (entry.logger) {
      incrementCounter(loggerMap, entry.logger);
    }

    const hasErrorSignal =
      entry.level === "ERROR" || entry.level === "FATAL" || Boolean(entry.exceptionType);

    if (hasErrorSignal) {
      errorEntries.push(entry);
      if (entry.correlationIds.length === 0) {
        missingCorrelationErrors += 1;
      }
    }

    for (const id of entry.correlationIds) {
      const existing = correlationMap.get(id) ?? { errors: 0, total: 0 };
      existing.total += 1;
      if (hasErrorSignal) {
        existing.errors += 1;
      }
      correlationMap.set(id, existing);
    }

    const timestampValue = parseTimestampValue(entry.timestamp);
    if (timestampValue !== undefined && previousTimestamp !== undefined) {
      if (timestampValue < previousTimestamp) {
        outOfOrderCount += 1;
      }
    }
    if (timestampValue !== undefined) {
      previousTimestamp = timestampValue;
    }
  }

  const primaryFailureEntry = errorEntries[0];

  const resultWithoutReport: Omit<AnalysisResult, "reportText"> = {
    entryCount: parsedEntries.length,
    levelCount,
    errorCount: errorEntries.length,
    warningCount,
    exceptionCounts: toSortedHistogram(exceptionMap),
    loggerCounts: toSortedHistogram(loggerMap),
    correlationRows: Array.from(correlationMap.entries())
      .map(([id, counts]) => ({
        id,
        errors: counts.errors,
        total: counts.total,
      }))
      .sort((a, b) => b.errors - a.errors || b.total - a.total || a.id.localeCompare(b.id))
      .slice(0, 12),
    missingCorrelationErrors,
    outOfOrderCount,
    primaryFailure: primaryFailureEntry ? formatFailure(primaryFailureEntry) : undefined,
    errorEntries: errorEntries.slice(0, 20),
  };

  return {
    ...resultWithoutReport,
    reportText: buildReport(resultWithoutReport),
  };
}

export default function SpringBootLogAnalyzer() {
  const [logText, setLogText] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const { error, success, info, setError, setSuccess, setInfo } = useToolStatus();

  const clearAlerts = () => {
    setError();
    setSuccess();
    setInfo();
  };

  const handleAnalyze = () => {
    clearAlerts();
    if (!logText.trim()) {
      setError("Log input is empty.");
      setAnalysis(null);
      return;
    }

    const result = analyzeLogText(logText);
    if (!result) {
      setError("No parseable log entries found.");
      setAnalysis(null);
      return;
    }

    setAnalysis(result);
    setSuccess(
      `Analyzed ${result.entryCount} entries with ${result.errorCount} potential error entries.`,
    );

    if (result.primaryFailure) {
      const location = result.primaryFailure.location
        ? ` at ${result.primaryFailure.location}`
        : "";
      setInfo(`Likely first failure: ${result.primaryFailure.message}${location}`);
    } else {
      setInfo("No strong error signal found. Review WARN entries and correlation groups.");
    }
  };

  const handleSample = () => {
    clearAlerts();
    setLogText(SAMPLE_LOG);
    setAnalysis(null);
    setSuccess("Sample Spring Boot log loaded.");
  };

  const handleClear = () => {
    clearAlerts();
    setLogText("");
    setAnalysis(null);
  };

  const handleCopyReport = async () => {
    clearAlerts();
    if (!analysis) {
      setInfo("Run analysis first.");
      return;
    }

    try {
      await navigator.clipboard.writeText(analysis.reportText);
      setSuccess("Incident report copied.");
    } catch {
      setError("Copy failed. Clipboard permission may be blocked.");
    }
  };

  const handleExportJson = () => {
    clearAlerts();
    if (!analysis) {
      setInfo("Run analysis first.");
      return;
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      summary: {
        entryCount: analysis.entryCount,
        errorCount: analysis.errorCount,
        warningCount: analysis.warningCount,
        levelCount: analysis.levelCount,
        missingCorrelationErrors: analysis.missingCorrelationErrors,
        outOfOrderCount: analysis.outOfOrderCount,
      },
      primaryFailure: analysis.primaryFailure ?? null,
      exceptions: analysis.exceptionCounts,
      loggers: analysis.loggerCounts,
      correlations: analysis.correlationRows,
      errorEntries: analysis.errorEntries.map((entry) => ({
        index: entry.index + 1,
        timestamp: entry.timestamp,
        level: entry.level,
        logger: entry.logger,
        message: entry.message,
        exceptionType: entry.exceptionType,
        exceptionMessage: entry.exceptionMessage,
        cause: entry.causeChain[entry.causeChain.length - 1],
        likelyLocation: entry.appFrames[0] ?? entry.stackFrames[0],
        correlationIds: entry.correlationIds,
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, "spring-boot-log-analysis.json");

    setSuccess("JSON report exported.");
  };

  const handleFilesSelected = async (files: FileList | null) => {
    clearAlerts();
    const file = files?.[0];
    if (!file) {
      setInfo("No file selected.");
      return;
    }

    try {
      const text = await file.text();
      setLogText(text);
      setAnalysis(null);
      setSuccess(`Loaded ${file.name}.`);
    } catch {
      setError("Could not read the selected file.");
    }
  };

  return (
    <PageContainer maxWidth={1200}>
      <Stack spacing={2.25}>
        <Typography variant="h5">Spring Boot Log Analyzer</Typography>
        <Typography variant="body2" color="text.secondary">
          Paste or upload Spring Boot logs to locate likely first failure, root cause chain,
          stack frame hints, and correlation id clusters.
        </Typography>

        <ToolStatusAlerts error={error} success={success} info={info} />

        <FlexWrapRow>
          <TransparentButton label="Analyze Log" onClick={handleAnalyze} />
          <TransparentButton label="Load Sample" onClick={handleSample} />
          <FilePickerButton
            label="Load File"
            variant="outlined"
            accept=".log,.txt,.json,.jsonl"
            onFilesSelected={handleFilesSelected}
            resetAfterSelect
            sx={{ textTransform: "none" }}
          />
          <TransparentButton label="Copy Report" onClick={handleCopyReport} />
          <TransparentButton label="Export JSON" onClick={handleExportJson} />
          <TransparentButton label="Clear" onClick={handleClear} />
        </FlexWrapRow>

        <TextField
          value={logText}
          onChange={(event) => setLogText(event.target.value)}
          placeholder="Paste Spring Boot logs here..."
          multiline
          fullWidth
          minRows={15}
          InputProps={{
            sx: {
              "& textarea": {
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 13,
                lineHeight: 1.5,
              },
            },
          }}
        />

        {analysis && (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6">Analysis Summary</Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1.5 }}>
                <Chip label={`Entries: ${analysis.entryCount}`} />
                <Chip label={`Errors: ${analysis.errorCount}`} color="error" />
                <Chip label={`Warnings: ${analysis.warningCount}`} color="warning" />
                <Chip label={`No Correlation IDs: ${analysis.missingCorrelationErrors}`} />
                <Chip label={`Out-of-Order Timestamps: ${analysis.outOfOrderCount}`} />
              </Box>

              {analysis.primaryFailure ? (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <strong>Likely first failure:</strong> {analysis.primaryFailure.message}
                  {analysis.primaryFailure.exception
                    ? ` | Exception: ${analysis.primaryFailure.exception}`
                    : ""}
                  {analysis.primaryFailure.location
                    ? ` | Location: ${analysis.primaryFailure.location}`
                    : ""}
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No strong error signal detected. Try logs that include stack traces or ERROR lines.
                </Alert>
              )}
            </Paper>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Top Exceptions</TableCell>
                    <TableCell align="right">Count</TableCell>
                    <TableCell>Top Loggers</TableCell>
                    <TableCell align="right">Count</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.from({
                    length: Math.max(analysis.exceptionCounts.length, analysis.loggerCounts.length),
                  }).map((_, index) => {
                    const exception = analysis.exceptionCounts[index];
                    const logger = analysis.loggerCounts[index];
                    return (
                      <TableRow key={`hist-${index}`}>
                        <TableCell>{exception?.name ?? "-"}</TableCell>
                        <TableCell align="right">{exception?.count ?? "-"}</TableCell>
                        <TableCell>{logger?.name ?? "-"}</TableCell>
                        <TableCell align="right">{logger?.count ?? "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Correlation ID</TableCell>
                    <TableCell align="right">Error Entries</TableCell>
                    <TableCell align="right">Total Entries</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analysis.correlationRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3}>No correlation ids found in current logs.</TableCell>
                    </TableRow>
                  ) : (
                    analysis.correlationRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.id}</TableCell>
                        <TableCell align="right">{row.errors}</TableCell>
                        <TableCell align="right">{row.total}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Level</TableCell>
                    <TableCell>Logger</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>Likely Location</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analysis.errorEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>No error entries detected.</TableCell>
                    </TableRow>
                  ) : (
                    analysis.errorEntries.map((entry) => (
                      <TableRow key={`error-entry-${entry.index}`}>
                        <TableCell>{entry.index + 1}</TableCell>
                        <TableCell>{entry.timestamp ?? "-"}</TableCell>
                        <TableCell>{entry.level ?? "-"}</TableCell>
                        <TableCell>{entry.logger ?? "-"}</TableCell>
                        <TableCell>{entry.message}</TableCell>
                        <TableCell>{entry.appFrames[0] ?? entry.stackFrames[0] ?? "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </Stack>
    </PageContainer>
  );
}
