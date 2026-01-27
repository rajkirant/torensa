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
import ContactGroupsAccordion from "./ContactGroupsAccordion";
import ImportFromExcelAccordion from "./ImportFromExcelAccordion"; // ✅ NEW
import { apiFetch } from "../../utils/api";

/* ===================== TYPES ===================== */

type SMTPConfig = {
  id: number;
  smtp_email: string;
  provider: string;
};

type ContactGroup = {
  id: number;
  group_name: string;
  contact_count: number;
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
    smtp: false,
    contacts: false,
    excel: false, // ✅ NEW
    send: false,
  });

  const toggle =
      (key: "smtp" | "contacts" | "excel" | "send") =>
          (_: any, isExpanded: boolean) =>
              setExpanded((prev) => ({ ...prev, [key]: isExpanded }));

  /* ---------- SMTP Config State ---------- */
  const [smtpConfigs, setSmtpConfigs] = useState<SMTPConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | "">("");
  const [loadingConfigs, setLoadingConfigs] = useState(false);

  /* ---------- Contact Groups State ---------- */
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  /* ---------- Prevent double fetch ---------- */
  const didFetch = useRef(false);

  /* ===================== LOAD SMTP CONFIGS ===================== */

  async function loadSmtpConfigs() {
    setLoadingConfigs(true);
    try {
      const res = await apiFetch("/api/smtp/list/", {
        credentials: "include",
      });

      if (!res.ok) {
        console.warn("SMTP list request failed:", res.status);
        return;
      }

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const text = await res.text();
        console.warn(
            "SMTP list returned non-JSON response; skipping parse. First 200 chars:",
            text.slice(0, 200)
        );
        return;
      }

      const data = await res.json();
      setSmtpConfigs(data.configs || []);

      if (!selectedConfigId && data.configs?.length) {
        setSelectedConfigId(data.configs[0].id);
      }
    } catch (err) {
      console.error("Failed to load SMTP configs:", err);
    } finally {
      setLoadingConfigs(false);
    }
  }

  /* ===================== LOAD CONTACT GROUPS ===================== */

  async function loadContactGroups() {
    setLoadingGroups(true);
    try {
      const res = await apiFetch("/api/contact-groups/list/", {
        credentials: "include",
      });

      if (!res.ok) {
        console.warn("Contact groups request failed:", res.status);
        return;
      }

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const text = await res.text();
        console.warn(
            "Contact groups returned non-JSON response; skipping parse. First 200 chars:",
            text.slice(0, 200)
        );
        return;
      }

      const data = await res.json();
      setContactGroups(data.groups || []);
    } catch (err) {
      console.error("Failed to load contact groups:", err);
    } finally {
      setLoadingGroups(false);
    }
  }

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadSmtpConfigs();
    loadContactGroups();
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
                      setExpanded({
                        smtp: false,
                        contacts: true,
                        excel: false,
                        send: false,
                      });
                    }}
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* ================= CONTACT GROUPS ================= */}
          <Accordion
              expanded={expanded.contacts}
              onChange={toggle("contacts")}
              sx={accordionStyle}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={700} sx={{ color: "#34d399" }}>
                Contact Groups
              </Typography>
            </AccordionSummary>

            <AccordionDetails>
              <Box>
                <ContactGroupsAccordion
                    onSaved={() => {
                      loadContactGroups();
                      setExpanded({
                        smtp: false,
                        contacts: false,
                        excel: true,
                        send: false,
                      });
                    }}
                />

                {loadingGroups ? (
                    <Typography
                        sx={{ mt: 2 }}
                        variant="body2"
                        color="text.secondary"
                    >
                      Loading groups…
                    </Typography>
                ) : contactGroups.length ? (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Saved groups
                      </Typography>
                      {contactGroups.map((g) => (
                          <Typography
                              key={g.id}
                              variant="body2"
                              sx={{ color: "text.secondary" }}
                          >
                            • {g.group_name} ({g.contact_count} contacts)
                          </Typography>
                      ))}
                    </Box>
                ) : (
                    <Typography
                        sx={{ mt: 2 }}
                        variant="body2"
                        color="text.secondary"
                    >
                      No groups yet. Create your first contact group above.
                    </Typography>
                )}
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* ================= IMPORT FROM EXCEL ================= */}
          <Accordion
              expanded={expanded.excel}
              onChange={toggle("excel")}
              sx={accordionStyle}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={700} sx={{ color: "#fbbf24" }}>
                Import from Excel
              </Typography>
            </AccordionSummary>

            <AccordionDetails>
              <Box>
                <ImportFromExcelAccordion
                    smtpConfigs={smtpConfigs}
                    selectedConfigId={selectedConfigId}
                    setSelectedConfigId={setSelectedConfigId}
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
