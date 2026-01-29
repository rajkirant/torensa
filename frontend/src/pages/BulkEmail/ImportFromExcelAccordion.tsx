import type React from "react";
import { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Typography,
  Chip,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Alert,
  CircularProgress,
} from "@mui/material";
import * as XLSX from "xlsx";
import { apiFetch } from "../../utils/api";

type SMTPConfig = {
  id: number;
  smtp_email: string;
  provider: string;
};

type Props = {
  smtpConfigs: SMTPConfig[];
  selectedConfigId: number | "";
  setSelectedConfigId: (id: number | "") => void;
};

// "First Name" -> "First_Name"
function headerToKey(header: string) {
  return header.trim().replace(/\s+/g, "_");
}

function buildRowVars(headers: string[], row: any[]) {
  const vars: Record<string, string> = {};
  headers.forEach((h, i) => {
    if (!h) return;
    const raw = row?.[i];
    const val = raw == null ? "" : String(raw);
    // recommended placeholder key
    vars[headerToKey(h)] = val;
    // keep original too (won't match if spaces)
    vars[h] = val;
  });
  return vars;
}

// Escape dollars: $$ -> $
// Replace $Key using vars
// Unknown placeholders are left as-is (so user can spot mistakes)
function applyDollarTemplate(template: string, vars: Record<string, string>) {
  const ESC = "__DOLLAR_ESC__";
  const withEscaped = template.replace(/\$\$/g, ESC);

  const replaced = withEscaped.replace(/\$([A-Za-z0-9_]+)/g, (full, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) return vars[key] ?? "";
    return full;
  });

  return replaced.replaceAll(ESC, "$");
}

function extractPlaceholderKeys(subject: string, body: string) {
  const text = `${subject}\n${body}`;
  const keys = new Set<string>();
  // ignore escaped $$ by temporarily replacing them
  const scrubbed = text.replace(/\$\$/g, "");
  const re = /\$([A-Za-z0-9_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scrubbed))) {
    keys.add(m[1]);
  }
  return Array.from(keys);
}

function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  text: string,
  setValue: (v: string) => void,
  currentValue: string,
) {
  if (!el) {
    setValue(currentValue + text);
    return;
  }
  const start = el.selectionStart ?? currentValue.length;
  const end = el.selectionEnd ?? currentValue.length;

  const next = currentValue.slice(0, start) + text + currentValue.slice(end);
  setValue(next);

  requestAnimationFrame(() => {
    el.focus();
    const pos = start + text.length;
    el.setSelectionRange(pos, pos);
  });
}

export default function ImportFromExcelAccordion({
  smtpConfigs,
  selectedConfigId,
  setSelectedConfigId,
}: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [emailColumn, setEmailColumn] = useState<string | "">("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Track where the cursor currently is (subject or body)
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLInputElement | null>(null);

  async function handleExcelChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];

      const sheetRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

      const headerRow = (sheetRows[0] || []) as (string | number | null)[];
      const cleanHeaders = headerRow.map((h) => (h == null ? "" : String(h)));

      setFileName(file.name);
      setHeaders(cleanHeaders);
      setRows(sheetRows);

      // auto-pick an email column if we can
      const autoEmailHeader =
        cleanHeaders.find((h) => h.toLowerCase().includes("email")) ||
        cleanHeaders[0] ||
        "";
      setEmailColumn(autoEmailHeader);
    } catch (err) {
      console.error("Excel parse error:", err);
      setHeaders([]);
      setRows([]);
      setEmailColumn("");
      setError("Failed to read Excel file");
    } finally {
      e.target.value = "";
    }
  }

  // Keys referenced in templates -> treat these as "selected columns"
  const usedPlaceholderKeys = useMemo(
    () => extractPlaceholderKeys(subject, body),
    [subject, body],
  );

  // Build payload rows: each recipient + only the vars needed for placeholders (and email)
  const recipientsPayload = useMemo(() => {
    if (!emailColumn || headers.length === 0 || rows.length <= 1) return [];

    const emailIndex = headers.indexOf(emailColumn);
    if (emailIndex === -1) return [];

    return rows.slice(1).flatMap((row) => {
      const to = row?.[emailIndex];
      if (typeof to !== "string" || !to.trim()) return [];

      const vars = buildRowVars(headers, row);

      // only send vars that are referenced in subject/body
      const selectedVars: Record<string, string> = {};
      for (const key of usedPlaceholderKeys) {
        if (Object.prototype.hasOwnProperty.call(vars, key)) {
          selectedVars[key] = vars[key] ?? "";
        } else {
          // still include missing keys as empty (optional)
          selectedVars[key] = "";
        }
      }

      return [
        {
          to: to.trim(),
          vars: selectedVars,
        },
      ];
    });
  }, [emailColumn, headers, rows, usedPlaceholderKeys]);

  // For UI preview only (what server will generate later)
  const preview = useMemo(() => {
    if (!recipientsPayload.length) return null;
    const first = recipientsPayload[0];

    // Build a vars map to render locally for preview
    // (use full row vars if possible; but we only stored selected vars)
    const vars = first.vars;
    return {
      to: first.to,
      subject: applyDollarTemplate(subject, vars),
      body: applyDollarTemplate(body, vars),
    };
  }, [recipientsPayload, subject, body]);

  function handleInsertHeader(header: string) {
    const key = headerToKey(header);
    const token = `$${key}`;

    if (activeField === "subject") {
      insertAtCursor(subjectRef.current, token, setSubject, subject);
    } else {
      insertAtCursor(bodyRef.current as any, token, setBody, body);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedConfigId) {
      setError("Please select an SMTP configuration");
      return;
    }

    if (!recipientsPayload.length) {
      setError("No recipient emails found. Check the selected column.");
      return;
    }

    if (subject.trim().length < 3) {
      setError("Subject must be at least 3 characters long");
      return;
    }

    if (body.trim().length < 10) {
      setError("Message must be at least 10 characters long");
      return;
    }

    setSending(true);

    try {
      /**
       * NEW BULK PAYLOAD (JSON)
       * Server can:
       *  - Loop recipients
       *  - Replace placeholders in subject/body using vars
       *  - Send emails in bulk
       */
      const payload = {
        smtp_config_id: selectedConfigId,
        email_column: emailColumn,
        subject_template: subject,
        body_template: body,
        placeholder_keys: usedPlaceholderKeys, // which columns were referenced
        recipients: recipientsPayload, // [{to, vars:{Key:Value}}]
      };

      // ✅ Send JSON to your server (update endpoint if you want)
      const res = await apiFetch("/api/send-email-bulk/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to send bulk email");
        return;
      }

      setSuccess(
        `Queued/sent bulk email to ${recipientsPayload.length} recipients`,
      );
    } catch (err) {
      console.error(err);
      setError("Bulk email sending failed");
    } finally {
      setSending(false);
    }
  }

  const hasExcel = !!fileName && headers.length > 0;

  return (
    <Box component="form" onSubmit={handleSend}>
      {/* Step 1: Upload Excel */}
      <Box sx={{ mb: 2 }}>
        <Button variant="outlined" component="label" type="button">
          Import from Excel
          <input
            type="file"
            hidden
            accept=".xlsx,.xls"
            onChange={handleExcelChange}
          />
        </Button>
        {fileName && (
          <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
            Selected file: {fileName}
          </Typography>
        )}
      </Box>

      {/* Step 2: Show headers (single click inserts placeholder) + choose email column */}
      {hasExcel && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="info" sx={{ mb: 1 }}>
            Click a column header chip to insert a placeholder (like{" "}
            <b>$First_Name</b>) into the field where your cursor is (Subject or
            Message). Use <b>$$</b> for a literal $.
          </Alert>

          <Typography variant="body2" sx={{ mb: 1 }}>
            Column headers (click to insert):
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
            {headers.map((h, i) => (
              <Chip
                key={i}
                label={h || "(empty)"}
                size="small"
                variant="outlined"
                onClick={() => {
                  if (!h) return;
                  handleInsertHeader(h);
                }}
                sx={{ cursor: h ? "pointer" : "default" }}
              />
            ))}
          </Stack>

          <FormControl fullWidth size="small">
            <InputLabel id="email-column-label">Email column</InputLabel>
            <Select
              labelId="email-column-label"
              label="Email column"
              value={emailColumn}
              onChange={(e) => setEmailColumn(e.target.value as string)}
            >
              {headers.map((h, i) => (
                <MenuItem key={i} value={h}>
                  {h || "(empty)"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {!!usedPlaceholderKeys.length && (
            <Typography
              variant="caption"
              sx={{ display: "block", mt: 1 }}
              color="text.secondary"
            >
              Detected placeholders:{" "}
              {usedPlaceholderKeys.map((k) => `$${k}`).join(", ")}
            </Typography>
          )}
        </Box>
      )}

      {/* Step 3: SMTP config selection */}
      {hasExcel && (
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="smtp-select-label">
            Select SMTP Configuration
          </InputLabel>
          <Select
            labelId="smtp-select-label"
            value={selectedConfigId}
            label="Select SMTP Configuration"
            onChange={(e) => setSelectedConfigId(e.target.value as number)}
            required
          >
            <MenuItem value="">
              <em>Choose Gmail account</em>
            </MenuItem>
            {smtpConfigs.map((cfg) => (
              <MenuItem key={cfg.id} value={cfg.id}>
                {cfg.smtp_email} ({cfg.provider})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Step 4: Compose subject + body */}
      {hasExcel && (
        <>
          <TextField
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            fullWidth
            margin="normal"
            inputRef={subjectRef}
            onFocus={() => setActiveField("subject")}
            onClick={() => setActiveField("subject")}
          />

          <TextField
            label="Message"
            multiline
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            fullWidth
            margin="normal"
            inputRef={bodyRef}
            onFocus={() => setActiveField("body")}
            onClick={() => setActiveField("body")}
          />
        </>
      )}

      {/* Step 5: Preview */}
      {hasExcel && recipientsPayload.length > 0 && preview && (
        <Box sx={{ mt: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Preview (first row)
          </Typography>

          <Typography variant="body2" sx={{ mb: 1 }}>
            Recipients: {recipientsPayload.length}
          </Typography>

          <Typography variant="body2" sx={{ mb: 0.5 }}>
            To:
          </Typography>
          <Typography variant="body2" sx={{ ml: 1 }} color="text.secondary">
            {preview.to}
          </Typography>

          <Typography variant="body2" sx={{ mt: 1, mb: 0.5 }}>
            Subject (after placeholders):
          </Typography>
          <Typography variant="body2" sx={{ ml: 1 }} color="text.secondary">
            {preview.subject || "(empty subject after placeholders)"}
          </Typography>

          <Typography variant="body2" sx={{ mt: 1, mb: 0.5 }}>
            Message (after placeholders):
          </Typography>
          <Typography
            variant="body2"
            sx={{ ml: 1, whiteSpace: "pre-wrap" }}
            color="text.secondary"
          >
            {preview.body || "(empty body after placeholders)"}
          </Typography>

          <Typography
            variant="caption"
            sx={{ display: "block", mt: 1 }}
            color="text.secondary"
          >
            Payload sent to server includes only referenced placeholder keys and
            their row values.
          </Typography>
        </Box>
      )}

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {success}
        </Alert>
      )}

      {/* Send button */}
      {hasExcel && (
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={sending || !recipientsPayload.length || !selectedConfigId}
          sx={{
            mt: 3,
            py: 1.4,
            fontWeight: 700,
            textTransform: "none",
            borderRadius: 2,
          }}
        >
          {sending ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Sending…
            </>
          ) : (
            "Send Bulk Email"
          )}
        </Button>
      )}
    </Box>
  );
}
