import React, { useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import { useTheme } from "@mui/material/styles";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";

import PageContainer from "../components/PageContainer";
import { ActionButton } from "../components/buttons/ActionButton";
import { TransparentButton } from "../components/buttons/TransparentButton";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import useToolStatus from "../hooks/useToolStatus";
import downloadBlob from "../utils/downloadBlob";

/* ===================== TYPES ===================== */

type Experience = {
  id: string;
  jobTitle: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
};

type Education = {
  id: string;
  degree: string;
  institution: string;
  startDate: string;
  endDate: string;
  details: string;
};

type ResumeData = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  summary: string;
  experiences: Experience[];
  educations: Education[];
  skills: string;
  template: "professional" | "modern" | "minimal";
};

/* ===================== CONSTANTS ===================== */

const STORAGE_KEY = "torensa_resume_builder_v1";
const makeId = () => crypto.randomUUID();

const TEMPLATES = [
  { value: "professional", label: "Professional" },
  { value: "modern", label: "Modern" },
  { value: "minimal", label: "Minimal" },
] as const;

/* ===================== HELPERS ===================== */

function defaultExperience(): Experience {
  return {
    id: makeId(),
    jobTitle: "",
    company: "",
    startDate: "",
    endDate: "",
    description: "",
  };
}

function defaultEducation(): Education {
  return {
    id: makeId(),
    degree: "",
    institution: "",
    startDate: "",
    endDate: "",
    details: "",
  };
}

function defaultResume(): ResumeData {
  return {
    fullName: "",
    email: "",
    phone: "",
    location: "",
    website: "",
    summary: "",
    experiences: [defaultExperience()],
    educations: [defaultEducation()],
    skills: "",
    template: "professional",
  };
}

function loadState(): ResumeData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultResume(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultResume();
}

function saveState(data: ResumeData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/* ===================== PDF GENERATION ===================== */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

type FontSet = {
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  italic: Awaited<ReturnType<PDFDocument["embedFont"]>>;
};

function wrapText(text: string, font: FontSet["regular"], fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

async function generatePdf(data: ResumeData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts: FontSet = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const drawText = (text: string, font: FontSet["regular"], size: number, color = rgb(0.15, 0.15, 0.15)) => {
    const lines = wrapText(text, font, size, CONTENT_W);
    for (const line of lines) {
      ensureSpace(size + 4);
      page.drawText(line, { x: MARGIN, y, size, font, color });
      y -= size + 4;
    }
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(30);
    y -= 8;

    const isProfessional = data.template === "professional";
    const isModern = data.template === "modern";

    if (isProfessional || isModern) {
      const lineColor = isProfessional ? rgb(0.2, 0.35, 0.6) : rgb(0.1, 0.1, 0.1);
      page.drawLine({
        start: { x: MARGIN, y: y - 2 },
        end: { x: PAGE_W - MARGIN, y: y - 2 },
        thickness: 0.75,
        color: lineColor,
      });
    }

    const titleColor = data.template === "professional" ? rgb(0.2, 0.35, 0.6) : rgb(0.1, 0.1, 0.1);
    page.drawText(title.toUpperCase(), { x: MARGIN, y: y - 16, size: 11, font: fonts.bold, color: titleColor });
    y -= 30;
  };

  /* ── Header ── */
  const nameSize = data.template === "modern" ? 22 : 20;
  ensureSpace(nameSize + 20);
  page.drawText(data.fullName || "Your Name", {
    x: MARGIN,
    y,
    size: nameSize,
    font: fonts.bold,
    color: data.template === "professional" ? rgb(0.2, 0.35, 0.6) : rgb(0.1, 0.1, 0.1),
  });
  y -= nameSize + 6;

  const contactParts = [data.email, data.phone, data.location, data.website].filter(Boolean);
  if (contactParts.length) {
    const contactStr = contactParts.join("  |  ");
    drawText(contactStr, fonts.regular, 9, rgb(0.4, 0.4, 0.4));
  }
  y -= 4;

  /* ── Summary ── */
  if (data.summary.trim()) {
    drawSectionTitle("Professional Summary");
    drawText(data.summary, fonts.regular, 10);
  }

  /* ── Experience ── */
  const validExp = data.experiences.filter((e) => e.jobTitle || e.company);
  if (validExp.length) {
    drawSectionTitle("Work Experience");
    for (const exp of validExp) {
      ensureSpace(40);
      page.drawText(exp.jobTitle || "Job Title", { x: MARGIN, y, size: 11, font: fonts.bold, color: rgb(0.15, 0.15, 0.15) });
      y -= 14;

      const dateStr = [exp.startDate, exp.endDate].filter(Boolean).join(" – ") || "";
      const companyLine = [exp.company, dateStr].filter(Boolean).join("  •  ");
      if (companyLine) {
        page.drawText(companyLine, { x: MARGIN, y, size: 9, font: fonts.italic, color: rgb(0.4, 0.4, 0.4) });
        y -= 14;
      }

      if (exp.description.trim()) {
        drawText(exp.description, fonts.regular, 10);
      }
      y -= 6;
    }
  }

  /* ── Education ── */
  const validEdu = data.educations.filter((e) => e.degree || e.institution);
  if (validEdu.length) {
    drawSectionTitle("Education");
    for (const edu of validEdu) {
      ensureSpace(40);
      page.drawText(edu.degree || "Degree", { x: MARGIN, y, size: 11, font: fonts.bold, color: rgb(0.15, 0.15, 0.15) });
      y -= 14;

      const dateStr = [edu.startDate, edu.endDate].filter(Boolean).join(" – ") || "";
      const instLine = [edu.institution, dateStr].filter(Boolean).join("  •  ");
      if (instLine) {
        page.drawText(instLine, { x: MARGIN, y, size: 9, font: fonts.italic, color: rgb(0.4, 0.4, 0.4) });
        y -= 14;
      }

      if (edu.details.trim()) {
        drawText(edu.details, fonts.regular, 10);
      }
      y -= 6;
    }
  }

  /* ── Skills ── */
  if (data.skills.trim()) {
    drawSectionTitle("Skills");
    drawText(data.skills, fonts.regular, 10);
  }

  return doc.save();
}

/* ===================== COMPONENT ===================== */

const ResumeBuilder: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { error, success, setError, setSuccess, clear } = useToolStatus();

  const [data, setData] = useState<ResumeData>(loadState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  const update = <K extends keyof ResumeData>(key: K, value: ResumeData[K]) => {
    setData((prev) => {
      const next = { ...prev, [key]: value };
      saveState(next);
      return next;
    });
  };

  const updateExperience = (id: string, field: keyof Experience, value: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        experiences: prev.experiences.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
      };
      saveState(next);
      return next;
    });
  };

  const updateEducation = (id: string, field: keyof Education, value: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        educations: prev.educations.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
      };
      saveState(next);
      return next;
    });
  };

  const addExperience = () => update("experiences", [...data.experiences, defaultExperience()]);
  const removeExperience = (id: string) => {
    if (data.experiences.length <= 1) return;
    update("experiences", data.experiences.filter((e) => e.id !== id));
  };

  const addEducation = () => update("educations", [...data.educations, defaultEducation()]);
  const removeEducation = (id: string) => {
    if (data.educations.length <= 1) return;
    update("educations", data.educations.filter((e) => e.id !== id));
  };

  const handleDownload = async () => {
    clear();
    if (!data.fullName.trim()) {
      setError("Please enter your full name before downloading.");
      return;
    }
    try {
      const pdfBytes = await generatePdf(data);
      const blob = new Blob([pdfBytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
      const fileName = `${data.fullName.replace(/\s+/g, "_")}_Resume.pdf`;
      downloadBlob(blob, fileName);
      setSuccess("Resume downloaded successfully!");
    } catch (err) {
      setError("Failed to generate PDF. Please try again.");
    }
  };

  const handlePreview = async () => {
    clear();
    try {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      const pdfBytes = await generatePdf(data);
      const blob = new Blob([pdfBytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      previewRef.current = url;
      setPreviewUrl(url);
    } catch {
      setError("Failed to generate preview.");
    }
  };

  const handleReset = () => {
    const fresh = defaultResume();
    setData(fresh);
    saveState(fresh);
    setPreviewUrl(null);
    clear();
  };

  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const borderColor = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";

  const sectionBox = {
    border: `1px solid ${borderColor}`,
    borderRadius: 2,
    backgroundColor: cardBg,
    p: { xs: 2, sm: 3 },
  };

  return (
    <PageContainer maxWidth={800}>
      <ToolStatusAlerts error={error} success={success} />

      <Stack spacing={3}>
        {/* Template selector */}
        <TextField
          select
          fullWidth
          label="Resume Template"
          value={data.template}
          onChange={(e) => update("template", e.target.value as ResumeData["template"])}
        >
          {TEMPLATES.map((t) => (
            <MenuItem key={t.value} value={t.value}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>

        {/* ── Personal Information ── */}
        <Box sx={sectionBox}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Personal Information
          </Typography>
          <Stack spacing={2}>
            <TextField fullWidth label="Full Name" value={data.fullName} onChange={(e) => update("fullName", e.target.value)} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField fullWidth label="Email" type="email" value={data.email} onChange={(e) => update("email", e.target.value)} />
              <TextField fullWidth label="Phone" value={data.phone} onChange={(e) => update("phone", e.target.value)} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField fullWidth label="Location" placeholder="City, Country" value={data.location} onChange={(e) => update("location", e.target.value)} />
              <TextField fullWidth label="Website / LinkedIn" placeholder="https://..." value={data.website} onChange={(e) => update("website", e.target.value)} />
            </Stack>
          </Stack>
        </Box>

        {/* ── Professional Summary ── */}
        <Box sx={sectionBox}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Professional Summary
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={6}
            label="Summary"
            placeholder="Brief overview of your experience, strengths, and career goals..."
            value={data.summary}
            onChange={(e) => update("summary", e.target.value)}
          />
        </Box>

        {/* ── Work Experience ── */}
        <Box sx={sectionBox}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Work Experience
            </Typography>
            <TransparentButton label="Add" startIcon={<AddIcon />} onClick={addExperience} size="small" />
          </Stack>

          {data.experiences.map((exp, idx) => (
            <Box key={exp.id}>
              {idx > 0 && <Divider sx={{ my: 2, opacity: 0.3 }} />}
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip label={`#${idx + 1}`} size="small" />
                  {data.experiences.length > 1 && (
                    <IconButton size="small" color="error" onClick={() => removeExperience(exp.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField fullWidth label="Job Title" value={exp.jobTitle} onChange={(e) => updateExperience(exp.id, "jobTitle", e.target.value)} />
                  <TextField fullWidth label="Company" value={exp.company} onChange={(e) => updateExperience(exp.id, "company", e.target.value)} />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField fullWidth label="Start Date" placeholder="Jan 2020" value={exp.startDate} onChange={(e) => updateExperience(exp.id, "startDate", e.target.value)} />
                  <TextField fullWidth label="End Date" placeholder="Present" value={exp.endDate} onChange={(e) => updateExperience(exp.id, "endDate", e.target.value)} />
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={5}
                  label="Description"
                  placeholder="Key responsibilities and achievements..."
                  value={exp.description}
                  onChange={(e) => updateExperience(exp.id, "description", e.target.value)}
                />
              </Stack>
            </Box>
          ))}
        </Box>

        {/* ── Education ── */}
        <Box sx={sectionBox}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Education
            </Typography>
            <TransparentButton label="Add" startIcon={<AddIcon />} onClick={addEducation} size="small" />
          </Stack>

          {data.educations.map((edu, idx) => (
            <Box key={edu.id}>
              {idx > 0 && <Divider sx={{ my: 2, opacity: 0.3 }} />}
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip label={`#${idx + 1}`} size="small" />
                  {data.educations.length > 1 && (
                    <IconButton size="small" color="error" onClick={() => removeEducation(edu.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField fullWidth label="Degree / Qualification" value={edu.degree} onChange={(e) => updateEducation(edu.id, "degree", e.target.value)} />
                  <TextField fullWidth label="Institution" value={edu.institution} onChange={(e) => updateEducation(edu.id, "institution", e.target.value)} />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField fullWidth label="Start Date" placeholder="Sep 2016" value={edu.startDate} onChange={(e) => updateEducation(edu.id, "startDate", e.target.value)} />
                  <TextField fullWidth label="End Date" placeholder="Jun 2020" value={edu.endDate} onChange={(e) => updateEducation(edu.id, "endDate", e.target.value)} />
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={4}
                  label="Details"
                  placeholder="Relevant coursework, honours, GPA..."
                  value={edu.details}
                  onChange={(e) => updateEducation(edu.id, "details", e.target.value)}
                />
              </Stack>
            </Box>
          ))}
        </Box>

        {/* ── Skills ── */}
        <Box sx={sectionBox}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Skills
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            label="Skills"
            placeholder="JavaScript, React, Project Management, Data Analysis..."
            value={data.skills}
            onChange={(e) => update("skills", e.target.value)}
          />
        </Box>

        {/* ── Actions ── */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <ActionButton fullWidth startIcon={<DownloadIcon />} onClick={handleDownload}>
            Download PDF
          </ActionButton>
          <TransparentButton label="Preview" fullWidth startIcon={<VisibilityIcon />} onClick={handlePreview} />
          <TransparentButton label="Reset" fullWidth onClick={handleReset} color="error" />
        </Stack>

        {/* ── Preview ── */}
        {previewUrl && (
          <Box
            sx={{
              border: `1px solid ${borderColor}`,
              borderRadius: 2,
              overflow: "hidden",
              height: 600,
            }}
          >
            <iframe src={previewUrl} title="Resume Preview" width="100%" height="100%" style={{ border: "none" }} />
          </Box>
        )}
      </Stack>
    </PageContainer>
  );
};

export default ResumeBuilder;
