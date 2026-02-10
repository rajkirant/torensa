import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { apiFetch } from "../../utils/api";
import { formatApiError } from "../../utils/apiError";
import FilePickerButton from "../../components/inputs/FilePickerButton";
import ToolStatusAlerts from "../../components/alerts/ToolStatusAlerts";

type SMTPConfig = {
  id: number;
  smtp_email: string;
  provider: string;
  auth_type?: "app_password" | "oauth_refresh_token";
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

      const res = await apiFetch("/api/send-email/", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(formatApiError(data, "Failed to send email"));
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
      {/* SMTP selector */}
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
              {cfg.smtp_email} ({cfg.auth_type === "oauth_refresh_token" ? "OAuth" : "App Password"})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Recipients */}
      <TextField
        label="Recipients"
        placeholder="email1@gmail.com, email2@gmail.com"
        multiline
        rows={4}
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        helperText="Separate multiple emails with commas or new lines"
        fullWidth
        margin="normal"
      />

      {/* Subject */}
      <TextField
        label="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        fullWidth
        margin="normal"
      />

      {/* Message body */}
      <TextField
        label="Message"
        multiline
        rows={6}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        fullWidth
        margin="normal"
      />

      {/* Attachments */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Attachments (optional)
        </Typography>
        <FilePickerButton
          variant="outlined"
          label="Choose files"
          multiple
          onFilesSelected={setFiles}
        />
        {files && (
          <Typography variant="caption" sx={{ ml: 2 }}>
            {files.length} file(s) selected
          </Typography>
        )}
      </Box>

      {/* Alerts */}
      <ToolStatusAlerts error={error} success={success} />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={sending || smtpConfigs.length === 0}
        sx={{
          mt: 4,
          py: 1.4,
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
          "Send Email"
        )}
      </Button>
    </Box>
  );
}
