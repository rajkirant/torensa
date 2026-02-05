import React, { useState } from "react";

import {
  Button,
  Typography,
  Stack,
  CircularProgress,
  Alert,
} from "@mui/material";
import { apiFetch } from "../utils/api";
import PageContainer from "../components/PageContainer";

const ExcelUploadToCsv: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
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

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await apiFetch("/api/excel-to-csv/", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) throw new Error("Conversion failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(/\.[^/.]+$/, ".csv");
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to upload or convert file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer maxWidth={480}>

        <Button variant="outlined" component="label">
          {file ? file.name : "Choose Excel File"}
          <input
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={handleFileChange}
          />
        </Button>

        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={loading}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          {loading ? (
            <CircularProgress size={24} sx={{ color: "#fff" }} />
          ) : (
            "Upload & Download CSV"
          )}
        </Button>

        {error && <Alert severity="error">{error}</Alert>}

    </PageContainer>
  );
};

export default ExcelUploadToCsv;
