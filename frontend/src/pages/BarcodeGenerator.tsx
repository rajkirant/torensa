import React, { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";

import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import DownloadIcon from "@mui/icons-material/Download";
import PageContainer, { usePageOptions } from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import { TransparentButton } from "../components/buttons/TransparentButton";
import useToolStatus from "../hooks/useToolStatus";
import downloadBlob from "../utils/downloadBlob";

type BarcodeFormat = "CODE128" | "CODE39" | "EAN13" | "EAN8" | "UPC";

type FormatOption = {
  value: BarcodeFormat;
  label: string;
  helperText: string;
  maxLength: number;
};

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: "CODE128",
    label: "Code 128",
    helperText: "Supports letters, numbers, and symbols.",
    maxLength: 120,
  },
  {
    value: "CODE39",
    label: "Code 39",
    helperText: "Use uppercase A-Z, 0-9, and - . space $ / + %.",
    maxLength: 80,
  },
  {
    value: "EAN13",
    label: "EAN-13",
    helperText: "Use 12 or 13 digits.",
    maxLength: 13,
  },
  {
    value: "EAN8",
    label: "EAN-8",
    helperText: "Use 7 or 8 digits.",
    maxLength: 8,
  },
  {
    value: "UPC",
    label: "UPC-A",
    helperText: "Use 11 or 12 digits.",
    maxLength: 12,
  },
];

const DEFAULT_FORMAT: BarcodeFormat = "CODE128";
const DEFAULT_BAR_WIDTH = 2;
const DEFAULT_BAR_HEIGHT = 100;
const DEFAULT_SHOW_TEXT = true;

const validateBarcodeInput = (format: BarcodeFormat, rawValue: string) => {
  const value = rawValue.trim();
  if (!value) return "Enter a value to generate a barcode.";

  if (format === "CODE39") {
    const code39Pattern = /^[0-9A-Z\-. $/+%]+$/;
    if (!code39Pattern.test(value.toUpperCase())) {
      return "Code 39 allows uppercase letters, digits, and - . space $ / + %.";
    }
  }

  if (format === "EAN13") {
    if (!/^\d{12,13}$/.test(value)) {
      return "EAN-13 requires 12 or 13 digits.";
    }
  }

  if (format === "EAN8") {
    if (!/^\d{7,8}$/.test(value)) {
      return "EAN-8 requires 7 or 8 digits.";
    }
  }

  if (format === "UPC") {
    if (!/^\d{11,12}$/.test(value)) {
      return "UPC-A requires 11 or 12 digits.";
    }
  }

  return "";
};

const BarcodeGeneratorContent: React.FC = () => {
  const [value, setValue] = useState("TOR-2026-001");
  const [format, setFormat] = useState<BarcodeFormat>(DEFAULT_FORMAT);
  const [barWidth, setBarWidth] = useState(DEFAULT_BAR_WIDTH);
  const [barHeight, setBarHeight] = useState(DEFAULT_BAR_HEIGHT);
  const [showText, setShowText] = useState(DEFAULT_SHOW_TEXT);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { error, success, setError, setSuccess, clear } = useToolStatus();
  const { showAdvancedOptions, advancedOptionsEnabled } = usePageOptions();

  const useAdvancedOptions = advancedOptionsEnabled && showAdvancedOptions;
  const effectiveFormat = useAdvancedOptions ? format : DEFAULT_FORMAT;
  const effectiveBarWidth = useAdvancedOptions ? barWidth : DEFAULT_BAR_WIDTH;
  const effectiveBarHeight = useAdvancedOptions
    ? barHeight
    : DEFAULT_BAR_HEIGHT;
  const effectiveShowText = useAdvancedOptions ? showText : DEFAULT_SHOW_TEXT;

  const selectedFormat = useMemo(
    () =>
      FORMAT_OPTIONS.find((item) => item.value === effectiveFormat) ??
      FORMAT_OPTIONS[0],
    [effectiveFormat],
  );

  const normalizedValue = useMemo(() => {
    const trimmed = value.trim();
    if (effectiveFormat === "CODE39") return trimmed.toUpperCase();
    return trimmed;
  }, [effectiveFormat, value]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const validationError = validateBarcodeInput(
      effectiveFormat,
      normalizedValue,
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      JsBarcode(canvasRef.current, normalizedValue, {
        format: effectiveFormat,
        width: effectiveBarWidth,
        height: effectiveBarHeight,
        margin: 12,
        lineColor: "#111827",
        background: "#ffffff",
        displayValue: effectiveShowText,
        fontOptions: "bold",
      });
      setError();
    } catch {
      setError("Unable to generate barcode with the current value and format.");
    }
  }, [
    effectiveFormat,
    normalizedValue,
    effectiveBarHeight,
    effectiveBarWidth,
    effectiveShowText,
    setError,
  ]);

  const handleDownload = async () => {
    clear();

    const validationError = validateBarcodeInput(
      effectiveFormat,
      normalizedValue,
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!canvasRef.current) {
      setError("Barcode preview is not ready yet.");
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvasRef.current?.toBlob((result) => resolve(result), "image/png");
    });

    if (!blob) {
      setError("Failed to export barcode image.");
      return;
    }

    downloadBlob(blob, `barcode-${effectiveFormat.toLowerCase()}.png`);
    setSuccess("Barcode downloaded as PNG.");
  };

  const clearAll = () => {
    setValue("");
    setFormat(DEFAULT_FORMAT);
    setBarWidth(DEFAULT_BAR_WIDTH);
    setBarHeight(DEFAULT_BAR_HEIGHT);
    setShowText(DEFAULT_SHOW_TEXT);
    clear();
  };

  return (
    <Stack spacing={2.5}>
      <Stack
        spacing={2}
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderRadius: 2,
          border: "1px solid rgba(59,130,246,0.35)",
          background:
            "linear-gradient(140deg, rgba(59,130,246,0.17) 0%, rgba(15,23,42,0.12) 55%, rgba(14,165,233,0.12) 100%)",
        }}
      >
        <TextField
          label="Barcode value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          fullWidth
          inputProps={{ maxLength: selectedFormat.maxLength }}
          helperText={selectedFormat.helperText}
        />

        {useAdvancedOptions ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              label="Format"
              value={format}
              onChange={(e) => setFormat(e.target.value as BarcodeFormat)}
              sx={{ minWidth: { xs: "100%", sm: 180 } }}
            >
              {FORMAT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Bar width"
              type="number"
              value={barWidth}
              onChange={(e) =>
                setBarWidth(
                  Math.max(1, Math.min(4, Number(e.target.value) || 1)),
                )
              }
              inputProps={{ min: 1, max: 4, step: 1 }}
              sx={{ width: { xs: "100%", sm: 130 } }}
            />

            <TextField
              label="Bar height"
              type="number"
              value={barHeight}
              onChange={(e) =>
                setBarHeight(
                  Math.max(40, Math.min(220, Number(e.target.value) || 40)),
                )
              }
              inputProps={{ min: 40, max: 220, step: 5 }}
              sx={{ width: { xs: "100%", sm: 140 } }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={showText}
                  onChange={(e) => setShowText(e.target.checked)}
                />
              }
              label="Show text"
              sx={{ m: 0, alignSelf: { xs: "flex-start", sm: "center" } }}
            />
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Using defaults: Code 128, bar width 2, bar height 100, show text on.
          </Typography>
        )}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <ActionButton
            startIcon={<DownloadIcon />}
            onClick={() => void handleDownload()}
          >
            Download PNG
          </ActionButton>
          <TransparentButton label="Clear" onClick={clearAll} />
        </Stack>
      </Stack>

      <ToolStatusAlerts error={error} success={success} />

      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          p: 2,
          borderRadius: 2,
          border: "1px solid rgba(148,163,184,0.3)",
          bgcolor: "rgba(2,6,23,0.24)",
          overflowX: "auto",
        }}
      >
        {normalizedValue ? (
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: "100%",
              background: "#ffffff",
              padding: 12,
              borderRadius: 8,
            }}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Enter a value to preview barcode output.
          </Typography>
        )}
      </Box>
    </Stack>
  );
};

const BarcodeGenerator: React.FC = () => {
  return (
    <PageContainer maxWidth={860}>
      <BarcodeGeneratorContent />
    </PageContainer>
  );
};

export default BarcodeGenerator;
