import { useState } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

export default function BulkEmail() {
  const [emails, setEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Parse emails: comma OR newline separated
    const emailList = emails
      .split(/[\n,]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (emailList.length === 0 || !subject || !body) {
      setError("Emails, subject, and message are required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/send-email/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          to: emailList,
          subject,
          body,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to send emails");
        return;
      }

      setSuccess(`Email sent to ${emailList.length} recipients`);
      setEmails("");
      setSubject("");
      setBody("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "80px auto" }}>
      <h2>Send Bulk Email</h2>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label>Recipients</label>
          <textarea
            placeholder="email1@example.com, email2@example.com"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            rows={4}
            required
            style={{ width: "100%", padding: 8 }}
          />
          <small style={{ color: "#6b7280" }}>
            Separate emails using commas or new lines
          </small>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        {error && <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>}
        {success && (
          <p style={{ color: "#059669", marginBottom: 16 }}>{success}</p>
        )}

        <Button
          type="submit"
          fullWidth
          size="large"
          disabled={loading}
          sx={{
            mt: 1,
            py: 1.5,
            fontSize: "1.05rem",
            fontWeight: 700,
            letterSpacing: "0.03em",
            borderRadius: 3,
            textTransform: "none",
            color: "#ffffff",
            background: "linear-gradient(135deg, #059669, #2563eb)",
            boxShadow: "0 10px 25px rgba(37, 99, 235, 0.35)",
            "&:hover": {
              background: "linear-gradient(135deg, #047857, #1e40af)",
            },
            "&.Mui-disabled": {
              color: "#ffffff",
              opacity: 0.8,
            },
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={22} sx={{ color: "#ffffff", mr: 1 }} />
              Sending…
            </>
          ) : (
            "Send Email"
          )}
        </Button>
      </form>
    </div>
  );
}
