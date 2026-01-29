import type React from "react";
import { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  IconButton,
  Chip,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
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

function applyDollarTemplate(template: string, vars: Record<string, string>) {
  const ESC = "__DOLLAR_ESC__";
  const withEscaped = template.replace(/\$\$/g, ESC);

  const replaced = withEscaped.replace(/\$([A-Za-z0-9_]+)/g, (full, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      const v = vars[key];
      return v == null ? "" : String(v);
    }
    return full; // keep unknown placeholders visible
  });

  return replaced.replaceAll(ESC, "$");
}

function extractPlaceholderKeys(subject: string, body: string) {
  const text = `${subject}\n${body}`.replace(/\$\$/g, ""); // ignore escaped $$
  const re = /\$([A-Za-z0-9_]+)/g;
  const keys = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) keys.add(m[1]);
  return Array.from(keys);
}

function buildRowVars(headers: string[], row: any[]) {
  const vars: Record<string, string> = {};
  headers.forEach((h, i) => {
    if (!h) return;
    const raw = row?.[i];
    const val = raw == null ? "" : String(raw);

    // recommended key
    vars[headerToKey(h)] = val;

    // also keep original header (won't match if it has spaces, but harmless)
    vars[h] = val;
  });
  return vars;
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

export default function SendEmailAccordion({
  smtpConfigs,
  selectedConfigId,
  setSelectedConfigId,
}: Props) {
  // Excel state
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [emailColumn, setEmailColumn] = useState<string>("");

  // Email compose state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  // UX state
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Cursor tracking for placeholder insert
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLInputElement | null>(null);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const hasExcel = !!fileName && headers.length > 0 && rows.length > 0;

  async function handleExcelChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");

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

      const autoEmailHeader =
        cleanHeaders.find((h) => h.toLowerCase().includes("email")) ||
        cleanHeaders[0] ||
        "";

      setEmailColumn(autoEmailHeader);
    } catch (err) {
      console.error("Excel parse error:", err);
      setFileName(null);
      setHeaders([]);
      setRows([]);
      setEmailColumn("");
      setError("Failed to read Excel file");
    } finally {
      e.target.value = "";
    }
  }

  function handleInsertHeader(header: string) {
    const token = `$${headerToKey(header)}`;
    if (activeField === "subject") {
      insertAtCursor(subjectRef.current, token, setSubject, subject);
    } else {
      insertAtCursor(bodyRef.current as any, token, setBody, body);
    }
  }

  const placeholderKeys = useMemo(
    () => extractPlaceholderKeys(subject, body),
    [subject, body],
  );

  /**
   * This is the JSON you said you want to send to the server BEFORE/WHILE updating bulk API:
   * recipientsPayload = [{ to, vars: {Key:Value, ...} }]
   * vars includes ONLY keys referenced by placeholders (placeholderKeys)
   */
  const recipientsPayload = useMemo(() => {
    if (!hasExcel || !emailColumn) return [];

    const emailIndex = headers.indexOf(emailColumn);
    if (emailIndex === -1) return [];

    return rows.slice(1).flatMap((row) => {
      const to = row?.[emailIndex];
      if (typeof to !== "string" || !to.trim()) return [];

      const fullVars = buildRowVars(headers, row);

      const selectedVars: Record<string, string> = {};
      for (const k of placeholderKeys) {
        selectedVars[k] = Object.prototype.hasOwnProperty.call(fullVars, k)
          ? (fullVars[k] ?? "")
          : "";
      }

      return [{ to: to.trim(), vars: selectedVars }];
    });
  }, [hasExcel, emailColumn, headers, rows, placeholderKeys]);

  const previewItems = useMemo(() => {
    return recipientsPayload.map((r) => ({
      to: r.to,
      subject: applyDollarTemplate(subject, r.vars),
      body: applyDollarTemplate(body, r.vars),
      vars: r.vars,
    }));
  }, [recipientsPayload, subject, body]);

  const current = previewItems[previewIndex];

  function openPreview() {
    setError("");
    setSuccess("");

    if (!selectedConfigId) {
      setError("Please select an SMTP configuration");
      return;
    }
    if (!hasExcel) {
      setError("Please import an Excel file first");
      return;
    }
    if (!recipientsPayload.length) {
      setError("No recipient emails found. Check the selected email column.");
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

    setPreviewIndex(0);
    setPreviewOpen(true);
  }

  function closePreview() {
    setPreviewOpen(false);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedConfigId) {
      setError("Please select an SMTP configuration");
      return;
    }
    if (!hasExcel) {
      setError("Please import an Excel file first");
      return;
    }
    if (!recipientsPayload.length) {
      setError("No recipient emails found. Check the selected email column.");
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
      // We send multipart FormData so attachments work.
      // Your updated backend supports "new mode" when subject_template/body_template/recipients exist.
      const formData = new FormData();
      formData.append("smtp_config_id", String(selectedConfigId));
      formData.append("subject_template", subject);
      formData.append("body_template", body);
      formData.append("recipients", JSON.stringify(recipientsPayload));
      formData.append("placeholder_keys", JSON.stringify(placeholderKeys));
      formData.append("email_column", emailColumn); // optional, for your tracking/debug

      files &&
        Array.from(files).forEach((f) => formData.append("attachments", f));

      const res = await apiFetch("/api/send-email/", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to send bulk email");
        return;
      }

      setSuccess(
        `Bulk email processed for ${recipientsPayload.length} recipients`,
      );
      setPreviewOpen(false);
    } catch (err) {
      console.error(err);
      setError("Bulk email sending failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSend}>
      {/* 1) Excel Upload */}
      <Box sx={{ mb: 2 }}>
        <Button variant="outlined" component="label" type="button">
          Excel to Bulk Email
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

      {/* 2) Column headers + email column selection */}
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

          {!!placeholderKeys.length && (
            <Typography
              variant="caption"
              sx={{ display: "block", mt: 1 }}
              color="text.secondary"
            >
              Detected placeholders:{" "}
              {placeholderKeys.map((k) => `$${k}`).join(", ")}
            </Typography>
          )}
        </Box>
      )}

      {/* 3) SMTP selector */}
      <FormControl fullWidth sx={{ mb: 2 }} disabled={!hasExcel}>
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

      {/* 4) Subject + Body */}
      {hasExcel && (
        <>
          <TextField
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            fullWidth
            margin="normal"
            helperText='Supports $Placeholders (e.g. "Hi $First_Name"). Use $$ for a literal $.'
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
            helperText="Supports the same $Placeholders as subject."
            inputRef={bodyRef}
            onFocus={() => setActiveField("body")}
            onClick={() => setActiveField("body")}
          />
        </>
      )}

      {/* 5) Attachments */}
      {hasExcel && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Attachments (optional)
          </Typography>
          <Button variant="outlined" component="label">
            Choose files
            <input
              type="file"
              hidden
              multiple
              onChange={(e) => setFiles(e.target.files)}
            />
          </Button>
          {files && (
            <Typography variant="caption" sx={{ ml: 2 }}>
              {files.length} file(s) selected
            </Typography>
          )}
        </Box>
      )}

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mt: 3 }}>
          {success}
        </Alert>
      )}

      {/* Actions: Preview + Send */}
      {hasExcel && (
        <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
          <Button
            type="button"
            variant="outlined"
            fullWidth
            disabled={sending || smtpConfigs.length === 0}
            onClick={openPreview}
            sx={{
              py: 1.2,
              fontWeight: 700,
              textTransform: "none",
              borderRadius: 2,
            }}
          >
            Preview
          </Button>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={sending || smtpConfigs.length === 0}
            sx={{
              py: 1.2,
              fontWeight: 700,
              textTransform: "none",
              borderRadius: 2,
            }}
          >
            {sending ? (
              <>
                <CircularProgress size={20} sx={{ color: "inherit", mr: 1 }} />
                Sending…
              </>
            ) : (
              "Send Bulk Email"
            )}
          </Button>
        </Stack>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={closePreview} fullWidth maxWidth="md">
        <DialogTitle sx={{ pr: 6 }}>
          Preview
          <IconButton
            onClick={closePreview}
            size="small"
            sx={{ position: "absolute", right: 12, top: 12 }}
            aria-label="End preview"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {previewItems.length === 0 ? (
            <Alert severity="warning">
              Nothing to preview. Check your email column and placeholders.
            </Alert>
          ) : (
            <>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2 }}
              >
                <Typography variant="body2" color="text.secondary">
                  Email {previewIndex + 1} of {previewItems.length}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center">
                  <IconButton
                    onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                    disabled={previewIndex === 0}
                    aria-label="Previous"
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                  <IconButton
                    onClick={() =>
                      setPreviewIndex((i) =>
                        Math.min(previewItems.length - 1, i + 1),
                      )
                    }
                    disabled={previewIndex >= previewItems.length - 1}
                    aria-label="Next"
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </Stack>
              </Stack>

              {current && (
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    To:
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    {current.to}
                  </Typography>

                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Subject:
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    {current.subject || "(empty subject after placeholders)"}
                  </Typography>

                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Message:
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ whiteSpace: "pre-wrap" }}
                  >
                    {current.body || "(empty body after placeholders)"}
                  </Typography>

                  {!!Object.keys(current.vars).length && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Vars used for this recipient:
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", whiteSpace: "pre-wrap" }}
                      >
                        {JSON.stringify(current.vars, null, 2)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={closePreview} variant="outlined">
            End Preview
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
