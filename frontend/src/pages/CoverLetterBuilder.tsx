import { useEffect, useMemo, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
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
import { apiFetch } from "../utils/api";
import { useAuth } from "../utils/auth";
import downloadBlob from "../utils/downloadBlob";

/* ── data ─────────────────────────────────────────────── */

/** A value typed once and used as {{key}} in templates and option sentences. */
type Field = {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
};

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
  {
    key: "role",
    label: "Job title",
    placeholder: "e.g. Senior .NET Developer",
  },
  {
    key: "hiringManager",
    label: "Hiring manager",
    placeholder: "e.g. Ms Smith, or Hiring Manager",
  },
  {
    key: "currentRole",
    label: "Your current role",
    placeholder: "e.g. Software Engineer",
  },
  {
    key: "yearsExperience",
    label: "Years of experience",
    placeholder: "e.g. 5",
  },
  {
    key: "keySkills",
    label: "Key skills or achievements",
    placeholder:
      "e.g. building REST APIs and cloud services used by 2 million people",
    multiline: true,
  },
];

/** Today's date as the browser writes it, e.g. "19 November 2026". */
function todayText() {
  return new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const DEFAULT_OPTIONS: LetterOption[] = [
  {
    key: "date",
    label: "Date",
    text: "{{letterDate}}",
    fields: [
      {
        key: "letterDate",
        label: "Date (leave empty for today)",
        placeholder: todayText(),
      },
    ],
  },
  {
    key: "techTransfer",
    label: "Different tech stack (e.g. .NET job)",
    text: "Although most of my recent work has been in {{currentStack}} rather than {{targetTech}}, the fundamentals of software engineering carry over directly. Today, AI-assisted coding tools make it much faster to pick up a new language and its ecosystem, so I am confident I can transfer my skills quickly and become productive in {{targetTech}} early on.",
    fields: [
      {
        key: "targetTech",
        label: "Job's technology",
        placeholder: "e.g. .NET",
      },
      {
        key: "currentStack",
        label: "Your current stack",
        placeholder: "e.g. Java and Python",
      },
    ],
  },
  {
    key: "visa",
    label: "Visa status",
    text: "I hold {{visaStatus}}, which gives me the right to work in {{workCountry}} without sponsorship.",
    fields: [
      {
        key: "visaStatus",
        label: "Visa status",
        placeholder: "e.g. a Graduate visa valid until 2028",
      },
      { key: "workCountry", label: "Country", placeholder: "e.g. the UK" },
    ],
  },
  {
    key: "availability",
    label: "Availability / notice period",
    text: "I am available to start {{startDate}}.",
    fields: [
      {
        key: "startDate",
        label: "Start date",
        placeholder: "e.g. immediately, or after a one-month notice period",
      },
    ],
  },
  {
    key: "relocation",
    label: "Open to relocation",
    text: "I would be happy to relocate to {{location}} for this role.",
    fields: [
      { key: "location", label: "Location", placeholder: "e.g. London" },
    ],
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
    fields: [
      {
        key: "referrer",
        label: "Referred by",
        placeholder: "e.g. Jane Doe, a developer on your team",
      },
    ],
  },
];

const TEMPLATES: Template[] = [
  {
    id: "professional",
    name: "Professional",
    summary: "A classic four-paragraph letter for most applications.",
    body: `{{yourName}}
{{yourEmail}} | {{yourPhone}}

{{date}}

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
    body: `{{date}}

Dear {{hiringManager}},

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
    body: `{{date}}

Dear {{hiringManager}},

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
  {
    id: "own",
    name: "Your own letter",
    summary:
      "Start from your existing letter: import a .docx or paste the text.",
    body: "",
  },
];

const MAX_JOB_DESCRIPTION_CHARS = 12000;
const DOCX_ACCEPT =
  ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Reads an error message from a failed API response. */
async function errorFrom(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return (
    (data && typeof data.error === "string" && data.error) ||
    `${fallback} (${response.status})`
  );
}

type SavedSummary = { id: number; title: string; updatedAt: string };

/** A template the user saved: in their account, or in this browser. */
type MyTemplate = {
  id: string;
  name: string;
  body: string;
  source: "account" | "browser";
  serverId?: number;
};

const LOCAL_TEMPLATES_KEY = "torensa_cover_letter_templates_v1";

function loadBrowserTemplates(): MyTemplate[] {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_TEMPLATES_KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

type ServerTemplate = { id: number; name: string; body: string };

const fromServer = (entry: ServerTemplate): MyTemplate => ({
  id: `acct-${entry.id}`,
  name: entry.name,
  body: entry.body,
  source: "account",
  serverId: entry.id,
});

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

  return (
    fillFields(withOptions)
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
      .trim()
  );
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
  jobDescription: string;
  /** The AI-tailored letter, if one was made. */
  tailored: string;
  /** Saved letter on the server that this draft belongs to. */
  savedId: number | null;
  savedTitle: string;
};

const EMPTY_STATE: SavedState = {
  templateId: null,
  bodies: {},
  values: { targetTech: ".NET" },
  checked: { date: true },
  optionTexts: {},
  customOptions: [],
  jobDescription: "",
  tailored: "",
  savedId: null,
  savedTitle: "",
};

function loadState(): SavedState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return saved && typeof saved === "object"
      ? { ...EMPTY_STATE, ...saved }
      : EMPTY_STATE;
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
  const [templateId, setTemplateId] = useState<string | null>(
    initial.templateId,
  );
  const [bodies, setBodies] = useState(initial.bodies);
  const [values, setValues] = useState(initial.values);
  const [checked, setChecked] = useState(initial.checked);
  const [optionTexts, setOptionTexts] = useState(initial.optionTexts);
  const [customOptions, setCustomOptions] = useState(initial.customOptions);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [jobDescription, setJobDescription] = useState(initial.jobDescription);
  const [tailored, setTailored] = useState(initial.tailored);
  const [view, setView] = useState<"letter" | "tailored">(
    initial.tailored ? "tailored" : "letter",
  );
  const [savedId, setSavedId] = useState<number | null>(initial.savedId);
  const [savedTitle, setSavedTitle] = useState(initial.savedTitle);
  const [savedLetters, setSavedLetters] = useState<SavedSummary[]>([]);
  const [accountTemplates, setAccountTemplates] = useState<MyTemplate[]>([]);
  const [browserTemplates, setBrowserTemplates] =
    useState<MyTemplate[]>(loadBrowserTemplates);
  const [templateName, setTemplateName] = useState("");
  const [busy, setBusy] = useState<
    "" | "tailor" | "import" | "save" | "docx" | "template"
  >("");
  const importRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  // Cursor in the template text, once the user has placed it there.
  const cursorRef = useRef<{ start: number; end: number } | null>(null);
  const { error, success, setError, setSuccess, clear } = useToolStatus();

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          templateId,
          bodies,
          values,
          checked,
          optionTexts,
          customOptions,
          jobDescription,
          tailored,
          savedId,
          savedTitle,
        }),
      );
    } catch {
      /* storage full or unavailable */
    }
  }, [
    templateId,
    bodies,
    values,
    checked,
    optionTexts,
    customOptions,
    jobDescription,
    tailored,
    savedId,
    savedTitle,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(
        LOCAL_TEMPLATES_KEY,
        JSON.stringify(browserTemplates),
      );
    } catch {
      /* storage full or unavailable */
    }
  }, [browserTemplates]);

  // Logged-in users' saved letters and templates.
  useEffect(() => {
    if (!user) {
      setSavedLetters([]);
      setAccountTemplates([]);
      return;
    }
    let cancelled = false;
    apiFetch("/api/cover-letters/")
      .then((response) => (response.ok ? response.json() : []))
      .then((letters: SavedSummary[]) => {
        if (!cancelled) setSavedLetters(letters);
      })
      .catch(() => undefined);
    apiFetch("/api/cover-letter-templates/")
      .then((response) => (response.ok ? response.json() : []))
      .then((entries: ServerTemplate[]) => {
        if (!cancelled) setAccountTemplates(entries.map(fromServer));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const myTemplates = useMemo(
    () => [...accountTemplates, ...browserTemplates],
    [accountTemplates, browserTemplates],
  );
  const allTemplates: Template[] = useMemo(
    () => [
      ...TEMPLATES,
      ...myTemplates.map((entry) => ({
        id: entry.id,
        name: entry.name,
        summary:
          entry.source === "account"
            ? "Your template, saved in your account."
            : "Your template, saved in this browser.",
        body: entry.body,
      })),
    ],
    [myTemplates],
  );

  const template =
    allTemplates.find((entry) => entry.id === templateId) ?? null;
  const myTemplate =
    myTemplates.find((entry) => entry.id === templateId) ?? null;
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

  const letter = useMemo(() => {
    if (!template) return "";
    // An empty date means today.
    const filled = {
      ...values,
      letterDate: values.letterDate?.trim() || todayText(),
    };
    return renderLetter(body, options, checked, filled, labels);
  }, [template, body, options, checked, values, labels]);

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
      start = end =
        anchor === -1 ? body.length : anchor + "{{availability}}".length;
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
    if (area)
      cursorRef.current = {
        start: area.selectionStart,
        end: area.selectionEnd,
      };
  };

  const setOptionText = (option: LetterOption, text: string) => {
    if (option.custom) {
      setCustomOptions((current) =>
        current.map((entry) =>
          entry.key === option.key ? { ...entry, text } : entry,
        ),
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
    const base = label
      .replace(/[^A-Za-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 3);
    const stem =
      "custom" +
      base
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join("");
    let key = stem;
    for (let n = 2; options.some((option) => option.key === key); n++)
      key = `${stem}${n}`;
    setCustomOptions((current) => [
      ...current,
      { key, label, text: "", custom: true },
    ]);
    setChecked((current) => ({ ...current, [key]: true }));
    setNewOptionLabel("");
    // Put the new placeholder where the cursor is, or at the end.
    insertPlaceholder(key);
  };

  const removeCustomOption = (key: string) => {
    setCustomOptions((current) =>
      current.filter((option) => option.key !== key),
    );
    setChecked((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const missingPlaceholders = options.filter(
    (option) => checked[option.key] && !body.includes(`{{${option.key}}}`),
  );

  // The version the preview shows, which copy, download, print and save use.
  const showingTailored = view === "tailored" && Boolean(tailored);
  const output = showingTailored ? tailored : letter;

  const defaultTitle = () => {
    const parts = [values.company, values.role]
      .map((part) => (part ?? "").trim())
      .filter(Boolean);
    return parts.length ? parts.join(" - ") : "Cover letter";
  };

  const tailorWithAi = async () => {
    clear();
    if (!letter.trim()) {
      setError("Write your letter first, then tailor it.");
      return;
    }
    setBusy("tailor");
    try {
      const response = await apiFetch("/ai/cover-letter-tailor/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverLetter: letter,
          jobDescription: jobDescription.trim(),
        }),
      });
      if (!response.ok)
        throw new Error(
          await errorFrom(response, "Could not tailor the letter"),
        );
      const data = await response.json();
      setTailored(data.coverLetter);
      setView("tailored");
      setSuccess(
        "Tailored to the job description. Review and edit it before sending.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not tailor the letter.",
      );
    } finally {
      setBusy("");
    }
  };

  /** Replaces the template text with the text of a .docx letter. */
  const importDocx = async (file: File | undefined) => {
    if (!file) return;
    clear();
    setBusy("import");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await apiFetch("/ai/cover-letter-tailor/", {
        method: "POST",
        body: form,
      });
      if (!response.ok)
        throw new Error(await errorFrom(response, "Could not open the file"));
      const data = await response.json();
      cursorRef.current = null;
      setBody(data.coverLetter);
      setView("letter");
      setSuccess(
        `Imported ${file.name}. Add {{placeholders}} or tick options to reuse it.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the file.");
    } finally {
      setBusy("");
      if (importRef.current) importRef.current.value = "";
    }
  };

  const saveLetter = async () => {
    clear();
    if (!template) return;
    const title = savedTitle.trim() || defaultTitle();
    setBusy("save");
    try {
      const payload = {
        title,
        content: output,
        state: {
          templateId: template.id,
          body,
          values,
          checked,
          optionTexts,
          customOptions,
          jobDescription,
          tailored,
          view,
        },
      };
      const response = await apiFetch(
        savedId ? `/api/cover-letters/${savedId}/` : "/api/cover-letters/",
        {
          method: savedId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok)
        throw new Error(await errorFrom(response, "Could not save the letter"));
      const saved: SavedSummary = await response.json();
      setSavedId(saved.id);
      setSavedTitle(saved.title);
      setSavedLetters((current) => [
        { id: saved.id, title: saved.title, updatedAt: saved.updatedAt },
        ...current.filter((entry) => entry.id !== saved.id),
      ]);
      setSuccess(`Saved "${saved.title}" to your account.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the letter.",
      );
    } finally {
      setBusy("");
    }
  };

  const openSaved = async (id: number) => {
    clear();
    try {
      const response = await apiFetch(`/api/cover-letters/${id}/`);
      if (!response.ok)
        throw new Error(await errorFrom(response, "Could not open the letter"));
      const data = await response.json();
      const state = (data.state ?? {}) as Record<string, unknown>;
      const id_ =
        typeof state.templateId === "string" &&
        allTemplates.some((t) => t.id === state.templateId)
          ? state.templateId
          : "own";
      cursorRef.current = null;
      setTemplateId(id_);
      setBodies((current) => ({
        ...current,
        [id_]: typeof state.body === "string" ? state.body : data.content,
      }));
      setValues((state.values as Record<string, string>) ?? {});
      setChecked((state.checked as Record<string, boolean>) ?? {});
      setOptionTexts((state.optionTexts as Record<string, string>) ?? {});
      setCustomOptions((state.customOptions as LetterOption[]) ?? []);
      setJobDescription(
        typeof state.jobDescription === "string" ? state.jobDescription : "",
      );
      const savedTailored =
        typeof state.tailored === "string" ? state.tailored : "";
      setTailored(savedTailored);
      setView(savedTailored && state.view !== "letter" ? "tailored" : "letter");
      setSavedId(data.id);
      setSavedTitle(data.title);
      setSuccess(`Opened "${data.title}".`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not open the letter.",
      );
    }
  };

  const deleteSaved = async (entry: SavedSummary) => {
    if (!window.confirm(`Delete "${entry.title}" from your account?`)) return;
    clear();
    const response = await apiFetch(`/api/cover-letters/${entry.id}/`, {
      method: "DELETE",
    }).catch(() => null);
    if (!response?.ok) {
      setError("Could not delete the letter.");
      return;
    }
    setSavedLetters((current) =>
      current.filter((item) => item.id !== entry.id),
    );
    if (savedId === entry.id) setSavedId(null);
  };

  /** Starts a fresh letter that is not linked to a saved one. */
  const startNew = () => {
    cursorRef.current = null;
    setSavedId(null);
    setSavedTitle("");
    setTailored("");
    setJobDescription("");
    setView("letter");
    setTemplateId(null);
  };

  const downloadDocx = async () => {
    clear();
    setBusy("docx");
    try {
      const response = await apiFetch("/api/cover-letters/docx/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: output }),
      });
      if (!response.ok)
        throw new Error(
          await errorFrom(response, "Could not create the Word file"),
        );
      downloadBlob(await response.blob(), `${fileStem()}.docx`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the Word file.",
      );
    } finally {
      setBusy("");
    }
  };

  const fileStem = () => {
    const company = (values.company ?? "")
      .trim()
      .replace(/[^A-Za-z0-9]+/g, "-");
    return `cover-letter${company ? `-${company}` : ""}`;
  };

  const copyLetter = async () => {
    clear();
    try {
      await navigator.clipboard.writeText(output);
      setSuccess("Cover letter copied to the clipboard.");
    } catch {
      setError(
        "Could not copy. Select the text in the preview and copy it instead.",
      );
    }
  };

  const downloadLetter = () => {
    downloadBlob(
      new Blob([output + "\n"], { type: "text/plain;charset=utf-8" }),
      `${fileStem()}.txt`,
    );
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
    doc.body.textContent = output;
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  };

  const savedPanel = user ? (
    <Box sx={panelSx}>
      <Typography variant="subtitle2" fontWeight={700} mb={1}>
        My saved letters
      </Typography>
      {savedLetters.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nothing saved yet. Use "Save" next to the preview to keep a letter in
          your account.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {savedLetters.map((entry) => (
            <Stack
              key={entry.id}
              direction="row"
              alignItems="center"
              spacing={1}
            >
              <FolderOpenOutlinedIcon fontSize="small" color="primary" />
              <Button
                onClick={() => void openSaved(entry.id)}
                sx={{
                  textTransform: "none",
                  flex: 1,
                  justifyContent: "flex-start",
                  minWidth: 0,
                }}
                aria-label={`Open ${entry.title}`}
              >
                <Typography
                  noWrap
                  fontWeight={savedId === entry.id ? 700 : 400}
                >
                  {entry.title}
                </Typography>
              </Button>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ whiteSpace: "nowrap" }}
              >
                {new Date(entry.updatedAt).toLocaleDateString()}
              </Typography>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={() => void deleteSaved(entry)}
                  aria-label={`Delete ${entry.title}`}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  ) : (
    <Typography variant="body2" color="text.secondary">
      <a
        href="/login?redirect=/cover-letter-builder"
        style={{ color: "inherit" }}
      >
        Log in
      </a>{" "}
      to save cover letters to your account and open them later.
    </Typography>
  );

  /**
   * Saves the current template text as a new template, or with `update`
   * over the user's template being edited. Templates go to the account
   * when logged in, otherwise to this browser.
   */
  const saveTemplate = async (update: boolean) => {
    if (!template) return;
    clear();
    if (!body.trim()) {
      setError("The template is empty.");
      return;
    }
    const target = update ? myTemplate : null;
    const name =
      templateName.trim() ||
      target?.name ||
      (myTemplate ? `${template.name} (copy)` : `My ${template.name} template`);
    setBusy("template");
    try {
      let saved: MyTemplate;
      if (target?.source === "browser" || (!target && !user)) {
        saved = {
          id: target?.id ?? `local-${Date.now()}`,
          name,
          body,
          source: "browser",
        };
        setBrowserTemplates((current) =>
          target
            ? current.map((entry) => (entry.id === target.id ? saved : entry))
            : [...current, saved],
        );
      } else {
        const response = await apiFetch(
          target
            ? `/api/cover-letter-templates/${target.serverId}/`
            : "/api/cover-letter-templates/",
          {
            method: target ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, body }),
          },
        );
        if (!response.ok)
          throw new Error(
            await errorFrom(response, "Could not save the template"),
          );
        saved = fromServer(await response.json());
        setAccountTemplates((current) =>
          target
            ? current.map((entry) => (entry.id === target.id ? saved : entry))
            : [...current, saved],
        );
      }
      // The saved template now holds these edits, so the template that was
      // being edited goes back to its saved text and the new one opens.
      setBodies((current) => {
        const next = { ...current };
        delete next[template.id];
        delete next[saved.id];
        return next;
      });
      cursorRef.current = null;
      setTemplateId(saved.id);
      setTemplateName("");
      setSuccess(
        `${update ? "Updated" : "Saved"} the template "${saved.name}"${
          saved.source === "browser" ? " in this browser" : " to your account"
        }.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the template.",
      );
    } finally {
      setBusy("");
    }
  };

  const deleteTemplate = async (entry: MyTemplate) => {
    if (!window.confirm(`Delete the template "${entry.name}"?`)) return;
    clear();
    if (entry.source === "account") {
      const response = await apiFetch(
        `/api/cover-letter-templates/${entry.serverId}/`,
        { method: "DELETE" },
      ).catch(() => null);
      if (!response?.ok) {
        setError("Could not delete the template.");
        return;
      }
      setAccountTemplates((current) =>
        current.filter((item) => item.id !== entry.id),
      );
    } else {
      setBrowserTemplates((current) =>
        current.filter((item) => item.id !== entry.id),
      );
    }
    setBodies((current) => {
      const next = { ...current };
      delete next[entry.id];
      return next;
    });
  };

  const templateCard = (entry: Template, mine?: MyTemplate) => (
    <Box
      key={entry.id}
      role="button"
      tabIndex={0}
      aria-label={`Use the ${entry.name} template`}
      onClick={() => setTemplateId(entry.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setTemplateId(entry.id);
        }
      }}
      sx={{
        ...panelSx,
        position: "relative",
        cursor: "pointer",
        transition: "border-color 0.15s, transform 0.15s",
        "&:hover, &:focus-visible": {
          borderColor: "primary.main",
          transform: "translateY(-2px)",
        },
      }}
    >
      {mine && (
        <Tooltip title="Delete template">
          <IconButton
            size="small"
            aria-label={`Delete the ${entry.name} template`}
            onClick={(event) => {
              event.stopPropagation();
              void deleteTemplate(mine);
            }}
            sx={{ position: "absolute", top: 8, right: 8 }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Typography fontWeight={700} sx={{ pr: mine ? 4 : 0 }}>
        {entry.name}
      </Typography>
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
        {entry.body ||
          "Import a .docx cover letter or paste your text, then tailor it to a job with AI."}
      </Typography>
    </Box>
  );

  const gridSx = {
    display: "grid",
    gap: 2,
    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
  } as const;

  /* ── step 1: choose a template ── */

  if (!template) {
    return (
      <PageContainer maxWidth={1000}>
        <Stack spacing={2}>
          {savedPanel}
          {myTemplates.length > 0 && (
            <>
              <Typography variant="subtitle1" fontWeight={700}>
                My templates
              </Typography>
              <Box sx={gridSx}>
                {myTemplates.map((mine) =>
                  templateCard(
                    allTemplates.find((entry) => entry.id === mine.id)!,
                    mine,
                  ),
                )}
              </Box>
            </>
          )}
          <Typography variant="subtitle1" fontWeight={700}>
            {myTemplates.length > 0
              ? "Built-in templates"
              : "Choose a template"}
          </Typography>
          <Box sx={gridSx}>{TEMPLATES.map((entry) => templateCard(entry))}</Box>
        </Stack>
      </PageContainer>
    );
  }

  /* ── step 2: edit and fill ── */

  return (
    <PageContainer maxWidth={1200}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={startNew}
            sx={{ textTransform: "none" }}
          >
            New letter
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
            gridTemplateColumns: {
              xs: "1fr",
              md: "minmax(0, 1fr) minmax(0, 1fr)",
            },
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
                    onChange={(event) =>
                      setValue(field.key, event.target.value)
                    }
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
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                mb={1}
              >
                Ticking an option puts its sentence where its placeholder is in
                the template. You can edit each sentence.
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
                              onChange={(event) =>
                                setValue(field.key, event.target.value)
                              }
                            />
                          ))}
                          <TextField
                            size="small"
                            multiline
                            minRows={2}
                            label="Sentence"
                            placeholder="Write the sentence to add"
                            value={option.text}
                            onChange={(event) =>
                              setOptionText(option, event.target.value)
                            }
                          />
                          {edited && (
                            <Button
                              size="small"
                              startIcon={<RestartAltIcon />}
                              onClick={() => resetOptionText(option)}
                              sx={{
                                alignSelf: "flex-start",
                                textTransform: "none",
                              }}
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
                  onKeyDown={(event) =>
                    event.key === "Enter" && addCustomOption()
                  }
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
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{ flex: 1 }}
                >
                  Template text
                </Typography>
                <input
                  ref={importRef}
                  type="file"
                  accept={DOCX_ACCEPT}
                  hidden
                  onChange={(event) => void importDocx(event.target.files?.[0])}
                />
                <Button
                  size="small"
                  startIcon={<UploadFileIcon />}
                  disabled={busy !== ""}
                  onClick={() => importRef.current?.click()}
                  sx={{ textTransform: "none" }}
                >
                  Import .docx
                </Button>
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
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                mt={1}
              >
                Edit freely. Text in {"{{double braces}}"} is replaced: your
                details, or the sentence of a ticked option. Your changes are
                saved in this browser.
              </Typography>
              {missingPlaceholders.length > 0 && (
                <Typography
                  variant="caption"
                  color="warning.main"
                  component="p"
                  mt={0.5}
                >
                  Not in the template, so not shown:{" "}
                  {missingPlaceholders.map((option) => option.label).join(", ")}
                  . Click its placeholder chip to insert it.
                </Typography>
              )}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                mt={1.5}
                alignItems={{ sm: "center" }}
              >
                <TextField
                  size="small"
                  fullWidth
                  label="Template name"
                  placeholder={
                    myTemplate?.name ?? `My ${template.name} template`
                  }
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  inputProps={{ maxLength: 100 }}
                />
                {myTemplate && (
                  <ActionButton
                    size="small"
                    startIcon={<SaveOutlinedIcon />}
                    loading={busy === "template"}
                    disabled={busy !== ""}
                    onClick={() => void saveTemplate(true)}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    Update template
                  </ActionButton>
                )}
                <TransparentButton
                  size="small"
                  label={myTemplate ? "Save as new" : "Save as template"}
                  startIcon={<BookmarkAddOutlinedIcon />}
                  disabled={busy !== ""}
                  onClick={() => void saveTemplate(false)}
                  sx={{ whiteSpace: "nowrap" }}
                />
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                mt={0.5}
              >
                {user
                  ? "Saved templates are kept in your account and listed under My templates."
                  : "Saved templates are kept in this browser. Log in to keep them in your account."}
              </Typography>
            </Box>

            <Box sx={panelSx}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <AutoAwesomeIcon fontSize="small" color="primary" />
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{ flex: 1 }}
                >
                  Tailor to a job description (AI)
                </Typography>
                <Typography
                  variant="caption"
                  color={
                    jobDescription.length > MAX_JOB_DESCRIPTION_CHARS
                      ? "error.main"
                      : "text.disabled"
                  }
                >
                  {jobDescription.length}/{MAX_JOB_DESCRIPTION_CHARS}
                </Typography>
              </Stack>
              <TextField
                fullWidth
                multiline
                minRows={5}
                maxRows={14}
                placeholder="Paste the job description. AI rewrites your letter to highlight your most relevant skills, without inventing experience."
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                inputProps={{ "aria-label": "Job description" }}
              />
              <ActionButton
                sx={{ mt: 1.5 }}
                startIcon={<AutoAwesomeIcon />}
                loading={busy === "tailor"}
                disabled={
                  busy !== "" ||
                  !jobDescription.trim() ||
                  jobDescription.length > MAX_JOB_DESCRIPTION_CHARS
                }
                onClick={() => void tailorWithAi()}
              >
                {tailored ? "Tailor again" : "Tailor with AI"}
              </ActionButton>
              {busy === "tailor" && (
                <LinearProgress
                  sx={{ mt: 1.5 }}
                  aria-label="Tailoring the letter"
                />
              )}
            </Box>
          </Stack>

          {/* ── right: preview ── */}
          <Box sx={{ ...panelSx, position: { md: "sticky" }, top: { md: 16 } }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              mb={1.5}
              flexWrap="wrap"
              useFlexGap
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
                Preview
              </Typography>
              {tailored && (
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={showingTailored ? "tailored" : "letter"}
                  onChange={(_event, value) => value && setView(value)}
                  aria-label="Letter version"
                >
                  <ToggleButton value="letter" sx={{ textTransform: "none" }}>
                    Your letter
                  </ToggleButton>
                  <ToggleButton value="tailored" sx={{ textTransform: "none" }}>
                    AI tailored
                  </ToggleButton>
                </ToggleButtonGroup>
              )}
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              mb={1.5}
              flexWrap="wrap"
              useFlexGap
            >
              <ActionButton
                size="small"
                startIcon={<ContentCopyIcon />}
                onClick={() => void copyLetter()}
              >
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
                label="Download .docx"
                startIcon={<DownloadIcon />}
                disabled={busy !== ""}
                onClick={() => void downloadDocx()}
              />
              <TransparentButton
                size="small"
                label="Print / PDF"
                startIcon={<PrintIcon />}
                onClick={printLetter}
              />
            </Stack>
            {user ? (
              <Stack direction="row" spacing={1} mb={1.5}>
                <TextField
                  size="small"
                  fullWidth
                  label={savedId ? "Saved as" : "Save as"}
                  placeholder={defaultTitle()}
                  value={savedTitle}
                  onChange={(event) => setSavedTitle(event.target.value)}
                />
                <ActionButton
                  size="small"
                  startIcon={<BookmarkAddOutlinedIcon />}
                  loading={busy === "save"}
                  disabled={busy !== "" || !output.trim()}
                  onClick={() => void saveLetter()}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {savedId ? "Update" : "Save"}
                </ActionButton>
              </Stack>
            ) : (
              <Box mb={1.5}>{savedPanel}</Box>
            )}
            {showingTailored ? (
              <TextField
                fullWidth
                multiline
                minRows={18}
                value={tailored}
                onChange={(event) => setTailored(event.target.value)}
                inputProps={{ "aria-label": "AI tailored letter" }}
                sx={{
                  "& .MuiInputBase-root": {
                    bgcolor: "#fff",
                    color: "#111827",
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontSize: 15,
                    lineHeight: 1.6,
                  },
                }}
              />
            ) : (
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
                      sx={{
                        bgcolor: "rgba(250,204,21,0.45)",
                        color: "inherit",
                        px: 0.25,
                        borderRadius: 0.5,
                      }}
                    >
                      {part}
                    </Box>
                  ) : (
                    part
                  ),
                )}
              </Box>
            )}
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              mt={1}
            >
              {showingTailored
                ? "The AI version is editable. Changes to your details or options update 'Your letter'; tailor again to refresh this version."
                : "Highlighted [labels] are details you have not filled in yet."}
            </Typography>
            {user && <Box mt={2}>{savedPanel}</Box>}
          </Box>
        </Box>
      </Stack>
    </PageContainer>
  );
}
