import React, { useState } from "react";
import readXlsxFile, { type CellValue, type Schema } from "read-excel-file";

import PageContainer from "../components/PageContainer";
import FilePickerButton from "../components/inputs/FilePickerButton";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";

type CsvRecord = Record<string, string>;

function ensureSupportedSpreadsheet(file: File) {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error("Only .xlsx files are supported. Convert .xls to .xlsx first.");
  }
}

function parseSpreadsheetCell(value: CellValue): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function buildSchema(headers: string[]): Schema<CsvRecord> {
  const schema: Schema<CsvRecord> = {};
  for (const header of headers) {
    schema[header] = {
      column: header,
      type: parseSpreadsheetCell,
    };
  }
  return schema;
}

function validateHeaders(headers: string[]) {
  if (!headers.length || headers.every((h) => !h)) {
    throw new Error("Header row is empty.");
  }
  if (headers.some((h) => !h)) {
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

function escapeCsvValue(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function toCsv(rows: string[][]): string {
  return rows
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
    .join("\r\n");
}

const ExcelUploadToCsv: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      setFile(files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select an Excel file");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      ensureSupportedSpreadsheet(file);

      const parsedRows = await readXlsxFile(file, { trim: false });
      const headerRow = parsedRows[0] || [];
      const headers = headerRow.map((cell) => (cell == null ? "" : String(cell).trim()));

      validateHeaders(headers);

      const { rows: schemaRows, errors } = await readXlsxFile<CsvRecord>(file, {
        schema: buildSchema(headers),
        trim: false,
        schemaPropertyValueForMissingValue: "",
      });

      if (errors.length > 0) {
        const firstError = errors[0];
        throw new Error(
          `Invalid value at row ${firstError.row}, column "${firstError.column}".`,
        );
      }

      if (!schemaRows.length) {
        throw new Error("No data rows found below the header row.");
      }

      const csvRows = [
        headers,
        ...schemaRows.map((record) => headers.map((header) => record[header] ?? "")),
      ];
      const csv = toCsv(csvRows);

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(/\.[^/.]+$/, ".csv");
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to convert file",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer maxWidth={480}>

        <FilePickerButton
          variant="outlined"
          label={file ? file.name : "Choose Excel File"}
          accept=".xlsx"
          onFilesSelected={handleFileChange}
        />

        <ActionButton onClick={handleUpload} loading={loading}>
          Convert & Download CSV
        </ActionButton>

        <ToolStatusAlerts error={error} />

    </PageContainer>
  );
};

export default ExcelUploadToCsv;
