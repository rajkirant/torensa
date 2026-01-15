import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SmtpSettingsAccordion from "./SmtpSettingsAccordion";
import SendEmailAccordion from "./SendEmailAccordion";
import { apiFetch } from "../../utils/api";

/* ===================== TYPES ===================== */

type SMTPConfig = {
  id: number;
  smtp_email: string;
  provider: string;
};

/* ===================== STYLES ===================== */

const accordionStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.18)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
  boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
  overflow: "hidden",
  mb: 2,
  "&:before": { display: "none" },
};

/* ===================== COMPONENT ===================== */

export default function BulkEmail() {
  /* ---------- Accordion state ---------- */
  const [expanded, setExpanded] = useState({
    smtp: true,
    send: false,
  });

  const toggle = (key: "smtp" | "send") => (_: any, isExpanded: boolean) =>
    setExpanded((prev) => ({ ...prev, [key]: isExpanded }));

  /* ---------- SMTP Config State ---------- */
  const [smtpConfigs, setSmtpConfigs] = useState<SMTPConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | "">("");
  const [loadingConfigs, setLoadingConfigs] = useState(false);

  /* ---------- Prevent double fetch ---------- */
  const didFetch = useRef(false);

  /* ===================== LOAD SMTP CONFIGS ===================== */

  async function loadSmtpConfigs() {
    setLoadingConfigs(true);
    try {
      const res = await apiFetch("/api/smtp/list/", {
        credentials: "include",
      });

      if (!res.ok) return;

      const data = await res.json();
      setSmtpConfigs(data.configs || []);

      // Auto-select first config if none selected
      if (!selectedConfigId && data.configs?.length) {
        setSelectedConfigId(data.configs[0].id);
      }
    } finally {
      setLoadingConfigs(false);
    }
  }

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadSmtpConfigs();
  }, []);

  /* ===================== RENDER ===================== */

  return (
    <Card sx={{ maxWidth: 820, margin: "80px auto" }}>
      <CardContent>
        <Typography variant="h5" fontWeight={800} gutterBottom>
          Bulk Email Management
        </Typography>

        <Typography variant="body2" sx={{ color: "#9ca3af", mb: 2 }}>
          Securely store Gmail App Passwords and send emails using your own SMTP
          credentials.
        </Typography>

        <Divider sx={{ mb: 3 }} />

        {/* ================= SMTP SETTINGS ================= */}
        <Accordion
          expanded={expanded.smtp}
          onChange={toggle("smtp")}
          sx={accordionStyle}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700} sx={{ color: "#60a5fa" }}>
              Gmail SMTP Settings
            </Typography>
          </AccordionSummary>

          <AccordionDetails>
            <Box>
              <SmtpSettingsAccordion
                onSaved={() => {
                  loadSmtpConfigs();
                  setExpanded({ smtp: false, send: true });
                }}
              />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* ================= SEND EMAIL ================= */}
        <Accordion
          expanded={expanded.send}
          onChange={toggle("send")}
          sx={accordionStyle}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700} sx={{ color: "#c084fc" }}>
              Send Bulk Email
            </Typography>
          </AccordionSummary>

          <AccordionDetails>
            <Box>
              <SendEmailAccordion
                smtpConfigs={smtpConfigs}
                selectedConfigId={selectedConfigId}
                setSelectedConfigId={setSelectedConfigId}
              />
            </Box>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
}
