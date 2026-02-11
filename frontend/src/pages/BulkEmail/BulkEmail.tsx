import { useEffect, useRef, useState } from "react";
import {
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
import ImportFromExcelAccordion from "./ImportFromExcelAccordion";
import { apiFetch } from "../../utils/api";
import PageContainer from "../../components/PageContainer";
import ToolStatusAlerts from "../../components/alerts/ToolStatusAlerts";
import { useAuth } from "../../utils/auth";

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

const LAST_SMTP_EMAIL_KEY_PREFIX = "bulk_email:last_smtp_email";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function lastSmtpEmailStorageKey(userId?: number) {
  return `${LAST_SMTP_EMAIL_KEY_PREFIX}:${userId ?? "guest"}`;
}

export default function BulkEmail() {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState({
    smtp: false,
    contacts: false,
    excel: false,
    send: false,
  });

  const toggle =
    (key: "smtp" | "contacts" | "excel" | "send") =>
    (_: any, isExpanded: boolean) =>
      setExpanded((prev) => ({ ...prev, [key]: isExpanded }));

  const [smtpConfigs, setSmtpConfigs] = useState<SMTPConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | "">("");
  const [preferredSmtpEmail, setPreferredSmtpEmail] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);

  const [oauthError, setOauthError] = useState("");
  const [oauthSuccess, setOauthSuccess] = useState("");

  const didFetch = useRef(false);

  function rememberSmtpEmail(rawEmail: string) {
    const email = normalizeEmail(rawEmail);
    if (!email) return;

    setPreferredSmtpEmail(email);

    if (!user?.id) return;
    try {
      localStorage.setItem(lastSmtpEmailStorageKey(user.id), email);
    } catch {
      // Ignore storage failures in restricted browsers.
    }
  }

  function setStoredPreferredSmtpEmail(value: string) {
    if (!user?.id) return;
    try {
      if (value) {
        localStorage.setItem(lastSmtpEmailStorageKey(user.id), value);
      } else {
        localStorage.removeItem(lastSmtpEmailStorageKey(user.id));
      }
    } catch {
      // Ignore storage failures in restricted browsers.
    }
  }

  async function loadSmtpConfigs() {
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
          text.slice(0, 200),
        );
        return;
      }

      const data = await res.json();
      const configs = data.configs || [];
      setSmtpConfigs(configs);
    } catch (err) {
      console.error("Failed to load SMTP configs:", err);
    }
  }

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
          text.slice(0, 200),
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

  useEffect(() => {
    const accountEmail = normalizeEmail(user?.email);
    let remembered = "";

    if (user?.id) {
      try {
        remembered = normalizeEmail(
          localStorage.getItem(lastSmtpEmailStorageKey(user.id)),
        );
      } catch {
        remembered = "";
      }
    }

    setPreferredSmtpEmail(remembered || accountEmail);
  }, [user?.email, user?.id]);

  useEffect(() => {
    if (!smtpConfigs.length) {
      if (selectedConfigId !== "") {
        setSelectedConfigId("");
      }
      return;
    }

    if (
      selectedConfigId &&
      smtpConfigs.some((cfg) => cfg.id === selectedConfigId)
    ) {
      return;
    }

    const preferredMatch = preferredSmtpEmail
      ? smtpConfigs.find(
          (cfg) => normalizeEmail(cfg.smtp_email) === preferredSmtpEmail,
        )
      : undefined;

    const accountEmail = normalizeEmail(user?.email);
    const accountMatch = accountEmail
      ? smtpConfigs.find((cfg) => normalizeEmail(cfg.smtp_email) === accountEmail)
      : undefined;

    setSelectedConfigId(preferredMatch?.id ?? accountMatch?.id ?? smtpConfigs[0].id);
  }, [preferredSmtpEmail, selectedConfigId, smtpConfigs, user?.email]);

  useEffect(() => {
    if (!selectedConfigId) return;
    const selected = smtpConfigs.find((cfg) => cfg.id === selectedConfigId);
    if (selected?.smtp_email) {
      rememberSmtpEmail(selected.smtp_email);
    }
  }, [selectedConfigId, smtpConfigs, user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthState = params.get("gmail_oauth");
    if (!oauthState) return;

    if (oauthState === "success") {
      const connectedEmail = params.get("smtp_email");
      if (connectedEmail) {
        rememberSmtpEmail(connectedEmail);
      }
      setOauthSuccess(
        connectedEmail
          ? `Gmail connected: ${connectedEmail}`
          : "Gmail connected successfully",
      );
      setOauthError("");
      loadSmtpConfigs();
      setExpanded({ smtp: true, contacts: false, excel: false, send: false });
    } else {
      const rawError = params.get("error");
      setOauthError(rawError || "Gmail connection failed");
      setOauthSuccess("");
      setExpanded({ smtp: true, contacts: false, excel: false, send: false });
    }

    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  return (
    <PageContainer maxWidth={820}>
      <Divider sx={{ mb: 3 }} />

      <ToolStatusAlerts error={oauthError} success={oauthSuccess} sx={{ mb: 2 }} />

      <Accordion
        expanded={expanded.smtp}
        onChange={toggle("smtp")}
        sx={accordionStyle}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={700} sx={{ color: "#60a5fa" }}>
            Gmail Sender Settings
          </Typography>
        </AccordionSummary>

        <AccordionDetails>
          <Box>
            <SmtpSettingsAccordion
              smtpConfigs={smtpConfigs}
              defaultSmtpEmail={preferredSmtpEmail}
              onSmtpEmailRemember={rememberSmtpEmail}
              onDisconnected={(disconnectedEmail) => {
                const removedEmail = normalizeEmail(disconnectedEmail);
                const accountEmail = normalizeEmail(user?.email);
                const nextPreferred =
                  preferredSmtpEmail && preferredSmtpEmail === removedEmail
                    ? accountEmail
                    : preferredSmtpEmail;

                setPreferredSmtpEmail(nextPreferred);
                setStoredPreferredSmtpEmail(nextPreferred);
                setOauthSuccess(`Gmail disconnected: ${removedEmail}`);
                setOauthError("");
                loadSmtpConfigs();
              }}
              onConnected={() => {
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
              <Typography sx={{ mt: 2 }} variant="body2" color="text.secondary">
                Loading groups...
              </Typography>
            ) : contactGroups.length ? (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Saved groups
                </Typography>
                {contactGroups.map((g) => (
                  <Typography key={g.id} variant="body2" sx={{ color: "text.secondary" }}>
                    - {g.group_name} ({g.contact_count} contacts)
                  </Typography>
                ))}
              </Box>
            ) : (
              <Typography sx={{ mt: 2 }} variant="body2" color="text.secondary">
                No groups yet. Create your first contact group above.
              </Typography>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion
        expanded={expanded.excel}
        onChange={toggle("excel")}
        sx={accordionStyle}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={700} sx={{ color: "#fbbf24" }}>
            Excel to Bulk Email
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
    </PageContainer>
  );
}
