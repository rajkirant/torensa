import { useState } from "react";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { TransparentButton } from "../components/buttons/TransparentButton";
import FlexWrapRow from "../components/layout/FlexWrapRow";

type FieldKey = "second" | "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

type FieldConfig = {
  key: FieldKey;
  label: string;
  min: number;
  max: number;
  unitSingular: string;
  unitPlural: string;
  displayName?: (value: number) => string;
};

type ParsedField = {
  values: Set<number>;
  isWildcard: boolean;
};

type ParsedCron = {
  second: ParsedField;
  minute: ParsedField;
  hour: ParsedField;
  dayOfMonth: ParsedField;
  month: ParsedField;
  dayOfWeek: ParsedField;
  hasSeconds: boolean;
  raw: Record<FieldKey, string>;
};

type ValidationResult =
  | { ok: true; parsed: ParsedCron; summary: string; nextRuns: Date[] }
  | { ok: false; error: string };

const MONTH_NAMES = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SECOND_FIELD_CONFIG: FieldConfig = {
  key: "second",
  label: "Second",
  min: 0,
  max: 59,
  unitSingular: "second",
  unitPlural: "seconds",
};

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: "minute",
    label: "Minute",
    min: 0,
    max: 59,
    unitSingular: "minute",
    unitPlural: "minutes",
  },
  {
    key: "hour",
    label: "Hour",
    min: 0,
    max: 23,
    unitSingular: "hour",
    unitPlural: "hours",
  },
  {
    key: "dayOfMonth",
    label: "Day of month",
    min: 1,
    max: 31,
    unitSingular: "day",
    unitPlural: "days",
  },
  {
    key: "month",
    label: "Month",
    min: 1,
    max: 12,
    unitSingular: "month",
    unitPlural: "months",
    displayName: (value) => MONTH_NAMES[value] ?? String(value),
  },
  {
    key: "dayOfWeek",
    label: "Day of week",
    min: 0,
    max: 6,
    unitSingular: "weekday",
    unitPlural: "weekdays",
    displayName: (value) => WEEKDAY_NAMES[value] ?? String(value),
  },
];

const PREVIEW_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

const PREVIEW_FORMATTER_WITH_SECONDS = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

function normalizeDayOfWeekValue(value: number): number {
  return value === 7 ? 0 : value;
}

function parseExpressionParts(expression: string): string[] {
  return expression.trim().split(/\s+/).filter(Boolean);
}

function parseFieldSegment(
  segment: string,
  config: FieldConfig,
  fieldLabel: string,
): number[] {
  const wildcardStepMatch = segment.match(/^\*\/(\d+)$/);
  if (wildcardStepMatch) {
    const step = Number(wildcardStepMatch[1]);
    if (!Number.isInteger(step) || step <= 0) {
      throw new Error(`${fieldLabel}: step must be a positive integer.`);
    }

    const values: number[] = [];
    for (let value = config.min; value <= config.max; value += step) {
      values.push(value);
    }
    return values;
  }

  const numberMatch = segment.match(/^(\d+)$/);
  if (numberMatch) {
    const rawValue = Number(numberMatch[1]);
    const maxRange = config.key === "dayOfWeek" ? "0-7" : `${config.min}-${config.max}`;
    if (
      !Number.isInteger(rawValue) ||
      rawValue < config.min ||
      rawValue > (config.key === "dayOfWeek" ? 7 : config.max)
    ) {
      throw new Error(`${fieldLabel}: value "${segment}" is out of range (${maxRange}).`);
    }

    const value =
      config.key === "dayOfWeek" ? normalizeDayOfWeekValue(rawValue) : rawValue;
    if (!Number.isInteger(value) || value < config.min || value > config.max) {
      const maxRange = config.key === "dayOfWeek" ? "0-7" : `${config.min}-${config.max}`;
      throw new Error(`${fieldLabel}: value "${segment}" is out of range (${maxRange}).`);
    }
    return [value];
  }

  const rangeMatch = segment.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
  if (rangeMatch) {
    const startRaw = Number(rangeMatch[1]);
    const endRaw = Number(rangeMatch[2]);
    const step = rangeMatch[3] ? Number(rangeMatch[3]) : 1;
    const maxBound = config.key === "dayOfWeek" ? 7 : config.max;
    const maxRange = config.key === "dayOfWeek" ? "0-7" : `${config.min}-${config.max}`;

    if (!Number.isInteger(step) || step <= 0) {
      throw new Error(`${fieldLabel}: step must be a positive integer.`);
    }
    if (
      !Number.isInteger(startRaw) ||
      !Number.isInteger(endRaw) ||
      startRaw < config.min ||
      startRaw > maxBound ||
      endRaw < config.min ||
      endRaw > maxBound
    ) {
      throw new Error(`${fieldLabel}: range "${segment}" is out of range (${maxRange}).`);
    }
    if (startRaw > endRaw) {
      throw new Error(`${fieldLabel}: range start must be <= range end.`);
    }

    const values: number[] = [];
    for (let rawValue = startRaw; rawValue <= endRaw; rawValue += step) {
      const value =
        config.key === "dayOfWeek"
          ? normalizeDayOfWeekValue(rawValue)
          : rawValue;
      values.push(value);
    }
    return values;
  }

  throw new Error(
    `${fieldLabel}: unsupported token "${segment}". Use *, */n, a, a-b, a-b/n, or comma lists.`,
  );
}

function parseField(text: string, config: FieldConfig): ParsedField {
  const valueText = text.trim();
  if (!valueText) {
    throw new Error(`${config.label}: value is empty.`);
  }

  if (valueText === "*") {
    const values = new Set<number>();
    for (let value = config.min; value <= config.max; value += 1) {
      values.add(value);
    }
    return { values, isWildcard: true };
  }

  const values = new Set<number>();
  const segments = valueText.split(",").map((segment) => segment.trim());
  for (const segment of segments) {
    if (!segment) {
      throw new Error(`${config.label}: empty list segment found.`);
    }
    const parsedValues = parseFieldSegment(segment, config, config.label);
    parsedValues.forEach((entry) => values.add(entry));
  }

  if (values.size === 0) {
    throw new Error(`${config.label}: no valid values resolved.`);
  }

  return { values, isWildcard: false };
}

function formatValue(config: FieldConfig, value: number): string {
  return config.displayName ? config.displayName(value) : String(value);
}

function toOrdinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

function describeField(config: FieldConfig, parsed: ParsedField): string {
  const values = Array.from(parsed.values).sort((a, b) => a - b);
  const fullCount = config.max - config.min + 1;

  if (values.length === fullCount) {
    return `every ${config.unitPlural}`;
  }

  if (values.length === 1) {
    return `${config.label.toLowerCase()} ${formatValue(config, values[0])}`;
  }

  let uniformStep = true;
  const step = values[1] - values[0];
  for (let index = 2; index < values.length; index += 1) {
    if (values[index] - values[index - 1] !== step) {
      uniformStep = false;
      break;
    }
  }

  if (uniformStep && step > 0 && values[0] === config.min && values.length > 2) {
    return `every ${step} ${config.unitPlural}`;
  }

  const listed = values.map((value) => formatValue(config, value)).join(", ");
  return `${config.label.toLowerCase()} in [${listed}]`;
}

function describeTime(
  second: ParsedField,
  minute: ParsedField,
  hour: ParsedField,
  hasSeconds: boolean,
): string {
  const seconds = Array.from(second.values).sort((a, b) => a - b);
  const minutes = Array.from(minute.values).sort((a, b) => a - b);
  const hours = Array.from(hour.values).sort((a, b) => a - b);
  const allMinutes = minutes.length === 60;
  const allHours = hours.length === 24;

  if (allMinutes && allHours) {
    if (!hasSeconds) return "every minute";
    if (seconds.length === 60) return "every second";
    if (seconds.length === 1) return `at second ${seconds[0]} of every minute`;
    return `${describeField(SECOND_FIELD_CONFIG, second)} of every minute`;
  }
  if (allHours && minutes.length === 1) {
    return `at minute ${minutes[0]} of every hour`;
  }
  if (allMinutes && hours.length === 1) {
    return `every minute during ${String(hours[0]).padStart(2, "0")}:00 hour`;
  }
  if (minutes.length === 1 && hours.length === 1) {
    const baseTime = `${String(hours[0]).padStart(2, "0")}:${String(minutes[0]).padStart(2, "0")}`;
    if (!hasSeconds) return `at ${baseTime}`;
    if (seconds.length === 1) {
      return `at ${baseTime}:${String(seconds[0]).padStart(2, "0")}`;
    }
    return `${describeField(SECOND_FIELD_CONFIG, second)} at ${baseTime}`;
  }
  const minuteHourDescription = `${describeField(FIELD_CONFIGS[0], minute)} and ${describeField(FIELD_CONFIGS[1], hour)}`;
  if (!hasSeconds) return minuteHourDescription;
  if (seconds.length === 1) {
    return `at second ${seconds[0]}, ${minuteHourDescription}`;
  }
  return `${describeField(SECOND_FIELD_CONFIG, second)}, ${minuteHourDescription}`;
}

function describeDayOfMonth(parsed: ParsedField): string {
  const values = Array.from(parsed.values).sort((a, b) => a - b);
  if (values.length === 31) return "every day of the month";
  if (values.length === 1) return `on the ${toOrdinal(values[0])} day of the month`;
  if (values.length > 1 && values[0] === 1) {
    const step = values[1] - values[0];
    const isStep =
      values.length > 2 &&
      values.every((value, index) => index === 0 || value - values[index - 1] === step);
    if (isStep && step > 1) return `every ${toOrdinal(step)} day of the month`;
  }
  return `on day ${values.join(", ")} of the month`;
}

function describeMonth(parsed: ParsedField): string {
  const values = Array.from(parsed.values).sort((a, b) => a - b);
  if (values.length === 12) return "every month";
  if (values.length === 1) return `in ${MONTH_NAMES[values[0]]}`;
  return `in ${values.map((month) => MONTH_NAMES[month]).join(", ")}`;
}

function describeDayOfWeek(parsed: ParsedField): string {
  const values = Array.from(parsed.values).sort((a, b) => a - b);
  if (values.length === 7) return "every day of the week";
  if (values.length === 5 && values.join(",") === "1,2,3,4,5") return "on weekdays";
  if (values.length === 2 && values.join(",") === "0,6") return "on weekends";
  if (values.length === 1) return `on ${WEEKDAY_NAMES[values[0]]}`;
  return `on ${values.map((day) => WEEKDAY_NAMES[day]).join(", ")}`;
}

function buildSentenceSummary(parsed: ParsedCron): string {
  const timePart = describeTime(parsed.second, parsed.minute, parsed.hour, parsed.hasSeconds);
  const dayOfMonthPart = describeDayOfMonth(parsed.dayOfMonth);
  const monthPart = describeMonth(parsed.month);
  const dayOfWeekPart = describeDayOfWeek(parsed.dayOfWeek);

  const domWildcard = parsed.dayOfMonth.isWildcard;
  const dowWildcard = parsed.dayOfWeek.isWildcard;

  if (domWildcard && dowWildcard) {
    return `It runs ${timePart}, ${monthPart}.`;
  }
  if (!domWildcard && dowWildcard) {
    return `It runs ${timePart}, ${dayOfMonthPart}, ${monthPart}.`;
  }
  if (domWildcard && !dowWildcard) {
    return `It runs ${timePart}, ${dayOfWeekPart}, ${monthPart}.`;
  }
  return `It runs ${timePart}, ${dayOfMonthPart} and ${dayOfWeekPart}, ${monthPart}.`;
}

function matchesCronWithoutSecond(date: Date, cron: ParsedCron): boolean {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  const minuteMatch = cron.minute.values.has(minute);
  const hourMatch = cron.hour.values.has(hour);
  const monthMatch = cron.month.values.has(month);
  if (!minuteMatch || !hourMatch || !monthMatch) return false;

  const domMatch = cron.dayOfMonth.values.has(dayOfMonth);
  const dowMatch = cron.dayOfWeek.values.has(dayOfWeek);

  const domWildcard = cron.dayOfMonth.isWildcard;
  const dowWildcard = cron.dayOfWeek.isWildcard;

  if (domWildcard && dowWildcard) return true;
  if (domWildcard) return dowMatch;
  if (dowWildcard) return domMatch;
  return domMatch || dowMatch;
}

function computeNextRuns(cron: ParsedCron, count = 5): Date[] {
  const nextRuns: Date[] = [];

  if (!cron.hasSeconds) {
    const cursor = new Date();
    cursor.setSeconds(0, 0);
    cursor.setMinutes(cursor.getMinutes() + 1);

    // 3 years search cap (minute resolution).
    const maxIterations = 1_576_800;
    let checked = 0;
    while (nextRuns.length < count && checked < maxIterations) {
      if (matchesCronWithoutSecond(cursor, cron)) {
        nextRuns.push(new Date(cursor));
      }
      cursor.setMinutes(cursor.getMinutes() + 1);
      checked += 1;
    }

    return nextRuns;
  }

  const secondValues = Array.from(cron.second.values).sort((a, b) => a - b);
  const startTime = new Date();
  startTime.setMilliseconds(0);
  startTime.setSeconds(startTime.getSeconds() + 1);

  const cursor = new Date(startTime);

  // 3 years search cap (minute resolution with second expansion).
  const maxIterations = 1_576_800;
  let checked = 0;
  while (nextRuns.length < count && checked < maxIterations) {
    if (matchesCronWithoutSecond(cursor, cron)) {
      for (const second of secondValues) {
        const candidate = new Date(cursor);
        candidate.setSeconds(second, 0);
        if (candidate < startTime) continue;
        nextRuns.push(candidate);
        if (nextRuns.length >= count) break;
      }
    }

    cursor.setSeconds(0, 0);
    cursor.setMinutes(cursor.getMinutes() + 1);
    checked += 1;
  }

  return nextRuns;
}

function validateCron(expression: string): ValidationResult {
  const parts = parseExpressionParts(expression);
  if (parts.length !== 5 && parts.length !== 6) {
    return {
      ok: false,
      error: `Cron must have 5 or 6 fields. Received ${parts.length}.`,
    };
  }

  const hasSeconds = parts.length === 6;

  try {
    const secondRaw = hasSeconds ? parts[0] : "0";
    const minuteIndex = hasSeconds ? 1 : 0;

    const parsed: ParsedCron = {
      second: parseField(secondRaw, SECOND_FIELD_CONFIG),
      minute: parseField(parts[minuteIndex], FIELD_CONFIGS[0]),
      hour: parseField(parts[minuteIndex + 1], FIELD_CONFIGS[1]),
      dayOfMonth: parseField(parts[minuteIndex + 2], FIELD_CONFIGS[2]),
      month: parseField(parts[minuteIndex + 3], FIELD_CONFIGS[3]),
      dayOfWeek: parseField(parts[minuteIndex + 4], FIELD_CONFIGS[4]),
      hasSeconds,
      raw: {
        second: secondRaw,
        minute: parts[minuteIndex],
        hour: parts[minuteIndex + 1],
        dayOfMonth: parts[minuteIndex + 2],
        month: parts[minuteIndex + 3],
        dayOfWeek: parts[minuteIndex + 4],
      },
    };

    const summary = buildSentenceSummary(parsed);

    const nextRuns = computeNextRuns(parsed);
    return { ok: true, parsed, summary, nextRuns };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid cron expression.",
    };
  }
}

export default function CronExpressionBuilder() {
  const [expression, setExpression] = useState("*/5 * * * *");
  const [statusMessage, setStatusMessage] = useState<{
    info?: string;
    success?: string;
    error?: string;
  }>({ info: "Enter a cron expression and choose an action." });
  const [explanation, setExplanation] = useState("");
  const [previewRuns, setPreviewRuns] = useState<Date[]>([]);
  const [previewIncludesSeconds, setPreviewIncludesSeconds] = useState(false);

  const runValidation = () => validateCron(expression);

  const handleValidate = () => {
    const result = runValidation();
    setExplanation("");
    setPreviewRuns([]);
    setPreviewIncludesSeconds(false);
    if (!result.ok) {
      setStatusMessage({ error: result.error });
      return;
    }
    setStatusMessage({ success: "Cron expression is valid." });
  };

  const handleExplain = () => {
    const result = runValidation();
    setPreviewRuns([]);
    setPreviewIncludesSeconds(false);
    if (!result.ok) {
      setExplanation("");
      setStatusMessage({ error: result.error });
      return;
    }
    setExplanation(result.summary);
    setStatusMessage({ success: "Explanation generated." });
  };

  const handlePreview = () => {
    const result = runValidation();
    setExplanation("");
    if (!result.ok) {
      setPreviewRuns([]);
      setPreviewIncludesSeconds(false);
      setStatusMessage({ error: result.error });
      return;
    }
    setPreviewRuns(result.nextRuns);
    setPreviewIncludesSeconds(result.parsed.hasSeconds);
    setStatusMessage({ success: "Next run preview generated." });
  };

  return (
    <PageContainer maxWidth={980}>
      <Stack spacing={2}>
        <ToolStatusAlerts
          error={statusMessage.error ?? ""}
          success={statusMessage.success ?? ""}
          info={statusMessage.info ?? ""}
          slotColor={{ info: "success" }}
          slotIcon={{ info: <ErrorOutlineRoundedIcon fontSize="inherit" /> }}
        />

        <TextField
          label="Cron expression"
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          placeholder="*/5 * * * * or 0 */5 * * * *"
          fullWidth
          InputProps={{
            sx: {
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            },
          }}
          helperText="Formats: minute hour day-of-month month day-of-week OR second minute hour day-of-month month day-of-week"
        />

        <FlexWrapRow>
          <TransparentButton label="Validate" onClick={handleValidate} />
          <TransparentButton label="Explain" onClick={handleExplain} />
          <TransparentButton label="Next Run Preview" onClick={handlePreview} />
        </FlexWrapRow>

        {explanation && (
          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Human-readable interpretation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {explanation}
            </Typography>
          </Stack>
        )}

        {previewRuns.length > 0 && (
          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
              Next run preview
            </Typography>
            <Stack spacing={0.5}>
              {previewRuns.map((runAt, index) => (
                <Typography key={`${runAt.toISOString()}-${index}`} variant="body2">
                  {index + 1}.{" "}
                  {previewIncludesSeconds
                    ? PREVIEW_FORMATTER_WITH_SECONDS.format(runAt)
                    : PREVIEW_FORMATTER.format(runAt)}
                </Typography>
              ))}
            </Stack>
          </Stack>
        )}

      </Stack>
    </PageContainer>
  );
}


