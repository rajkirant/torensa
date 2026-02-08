import React, { useState } from "react";
import * as XLSX from "xlsx";

import {
  Button,
  CircularProgress,
} from "@mui/material";
import PageContainer from "../components/PageContainer";
import FilePickerButton from "../components/inputs/FilePickerButton";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";

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
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("No worksheets found");
      }

      const firstSheet = workbook.Sheets[firstSheetName];
      const csv = XLSX.utils.sheet_to_csv(firstSheet, {
        blankrows: false,
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(/\.[^/.]+$/, ".csv");
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to convert file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer maxWidth={480}>

        <FilePickerButton
          variant="outlined"
          label={file ? file.name : "Choose Excel File"}
          accept=".xlsx,.xls"
          onFilesSelected={handleFileChange}
        />

        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={loading}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          {loading ? (
            <CircularProgress size={24} sx={{ color: "#fff" }} />
          ) : (
            "Convert & Download CSV"
          )}
        </Button>

        <ToolStatusAlerts error={error} />

    </PageContainer>
  );
};

export default ExcelUploadToCsv;
