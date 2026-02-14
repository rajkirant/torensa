import { useMemo, useState } from "react";
import { Stack, TextField, Typography } from "@mui/material";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { TransparentButton } from "../components/buttons/TransparentButton";
import FlexWrapRow from "../components/layout/FlexWrapRow";

type FieldKey = "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

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
  minute: ParsedField;
  hour: ParsedField;
  dayOfMonth: ParsedField;
  month: ParsedField;
  dayOfWeek: ParsedField;
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

function describeTime(minute: ParsedField, hour: ParsedField): string {
  const minutes = Array.from(minute.values).sort((a, b) => a - b);
  const hours = Array.from(hour.values).sort((a, b) => a - b);
  const allMinutes = minutes.length === 60;
  const allHours = hours.length === 24;

  if (allMinutes && allHours) return "every minute";
  if (allHours && minutes.length === 1) {
    return `at minute ${minutes[0]} of every hour`;
  }
  if (allMinutes && hours.length === 1) {
    return `every minute during ${String(hours[0]).padStart(2, "0")}:00 hour`;
  }
  if (minutes.length === 1 && hours.length === 1) {
    return `at ${String(hours[0]).padStart(2, "0")}:${String(minutes[0]).padStart(2, "0")}`;
  }
  return `${describeField(FIELD_CONFIGS[0], minute)} and ${describeField(FIELD_CONFIGS[1], hour)}`;
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
  const timePart = describeTime(parsed.minute, parsed.hour);
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

function matchesCron(date: Date, cron: ParsedCron): boolean {
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
  const cursor = new Date();
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  // 3 years search cap (minute resolution).
  const maxIterations = 1_576_800;
  let checked = 0;
  while (nextRuns.length < count && checked < maxIterations) {
    if (matchesCron(cursor, cron)) {
      nextRuns.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
    checked += 1;
  }

  return nextRuns;
}

function validateCron(expression: string): ValidationResult {
  const parts = parseExpressionParts(expression);
  if (parts.length !== 5) {
    return {
      ok: false,
      error: `Cron must have exactly 5 fields. Received ${parts.length}.`,
    };
  }

  try {
    const parsed: ParsedCron = {
      minute: parseField(parts[0], FIELD_CONFIGS[0]),
      hour: parseField(parts[1], FIELD_CONFIGS[1]),
      dayOfMonth: parseField(parts[2], FIELD_CONFIGS[2]),
      month: parseField(parts[3], FIELD_CONFIGS[3]),
      dayOfWeek: parseField(parts[4], FIELD_CONFIGS[4]),
      raw: {
        minute: parts[0],
        hour: parts[1],
        dayOfMonth: parts[2],
        month: parts[3],
        dayOfWeek: parts[4],
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

  const runValidation = () => validateCron(expression);

  const handleValidate = () => {
    const result = runValidation();
    setExplanation("");
    setPreviewRuns([]);
    if (!result.ok) {
      setStatusMessage({ error: result.error });
      return;
    }
    setStatusMessage({ success: "Cron expression is valid." });
  };

  const handleExplain = () => {
    const result = runValidation();
    setPreviewRuns([]);
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
      setStatusMessage({ error: result.error });
      return;
    }
    setPreviewRuns(result.nextRuns);
    setStatusMessage({ success: "Next run preview generated." });
  };

  return (
    <PageContainer maxWidth={980}>
      <Stack spacing={2}>
        <ToolStatusAlerts
          error={statusMessage.error ?? ""}
          success={statusMessage.success ?? ""}
          info={statusMessage.info ?? ""}
        />

        <TextField
          label="Cron expression"
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          placeholder="*/5 * * * *"
          fullWidth
          InputProps={{
            sx: {
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            },
          }}
          helperText="Format: minute hour day-of-month month day-of-week"
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
                  {index + 1}. {PREVIEW_FORMATTER.format(runAt)}
                </Typography>
              ))}
            </Stack>
          </Stack>
        )}

        <Typography variant="body2" color="text.secondary">
          Supported tokens: <code>*</code>, <code>*/n</code>, <code>a</code>,{" "}
          <code>a-b</code>, <code>a-b/n</code>, and comma lists. Day-of-week
          accepts <code>0-7</code> where <code>0</code> and <code>7</code> mean
          Sunday.
        </Typography>
      </Stack>
    </PageContainer>
  );
}
