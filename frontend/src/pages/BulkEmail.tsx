import { useEffect, useState, useRef } from "react";

import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Divider,
  Alert,
  Box,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

/* ===================== STYLES ===================== */

const accordionBaseStyle = {
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.15)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
  boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
  overflow: "hidden",
  mb: 2,
  "&:before": { display: "none" },
};

const inputStyle = (borderColor: string) => ({
  width: "100%",
  padding: 10,
  marginBottom: 12,
  borderRadius: 8,
  border: `1px solid ${borderColor}`,
  background: "rgba(0,0,0,0.25)",
  color: "#e5e7eb",
  outline: "none",
});

/* ===================== COMPONENT ===================== */

export default function BulkEmail() {
  const [expanded, setExpanded] = useState({
    smtp: false,
    send: false,
  });

  const toggle = (key: "smtp" | "send") => (_: any, isExpanded: boolean) =>
    setExpanded((prev) => ({ ...prev, [key]: isExpanded }));

  /* ---------- SMTP CONFIG LIST ---------- */
  const [smtpConfigs, setSmtpConfigs] = useState<
    { id: number; smtp_email: string; provider: string }[]
  >([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | "">("");
  const [loadingConfigs, setLoadingConfigs] = useState(false);

  /* ---------- SMTP SAVE ---------- */
  const [smtpEmail, setSmtpEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpSavedMsg, setSmtpSavedMsg] = useState("");

  /* ---------- EMAIL ---------- */
  const [emails, setEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ===================== LOAD SMTP CONFIGS ===================== */

  async function loadSmtpConfigs() {
    setLoadingConfigs(true);
    try {
      const res = await fetch("/api/smtp/list/", {
        credentials: "include",
      });
      if (!res.ok) return;

      const data = await res.json();
      setSmtpConfigs(data.configs || []);
    } finally {
      setLoadingConfigs(false);
    }
  }

  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    loadSmtpConfigs();
  }, []);

  /* ===================== HANDLERS ===================== */

  async function handleSaveSmtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSmtpSavedMsg("");
    setSmtpSaving(true);

    try {
      const res = await fetch("/api/smtp/save/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          smtp_email: smtpEmail,
          app_password: appPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data?.error || "Failed to save SMTP settings");
        return;
      }

      setAppPassword("");
      setSmtpSavedMsg("SMTP credentials saved securely");
      loadSmtpConfigs();
    } catch {
      setError("Unable to save SMTP credentials");
    } finally {
      setSmtpSaving(false);
    }
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedConfigId) {
      setError("Please select an SMTP configuration");
      return;
    }

    const emailList = emails
      .split(/[\n,]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("smtp_config_id", String(selectedConfigId));
      formData.append("to", JSON.stringify(emailList));
      formData.append("subject", subject);
      formData.append("body", body);
      files &&
        Array.from(files).forEach((f) => formData.append("attachments", f));

      const res = await fetch("/api/send-email/", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data?.error || "Email delivery failed");
        return;
      }

      setSuccess(`Email sent to ${emailList.length} recipients`);
      setEmails("");
      setSubject("");
      setBody("");
      setFiles(null);
    } catch {
      setError("Failed to send emails");
    } finally {
      setLoading(false);
    }
  }

  /* ===================== RENDER ===================== */

  return (
    <Card sx={{ maxWidth: 760, margin: "80px auto" }}>
      <CardContent>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Bulk Email
        </Typography>
        <Divider sx={{ mb: 3 }} />
        {/* ================= SMTP CONFIG ================= */}
        <Accordion
          expanded={expanded.smtp}
          onChange={toggle("smtp")}
          sx={accordionBaseStyle}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700} sx={{ color: "#60a5fa" }}>
              SMTP Configuration
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box component="form" onSubmit={handleSaveSmtp}>
              <input
                type="email"
                placeholder="Gmail address"
                value={smtpEmail}
                onChange={(e) => setSmtpEmail(e.target.value)}
                required
                style={inputStyle("#60a5fa")}
              />
              <input
                type="password"
                placeholder="Gmail app password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                required
                style={inputStyle("#60a5fa")}
              />
              {smtpSavedMsg && <Alert severity="success">{smtpSavedMsg}</Alert>}
              <Button type="submit" fullWidth disabled={smtpSaving}>
                {smtpSaving ? (
                  <CircularProgress size={22} />
                ) : (
                  "Save SMTP Settings"
                )}
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>
        {/* ================= SEND EMAIL ================= */}
        <Accordion
          expanded={expanded.send}
          onChange={toggle("send")}
          sx={accordionBaseStyle}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700} sx={{ color: "#c084fc" }}>
              Send Bulk Email
            </Typography>
          </AccordionSummary>

          <AccordionDetails>
            <Box component="form" onSubmit={handleSendEmail}>
              {/* SMTP DROPDOWN */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="smtp-select-label">
                  Select SMTP Configuration
                </InputLabel>

                <Select
                  labelId="smtp-select-label"
                  label="Select SMTP Configuration"
                  value={selectedConfigId}
                  onChange={(e) =>
                    setSelectedConfigId(e.target.value as number)
                  }
                  required
                >
                  {/* Placeholder */}
                  <MenuItem value="">
                    <em>Choose an email account</em>
                  </MenuItem>

                  {smtpConfigs.map((cfg) => (
                    <MenuItem key={cfg.id} value={cfg.id}>
                      {cfg.smtp_email} ({cfg.provider})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {smtpConfigs.length === 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  No SMTP configuration found. Please add one above.
                </Alert>
              )}

              <textarea
                placeholder="Recipients (comma or new line separated)"
                rows={4}
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                style={inputStyle("#c084fc")}
                required
              />

              <input
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={inputStyle("#c084fc")}
                required
              />

              <textarea
                placeholder="Message"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={inputStyle("#c084fc")}
                required
              />

              <input
                type="file"
                multiple
                onChange={(e) => setFiles(e.target.files)}
              />

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

              <Button
                type="submit"
                fullWidth
                disabled={loading || smtpConfigs.length === 0}
                sx={{ mt: 2 }}
              >
                {loading ? <CircularProgress size={22} /> : "Send Email"}
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
}
