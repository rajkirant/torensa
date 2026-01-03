import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";

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

export default function SendEmailAccordion({
  smtpConfigs,
  selectedConfigId,
  setSelectedConfigId,
}: Props) {
  const [emails, setEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSend(e: React.FormEvent) {
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

    if (emailList.length === 0) {
      setError("Please enter at least one recipient email");
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

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to send email");
        return;
      }

      setSuccess(`Email sent to ${emailList.length} recipients`);
      setEmails("");
      setSubject("");
      setBody("");
      setFiles(null);
    } catch {
      setError("Email sending failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSend}>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Select SMTP Configuration</InputLabel>
        <Select
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

      <textarea
        placeholder="email1@gmail.com, email2@gmail.com"
        rows={4}
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 12 }}
      />

      <input
        placeholder="Email subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 12 }}
      />

      <textarea
        placeholder="Write your message here..."
        rows={6}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 12 }}
      />

      <input type="file" multiple onChange={(e) => setFiles(e.target.files)} />

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
        disabled={sending || smtpConfigs.length === 0}
        sx={{ mt: 2 }}
      >
        {sending ? <CircularProgress size={22} /> : "Send Email"}
      </Button>
    </Box>
  );
}
