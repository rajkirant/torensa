import { useEffect, useMemo, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import PageContainer from "../components/PageContainer";
import { ActionButton } from "../components/buttons/ActionButton";
import { TransparentButton } from "../components/buttons/TransparentButton";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import useToolStatus from "../hooks/useToolStatus";

/* ── data ─────────────────────────────────────────────── */

/** A value typed once and used as {{key}} in templates and option sentences. */
type Field = { key: string; label: string; placeholder?: string; multiline?: boolean };

/** A checkbox that fills the {{key}} placeholder with a sentence. */
type LetterOption = {
  key: string;
  label: string;
  text: string;
  /** Fields this option's sentence uses, shown while it is ticked. */
  fields?: Field[];
  custom?: boolean;
};

type Template = { id: string; name: string; summary: string; body: string };

const DETAIL_FIELDS: Field[] = [
  { key: "yourName", label: "Your name" },
  { key: "yourEmail", label: "Your email" },
  { key: "yourPhone", label: "Your phone" },
  { key: "company", label: "Company" },
  { key: "role", label: "Job title", placeholder: "e.g. Senior .NET Developer" },
  { key: "hiringManager", label: "Hiring manager", placeholder: "e.g. Ms Smith, or Hiring Manager" },
  { key: "currentRole", label: "Your current role", placeholder: "e.g. Software Engineer" },
  { key: "yearsExperience", label: "Years of experience", placeholder: "e.g. 5" },
  {
    key: "keySkills",
    label: "Key skills or achievements",
    placeholder: "e.g. building REST APIs and cloud services used by 2 million people",
    multiline: true,
  },
];

const DEFAULT_OPTIONS: LetterOption[] = [
  {
    key: "techTransfer",
    label: "Different tech stack (e.g. .NET job)",
    text:
      "Although most of my recent work has been in {{currentStack}} rather than {{targetTech}}, the fundamentals of software engineering carry over directly. Today, AI-assisted coding tools make it much faster to pick up a new language and its ecosystem, so I am confident I can transfer my skills quickly and become productive in {{targetTech}} early on.",
    fields: [
      { key: "targetTech", label: "Job's technology", placeholder: "e.g. .NET" },
      { key: "currentStack", label: "Your current stack", placeholder: "e.g. Java and Python" },
    ],
  },
  {
    key: "visa",
    label: "Visa status",
    text: "I hold {{visaStatus}}, which gives me the right to work in {{workCountry}} without sponsorship.",
    fields: [
      { key: "visaStatus", label: "Visa status", placeholder: "e.g. a Graduate visa valid until 2028" },
      { key: "workCountry", label: "Country", placeholder: "e.g. the UK" },
    ],
  },
  {
    key: "availability",
    label: "Availability / notice period",
    text: "I am available to start {{startDate}}.",
    fields: [{ key: "startDate", label: "Start date", placeholder: "e.g. immediately, or after a one-month notice period" }],
  },
  {
    key: "relocation",
    label: "Open to relocation",
    text: "I would be happy to relocate to {{location}} for this role.",
    fields: [{ key: "location", label: "Location", placeholder: "e.g. London" }],
  },
  {
    key: "workMode",
    label: "Remote / hybrid working",
    text: "I am comfortable working remotely, on site or in a hybrid arrangement, whichever suits the team best.",
  },
  {
    key: "referral",
    label: "Referred by someone",
    text: "{{referrer}} suggested that I apply for this position.",
    fields: [{ key: "referrer", label: "Referred by", placeholder: "e.g. Jane Doe, a developer on your team" }],
  },
];

const TEMPLATES: Template[] = [
  {
    id: "professional",
    name: "Professional",
    summary: "A classic four-paragraph letter for most applications.",
    body: `{{yourName}}
{{yourEmail}} | {{yourPhone}}

Dear {{hiringManager}},

I am writing to apply for the {{role}} position at {{company}}. {{referral}} With {{yearsExperience}} years of experience as a {{currentRole}}, I have a strong track record in {{keySkills}}.

{{techTransfer}}

I am drawn to {{company}} because of the impact of its work, and I would welcome the chance to contribute to its goals while continuing to grow as an engineer. {{workMode}}

{{visa}} {{availability}} {{relocation}}

Thank you for considering my application. I would be glad to discuss how my experience can help your team.

Kind regards,
{{yourName}}`,
  },
  {
    id: "career-change",
    name: "Career change",
    summary: "Leads with transferable skills, for a new stack or field.",
    body: `Dear {{hiringManager}},

I am excited to apply for the {{role}} role at {{company}}. {{referral}}

In my {{yearsExperience}} years as a {{currentRole}}, I have focused on {{keySkills}}. {{techTransfer}}

What I bring is a habit of learning quickly, solving problems carefully and working closely with others, skills that matter in any technology. {{workMode}}

{{visa}} {{availability}} {{relocation}}

I would love the opportunity to show what I can do. Thank you for your time and consideration.

Best regards,
{{yourName}}
{{yourEmail}} | {{yourPhone}}`,
  },
  {
    id: "graduate",
    name: "Graduate / entry level",
    summary: "Highlights projects and eagerness to learn.",
    body: `Dear {{hiringManager}},

I am writing to apply for the {{role}} position at {{company}}. {{referral}} As a {{currentRole}}, I have built a solid foundation in {{keySkills}}.

{{techTransfer}}

I am eager to learn from an experienced team and to take on real responsibility early. {{workMode}}

{{visa}} {{availability}} {{relocation}}

Thank you for reading my application. I look forward to hearing from you.

Yours sincerely,
{{yourName}}
{{yourEmail}} | {{yourPhone}}`,
  },
  {
    id: "short",
    name: "Short email",
    summary: "A brief note to paste into an email or application form.",
    body: `Hi {{hiringManager}},

I would like to apply for the {{role}} role at {{company}}. {{referral}} I have {{yearsExperience}} years of experience as a {{currentRole}}, with a focus on {{keySkills}}. {{techTransfer}}

{{visa}} {{availability}} {{relocation}} {{workMode}}

My CV is attached. Thank you for your time.

Best,
{{yourName}}`,
  },
];

/* ── letter rendering ─────────────────────────────────── */

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/**
 * Fills a template: ticked options become their sentence, unticked ones
 * vanish, and fields become their value, or [Label] while still empty.
 */
function renderLetter(
  body: string,
  options: LetterOption[],
  checked: Record<string, boolean>,
  values: Record<string, string>,
  labels: Record<string, string>,
) {
  const optionByKey = new Map(options.map((option) => [option.key, option]));
  const fillFields = (text: string) =>
    text.replace(PLACEHOLDER, (match, key: string) => {
      if (optionByKey.has(key)) return match;
      const value = values[key]?.trim();
      if (value) return value;
      return labels[key] ? `[${labels[key]}]` : match;
    });

  const withOptions = body.replace(PLACEHOLDER, (match, key: string) => {
    const option = optionByKey.get(key);
    if (!option) return match;
    return checked[key] ? fillFields(option.text.trim()) : "";
  });

  return fillFields(withOptions)
    .split("\n")
    // Close gaps left by empty options; a space before ".NET" stays.
    .map((line) =>
      line
        .replace(/[ \t]{2,}/g, " ")
        .replace(/ +([.,;:!?])(?=\s|$)/g, "$1")
        .trim(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ── saved state ──────────────────────────────────────── */

const STORAGE_KEY = "torensa_cover_letter_v1";

type SavedState = {
  templateId: string | null;
  bodies: Record<string, string>;
  values: Record<string, string>;
  checked: Record<string, boolean>;
  optionTexts: Record<string, string>;
  customOptions: LetterOption[];
};

const EMPTY_STATE: SavedState = {
  templateId: null,
  bodies: {},
  values: { targetTech: ".NET" },
  checked: {},
  optionTexts: {},
  customOptions: [],
};

function loadState(): SavedState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return saved && typeof saved === "object" ? { ...EMPTY_STATE, ...saved } : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

/* ── component ────────────────────────────────────────── */

const panelSx = {
  p: { xs: 1.5, sm: 2 },
  borderRadius: 2,
  border: "1px solid rgba(148,163,184,0.25)",
  bgcolor: "rgba(2,6,23,0.2)",
} as const;

export default function CoverLetterBuilder() {
  const [initial] = useState(loadState);
  const [templateId, setTemplateId] = useState<string | null>(initial.templateId);
  const [bodies, setBodies] = useState(initial.bodies);
  const [values, setValues] = useState(initial.values);
  const [checked, setChecked] = useState(initial.checked);
  const [optionTexts, setOptionTexts] = useState(initial.optionTexts);
  const [customOptions, setCustomOptions] = useState(initial.customOptions);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  // Cursor in the template text, once the user has placed it there.
  const cursorRef = useRef<{ start: number; end: number } | null>(null);
  const { error, success, setError, setSuccess, clear } = useToolStatus();

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ templateId, bodies, values, checked, optionTexts, customOptions }),
      );
    } catch {
      /* storage full or unavailable */
    }
  }, [templateId, bodies, values, checked, optionTexts, customOptions]);

  const template = TEMPLATES.find((entry) => entry.id === templateId) ?? null;
  const body = template ? (bodies[template.id] ?? template.body) : "";

  const options: LetterOption[] = useMemo(
    () => [
      ...DEFAULT_OPTIONS.map((option) => ({
        ...option,
        text: optionTexts[option.key] ?? option.text,
      })),
      ...customOptions,
    ],
    [optionTexts, customOptions],
  );

  const labels = useMemo(() => {
    const result: Record<string, string> = {};
    for (const field of DETAIL_FIELDS) result[field.key] = field.label;
    for (const option of DEFAULT_OPTIONS) {
      for (const field of option.fields ?? []) result[field.key] = field.label;
    }
    return result;
  }, []);

  const letter = useMemo(
    () => (template ? renderLetter(body, options, checked, values, labels) : ""),
    [template, body, options, checked, values, labels],
  );

  const setValue = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const setBody = (value: string) => {
    if (!template) return;
    setBodies((current) => ({ ...current, [template.id]: value }));
  };

  /**
   * Inserts {{key}} at the cursor in the template text. Before the user has
   * placed the cursor, it goes next to {{availability}}, where the other
   * short facts are, or at the end.
   */
  const insertPlaceholder = (key: string) => {
    const token = `{{${key}}}`;
    let start: number;
    let end: number;
    let text = token;
    if (cursorRef.current) {
      ({ start, end } = cursorRef.current);
    } else {
      const anchor = body.indexOf("{{availability}}");
      start = end = anchor === -1 ? body.length : anchor + "{{availability}}".length;
      text = anchor === -1 ? `\n\n${token}` : ` ${token}`;
    }
    setBody(body.slice(0, start) + text + body.slice(end));
    const caret = start + text.length;
    cursorRef.current = { start: caret, end: caret };
    const area = bodyRef.current;
    if (area) {
      requestAnimationFrame(() => {
        area.focus();
        area.setSelectionRange(caret, caret);
      });
    }
  };

  const rememberCursor = () => {
    const area = bodyRef.current;
    if (area) cursorRef.current = { start: area.selectionStart, end: area.selectionEnd };
  };

  const setOptionText = (option: LetterOption, text: string) => {
    if (option.custom) {
      setCustomOptions((current) =>
        current.map((entry) => (entry.key === option.key ? { ...entry, text } : entry)),
      );
    } else {
      setOptionTexts((current) => ({ ...current, [option.key]: text }));
    }
  };

  const resetOptionText = (option: LetterOption) =>
    setOptionTexts((current) => {
      const next = { ...current };
      delete next[option.key];
      return next;
    });

  const addCustomOption = () => {
    const label = newOptionLabel.trim();
    if (!label) return;
    const base = label.replace(/[^A-Za-z0-9]+/g, " ").trim().split(" ").slice(0, 3);
    const stem =
      "custom" + base.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
    let key = stem;
    for (let n = 2; options.some((option) => option.key === key); n++) key = `${stem}${n}`;
    setCustomOptions((current) => [...current, { key, label, text: "", custom: true }]);
    setChecked((current) => ({ ...current, [key]: true }));
    setNewOptionLabel("");
    // Put the new placeholder where the cursor is, or at the end.
    insertPlaceholder(key);
  };

  const removeCustomOption = (key: string) => {
    setCustomOptions((current) => current.filter((option) => option.key !== key));
    setChecked((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const missingPlaceholders = options.filter(
    (option) => checked[option.key] && !body.includes(`{{${option.key}}}`),
  );

  const copyLetter = async () => {
    clear();
    try {
      await navigator.clipboard.writeText(letter);
      setSuccess("Cover letter copied to the clipboard.");
    } catch {
      setError("Could not copy. Select the text in the preview and copy it instead.");
    }
  };

  const downloadLetter = () => {
    const blob = new Blob([letter + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const company = (values.company ?? "").trim().replace(/[^A-Za-z0-9]+/g, "-");
    link.href = url;
    link.download = `cover-letter${company ? `-${company}` : ""}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printLetter = () => {
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Cover letter</title><style>
        body{font:12pt/1.55 Georgia,"Times New Roman",serif;margin:2.5cm;color:#000;white-space:pre-wrap}
      </style></head><body></body></html>`,
    );
    doc.close();
    doc.body.textContent = letter;
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  };

  /* ── step 1: choose a template ── */

  if (!template) {
    return (
      <PageContainer maxWidth={1000}>
        <Stack spacing={2}>
          <Typography variant="subtitle1" fontWeight={700}>
            Choose a template
          </Typography>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            }}
          >
            {TEMPLATES.map((entry) => (
              <Box
                key={entry.id}
                role="button"
                tabIndex={0}
                aria-label={`Use the ${entry.name} template`}
                onClick={() => setTemplateId(entry.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setTemplateId(entry.id);
                  }
                }}
                sx={{
                  ...panelSx,
                  cursor: "pointer",
                  transition: "border-color 0.15s, transform 0.15s",
                  "&:hover, &:focus-visible": {
                    borderColor: "primary.main",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Typography fontWeight={700}>{entry.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {entry.summary}
                </Typography>
                <Typography
                  component="pre"
                  variant="caption"
                  sx={{
                    m: 0,
                    maxHeight: 150,
                    overflow: "hidden",
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    opacity: 0.75,
                    maskImage: "linear-gradient(#000 60%, transparent)",
                  }}
                >
                  {entry.body}
                </Typography>
              </Box>
            ))}
          </Box>
        </Stack>
      </PageContainer>
    );
  }

  /* ── step 2: edit and fill ── */

  return (
    <PageContainer maxWidth={1200}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => {
              cursorRef.current = null;
              setTemplateId(null);
            }}
            sx={{ textTransform: "none" }}
          >
            Templates
          </Button>
          <Typography fontWeight={700} sx={{ flex: 1 }}>
            {template.name}
          </Typography>
        </Stack>

        <ToolStatusAlerts error={error} success={success} />

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr)" },
            alignItems: "start",
          }}
        >
          {/* ── left: inputs ── */}
          <Stack spacing={2}>
            <Box sx={panelSx}>
              <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
                Your details
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                }}
              >
                {DETAIL_FIELDS.map((field) => (
                  <TextField
                    key={field.key}
                    size="small"
                    label={field.label}
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ""}
                    onChange={(event) => setValue(field.key, event.target.value)}
                    multiline={field.multiline}
                    sx={field.multiline ? { gridColumn: "1 / -1" } : undefined}
                  />
                ))}
              </Box>
            </Box>

            <Box sx={panelSx}>
              <Typography variant="subtitle2" fontWeight={700}>
                Include in the letter
              </Typography>
              <Typography variant="caption" color="text.secondary" component="p" mb={1}>
                Ticking an option puts its sentence where its placeholder is in the template.
                You can edit each sentence.
              </Typography>
              <Stack spacing={1}>
                {options.map((option) => {
                  const isChecked = Boolean(checked[option.key]);
                  const edited =
                    !option.custom && optionTexts[option.key] !== undefined;
                  return (
                    <Box key={option.key}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <FormControlLabel
                          sx={{ flex: 1, mr: 0 }}
                          control={
                            <Checkbox
                              checked={isChecked}
                              onChange={(event) =>
                                setChecked((current) => ({
                                  ...current,
                                  [option.key]: event.target.checked,
                                }))
                              }
                            />
                          }
                          label={option.label}
                        />
                        <Tooltip title="Insert this placeholder at the cursor in the template">
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`{{${option.key}}}`}
                            onClick={() => insertPlaceholder(option.key)}
                            sx={{ fontFamily: "monospace", fontSize: 11 }}
                          />
                        </Tooltip>
                        {option.custom && (
                          <Tooltip title="Remove option">
                            <IconButton
                              size="small"
                              onClick={() => removeCustomOption(option.key)}
                              aria-label={`Remove ${option.label}`}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                      {isChecked && (
                        <Stack spacing={1} sx={{ pl: 4, pb: 1 }}>
                          {(option.fields ?? []).map((field) => (
                            <TextField
                              key={field.key}
                              size="small"
                              label={field.label}
                              placeholder={field.placeholder}
                              value={values[field.key] ?? ""}
                              onChange={(event) => setValue(field.key, event.target.value)}
                            />
                          ))}
                          <TextField
                            size="small"
                            multiline
                            minRows={2}
                            label="Sentence"
                            placeholder="Write the sentence to add"
                            value={option.text}
                            onChange={(event) => setOptionText(option, event.target.value)}
                          />
                          {edited && (
                            <Button
                              size="small"
                              startIcon={<RestartAltIcon />}
                              onClick={() => resetOptionText(option)}
                              sx={{ alignSelf: "flex-start", textTransform: "none" }}
                            >
                              Restore original sentence
                            </Button>
                          )}
                        </Stack>
                      )}
                    </Box>
                  );
                })}
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Add your own option"
                  placeholder="e.g. Security clearance"
                  value={newOptionLabel}
                  onChange={(event) => setNewOptionLabel(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addCustomOption()}
                />
                <IconButton
                  color="primary"
                  onClick={addCustomOption}
                  aria-label="Add option"
                  disabled={!newOptionLabel.trim()}
                >
                  <AddIcon />
                </IconButton>
              </Stack>
            </Box>

            <Box sx={panelSx}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
                  Template text
                </Typography>
                <Button
                  size="small"
                  startIcon={<RestartAltIcon />}
                  disabled={bodies[template.id] === undefined}
                  onClick={() => {
                    cursorRef.current = null;
                    setBodies((current) => {
                      const next = { ...current };
                      delete next[template.id];
                      return next;
                    });
                  }}
                  sx={{ textTransform: "none" }}
                >
                  Reset template
                </Button>
              </Stack>
              <TextField
                fullWidth
                multiline
                minRows={12}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onSelect={rememberCursor}
                inputRef={bodyRef}
                inputProps={{ "aria-label": "Template text", spellCheck: true }}
                sx={{ "& textarea": { fontSize: 14, lineHeight: 1.5 } }}
              />
              <Typography variant="caption" color="text.secondary" component="p" mt={1}>
                Edit freely. Text in {"{{double braces}}"} is replaced: your details, or the
                sentence of a ticked option. Your changes are saved in this browser.
              </Typography>
              {missingPlaceholders.length > 0 && (
                <Typography variant="caption" color="warning.main" component="p" mt={0.5}>
                  Not in the template, so not shown:{" "}
                  {missingPlaceholders.map((option) => option.label).join(", ")}. Click its
                  placeholder chip to insert it.
                </Typography>
              )}
            </Box>
          </Stack>

          {/* ── right: preview ── */}
          <Box sx={{ ...panelSx, position: { md: "sticky" }, top: { md: 16 } }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1.5} flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
                Preview
              </Typography>
              <ActionButton size="small" startIcon={<ContentCopyIcon />} onClick={() => void copyLetter()}>
                Copy
              </ActionButton>
              <TransparentButton
                size="small"
                label="Download .txt"
                startIcon={<DownloadIcon />}
                onClick={downloadLetter}
              />
              <TransparentButton
                size="small"
                label="Print / PDF"
                startIcon={<PrintIcon />}
                onClick={printLetter}
              />
            </Stack>
            <Box
              aria-label="Cover letter preview"
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 1,
                bgcolor: "#fff",
                color: "#111827",
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: 15,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                minHeight: 300,
              }}
            >
              {letter.split(/(\[[^\]\n]+\])/g).map((part, index) =>
                /^\[[^\]\n]+\]$/.test(part) ? (
                  <Box
                    component="mark"
                    key={index}
                    sx={{ bgcolor: "rgba(250,204,21,0.45)", color: "inherit", px: 0.25, borderRadius: 0.5 }}
                  >
                    {part}
                  </Box>
                ) : (
                  part
                ),
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" component="p" mt={1}>
              Highlighted [labels] are details you have not filled in yet.
            </Typography>
          </Box>
        </Box>
      </Stack>
    </PageContainer>
  );
}
