import type React from "react";
import { useMemo, useState } from "react";
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

    async function handleExcelChange(
        e: React.ChangeEvent<HTMLInputElement>
    ) {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setSuccess(null);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[firstSheetName];

            const sheetRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
                header: 1,
            });

            const headerRow = (sheetRows[0] || []) as (string | number | null)[];
            const cleanHeaders = headerRow.map((h) =>
                h == null ? "" : String(h)
            );

            setFileName(file.name);
            setHeaders(cleanHeaders);
            setRows(sheetRows);

            // auto-pick an email column if we can
            const autoEmailHeader =
                cleanHeaders.find((h) =>
                    h.toLowerCase().includes("email")
                ) || cleanHeaders[0] || "";

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

    // compute list of recipient emails from selected column
    const recipientEmails = useMemo(() => {
        if (!emailColumn || headers.length === 0 || rows.length <= 1) {
            return [];
        }
        const colIndex = headers.indexOf(emailColumn);
        if (colIndex === -1) return [];

        return rows
            .slice(1) // skip header
            .map((row) => row[colIndex])
            .filter((v) => typeof v === "string" && v.trim().length > 0)
            .map((v) => (v as string).trim());
    }, [emailColumn, headers, rows]);

    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!selectedConfigId) {
            setError("Please select an SMTP configuration");
            return;
        }

        if (!recipientEmails.length) {
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
            const formData = new FormData();
            formData.append("smtp_config_id", String(selectedConfigId));
            formData.append("to", JSON.stringify(recipientEmails));
            formData.append("subject", subject);
            formData.append("body", body);

            const res = await apiFetch("/api/send-email/", {
                method: "POST",
                credentials: "include",
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data?.error || "Failed to send email");
                return;
            }

            setSuccess(
                `Email sent to ${recipientEmails.length} recipients`
            );
        } catch (err) {
            console.error(err);
            setError("Email sending failed");
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

            {/* Step 2: Show headers and choose email column */}
            {hasExcel && (
                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        Column headers:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                        {headers.map((h, i) => (
                            <Chip
                                key={i}
                                label={h || "(empty)"}
                                size="small"
                                variant={
                                    h === emailColumn ? "filled" : "outlined"
                                }
                                color={h === emailColumn ? "primary" : "default"}
                                onClick={() => setEmailColumn(h)}
                            />
                        ))}
                    </Stack>

                    <FormControl fullWidth size="small">
                        <InputLabel id="email-column-label">
                            Email column
                        </InputLabel>
                        <Select
                            labelId="email-column-label"
                            label="Email column"
                            value={emailColumn}
                            onChange={(e) =>
                                setEmailColumn(e.target.value as string)
                            }
                        >
                            {headers.map((h, i) => (
                                <MenuItem key={i} value={h}>
                                    {h || "(empty)"}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            )}

            {/* Step 3: SMTP config selection (reuse same selection) */}
            {hasExcel && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="smtp-select-label">
                        Select SMTP Configuration
                    </InputLabel>
                    <Select
                        labelId="smtp-select-label"
                        value={selectedConfigId}
                        label="Select SMTP Configuration"
                        onChange={(e) =>
                            setSelectedConfigId(e.target.value as number)
                        }
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
                    />

                    <TextField
                        label="Message"
                        multiline
                        rows={6}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        fullWidth
                        margin="normal"
                    />
                </>
            )}

            {/* Step 5: Preview */}
            {hasExcel && recipientEmails.length > 0 && (
                <Box sx={{ mt: 2, mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Preview
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        Recipients: {recipientEmails.length}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ mb: 1 }}
                        color="text.secondary"
                    >
                        {recipientEmails.slice(0, 5).join(", ")}
                        {recipientEmails.length > 5 &&
                            `, and ${recipientEmails.length - 5} more...`}
                    </Typography>

                    <Typography variant="body2" sx={{ mt: 1, mb: 0.5 }}>
                        Subject:
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ ml: 1 }}
                        color="text.secondary"
                    >
                        {subject || "(no subject)"}
                    </Typography>

                    <Typography variant="body2" sx={{ mt: 1, mb: 0.5 }}>
                        Message:
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ ml: 1, whiteSpace: "pre-wrap" }}
                        color="text.secondary"
                    >
                        {body || "(no message)"}
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
                    disabled={
                        sending ||
                        !recipientEmails.length ||
                        !selectedConfigId
                    }
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
                        "Send Email"
                    )}
                </Button>
            )}
        </Box>
    );
}
