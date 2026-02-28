import { useMemo, useState } from "react";
import JSZip from "jszip";
import readXlsxFile, { type CellValue } from "read-excel-file";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";

import DownloadIcon from "@mui/icons-material/Download";
import PageContainer from "../components/PageContainer";
import FilePickerButton from "../components/inputs/FilePickerButton";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import downloadBlob from "../utils/downloadBlob";

type Format = "xlsx" | "csv" | "json";
type JsonRecord = Record<string, string>;

function parseSpreadsheetCell(value: CellValue): string {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return "";
  return String(value);
}

function detectFormatFromFileName(fileName: string): Format | null {
  if (/\.xlsx$/i.test(fileName)) return "xlsx";
  if (/\.csv$/i.test(fileName)) return "csv";
  if (/\.json$/i.test(fileName)) return "json";
  return null;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(value);
      value = "";
      continue;
    }

    if (ch === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    if (ch !== "\r") {
      value += ch;
    }
  }

  if (inQuotes) {
    throw new Error("Invalid CSV: unmatched quote in file.");
  }

  row.push(value);
  rows.push(row);
  return rows;
}

function validateHeaders(headers: string[]) {
  if (!headers.length || headers.every((h) => h === "")) {
    throw new Error("Header row is empty.");
  }
  if (headers.some((h) => h === "")) {
    throw new Error("Column headers must not be empty.");
  }

  const seen = new Set<string>();
  for (const header of headers) {
    const normalized = header.toLowerCase();
    if (seen.has(normalized)) {
      throw new Error(`Duplicate column header found: "${header}"`);
    }
    seen.add(normalized);
  }
}

function normalizeTabularRows(rows: string[][]): {
  headers: string[];
  records: JsonRecord[];
} {
  if (!rows.length) {
    throw new Error("Input file is empty.");
  }

  const headers = rows[0].map((cell) => cell.trim());
  validateHeaders(headers);

  const dataRows = rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim() !== ""));

  if (!dataRows.length) {
    throw new Error("No data rows found below the header row.");
  }

  const records = dataRows.map((row) => {
    const record: JsonRecord = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });

  return { headers, records };
}

function escapeCsvValue(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function toCsv(headers: string[], records: JsonRecord[]): string {
  const rows = [
    headers,
    ...records.map((record) => headers.map((header) => record[header] ?? "")),
  ];
  return rows
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
    .join("\r\n");
}

function toJson(records: JsonRecord[]): string {
  return JSON.stringify(records, null, 2);
}

function colToName(index: number): string {
  let col = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function toXlsxBlob(
  headers: string[],
  records: JsonRecord[],
): Promise<Blob> {
  const allRows = [
    headers,
    ...records.map((record) => headers.map((header) => record[header] ?? "")),
  ];

  const sheetRows = allRows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          const ref = `${colToName(colIndex)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const lastCell = `${colToName(Math.max(headers.length - 1, 0))}${allRows.length}`;

  const worksheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="A1:${lastCell}"/>` +
    `<sheetData>${sheetRows}</sheetData>` +
    `</worksheet>`;

  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"` +
    ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`;

  const workbookRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"` +
    ` Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"` +
    ` Target="styles.xml"/>` +
    `</Relationships>`;

  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
    `</styleSheet>`;

  const relsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"` +
    ` Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml"` +
    ` ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml"` +
    ` ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml"` +
    ` ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml);
  zip.folder("_rels")?.file(".rels", relsXml);
  zip.folder("xl")?.file("workbook.xml", workbookXml);
  zip.folder("xl")?.folder("_rels")?.file("workbook.xml.rels", workbookRelsXml);
  zip.folder("xl")?.folder("worksheets")?.file("sheet1.xml", worksheetXml);
  zip.folder("xl")?.file("styles.xml", stylesXml);

  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function parseInputFile(
  file: File,
  sourceFormat: Format,
): Promise<{ headers: string[]; records: JsonRecord[] }> {
  if (sourceFormat === "xlsx") {
    const parsedRows = await readXlsxFile(file, { trim: false });
    const normalizedRows = parsedRows.map((row) =>
      row.map(parseSpreadsheetCell),
    );
    return normalizeTabularRows(normalizedRows);
  }

  if (sourceFormat === "csv") {
    const raw = await file.text();
    const rows = parseCsv(raw);
    return normalizeTabularRows(rows);
  }

  const raw = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON format.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("JSON must be a non-empty array of objects.");
  }

  const headers: string[] = [];
  const seen = new Set<string>();
  const records: JsonRecord[] = parsed.map((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("JSON must be a non-empty array of objects.");
    }

    const record: JsonRecord = {};
    Object.entries(item as Record<string, unknown>).forEach(([key, value]) => {
      const header = key.trim();
      if (!header) {
        throw new Error("JSON object keys must not be empty.");
      }

      const normalized = header.toLowerCase();
      if (!seen.has(normalized)) {
        headers.push(header);
        seen.add(normalized);
      }

      if (value === null || value === undefined) {
        record[header] = "";
      } else if (typeof value === "object") {
        record[header] = JSON.stringify(value);
      } else {
        record[header] = String(value);
      }
    });
    return record;
  });

  validateHeaders(headers);

  return {
    headers,
    records: records.map((record) => {
      const normalized: JsonRecord = {};
      headers.forEach((header) => {
        normalized[header] = record[header] ?? "";
      });
      return normalized;
    }),
  };
}

const formatLabel: Record<Format, string> = {
  xlsx: "Excel (.xlsx)",
  csv: "CSV (.csv)",
  json: "JSON (.json)",
};

export default function CsvToJsonConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceFormat, setSourceFormat] = useState<Format>("csv");
  const [targetFormat, setTargetFormat] = useState<Format>("json");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const targetOptions = useMemo(
    () =>
      (["xlsx", "csv", "json"] as Format[]).filter(
        (fmt) => fmt !== sourceFormat,
      ),
    [sourceFormat],
  );

  const handleFileChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selectedFile = files[0];
    setFile(selectedFile);
    setError(null);
    setSuccess(null);

    const detected = detectFormatFromFileName(selectedFile.name);
    if (detected) {
      setSourceFormat(detected);
      setTargetFormat(detected === "xlsx" ? "csv" : "xlsx");
    }
  };

  const handleSourceFormatChange = (nextFormat: Format) => {
    setSourceFormat(nextFormat);
    if (nextFormat === targetFormat) {
      setTargetFormat(nextFormat === "xlsx" ? "csv" : "xlsx");
    }
  };

  const handleConvert = async () => {
    if (!file) {
      setError("Please select a file.");
      return;
    }

    if (sourceFormat === targetFormat) {
      setError("Input and output formats must be different.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { headers, records } = await parseInputFile(file, sourceFormat);
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const outFileName = `${baseName}.${targetFormat}`;

      if (targetFormat === "csv") {
        const csv = toCsv(headers, records);
        downloadBlob(
          new Blob([csv], { type: "text/csv;charset=utf-8;" }),
          outFileName,
        );
      } else if (targetFormat === "json") {
        const json = toJson(records);
        downloadBlob(
          new Blob([json], { type: "application/json;charset=utf-8;" }),
          outFileName,
        );
      } else {
        const xlsxBlob = await toXlsxBlob(headers, records);
        downloadBlob(xlsxBlob, outFileName);
      }

      setSuccess(
        `Converted ${records.length} row(s) from ${formatLabel[sourceFormat]} to ${formatLabel[targetFormat]}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer maxWidth={560}>
      <FilePickerButton
        variant="outlined"
        label={file ? file.name : "Choose File"}
        accept=".xlsx,.csv,.json,application/json,text/csv"
        onFilesSelected={handleFileChange}
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <FormControl fullWidth size="small">
          <InputLabel id="source-format-label">From</InputLabel>
          <Select
            labelId="source-format-label"
            label="From"
            value={sourceFormat}
            onChange={(event) =>
              handleSourceFormatChange(event.target.value as Format)
            }
          >
            <MenuItem value="xlsx">{formatLabel.xlsx}</MenuItem>
            <MenuItem value="csv">{formatLabel.csv}</MenuItem>
            <MenuItem value="json">{formatLabel.json}</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel id="target-format-label">To</InputLabel>
          <Select
            labelId="target-format-label"
            label="To"
            value={targetFormat}
            onChange={(event) => setTargetFormat(event.target.value as Format)}
          >
            {targetOptions.map((format) => (
              <MenuItem key={format} value={format}>
                {formatLabel[format]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <ActionButton
        startIcon={<DownloadIcon />}
        onClick={handleConvert}
        loading={loading}
      >
        Convert & Download
      </ActionButton>

      <ToolStatusAlerts error={error} success={success} />
    </PageContainer>
  );
}
