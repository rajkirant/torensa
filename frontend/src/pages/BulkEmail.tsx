import { useState } from "react";
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

  "&:before": {
    display: "none", // remove MUI default divider
  },

  "&.Mui-expanded": {
    margin: "12px 0",
  },
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
  // Allow both accordions to be closed
  const [expanded, setExpanded] = useState({
    smtp: false,
    send: false,
  });

  const toggle = (key: "smtp" | "send") => (_: any, isExpanded: boolean) =>
    setExpanded((prev) => ({ ...prev, [key]: isExpanded }));

  /* ---------- SMTP STATE ---------- */
  const [smtpEmail, setSmtpEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpSavedMsg, setSmtpSavedMsg] = useState("");

  /* ---------- EMAIL STATE ---------- */
  const [emails, setEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

    const emailList = emails
      .split(/[\n,]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      const formData = new FormData();
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

        <Typography color="text.secondary" mb={3}>
          Configure SMTP credentials and send bulk emails securely.
        </Typography>

        <Divider sx={{ mb: 3 }} />

        {/* ================= SMTP CONFIG ================= */}
        <Accordion
          expanded={expanded.smtp}
          onChange={toggle("smtp")}
          sx={{
            ...accordionBaseStyle,
            borderColor: "rgba(59,130,246,0.45)", // blue
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: "#e5e7eb" }} />}
            sx={{
              px: 3,
              py: 1.5,
              "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" },
            }}
          >
            <Typography fontWeight={700} sx={{ color: "#60a5fa" }}>
              SMTP Configuration
            </Typography>
          </AccordionSummary>

          <AccordionDetails>
            <Box component="form" onSubmit={handleSaveSmtp}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Your Gmail app password is encrypted and stored securely.
              </Typography>

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

              <Typography variant="caption" color="text.secondary">
                Create one at{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google App Passwords
                </a>
              </Typography>

              {smtpSavedMsg && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  {smtpSavedMsg}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                sx={{
                  mt: 2,
                  background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
                }}
                variant="contained"
                disabled={smtpSaving}
              >
                {smtpSaving ? (
                  <CircularProgress size={22} sx={{ color: "#fff" }} />
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
          sx={{
            ...accordionBaseStyle,
            borderColor: "rgba(168,85,247,0.5)", // purple
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: "#e5e7eb" }} />}
            sx={{
              px: 3,
              py: 1.5,
              "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" },
            }}
          >
            <Typography fontWeight={700} sx={{ color: "#c084fc" }}>
              Send Bulk Email
            </Typography>
          </AccordionSummary>

          <AccordionDetails>
            <Box component="form" onSubmit={handleSendEmail}>
              <textarea
                placeholder="Recipients (comma or new line separated)"
                rows={4}
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                style={inputStyle("#c084fc")}
              />

              <input
                placeholder="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={inputStyle("#c084fc")}
              />

              <textarea
                placeholder="Email message"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={inputStyle("#c084fc")}
              />

              <input
                type="file"
                multiple
                onChange={(e) => setFiles(e.target.files)}
                style={{ marginTop: 8 }}
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
                sx={{
                  mt: 2,
                  background: "linear-gradient(135deg, #7c3aed, #6366f1)",
                }}
                variant="contained"
                disabled={loading}
              >
                {loading ? (
                  <CircularProgress size={22} sx={{ color: "#fff" }} />
                ) : (
                  "Send Email"
                )}
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
}
