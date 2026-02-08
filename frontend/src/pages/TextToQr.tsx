import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

import {
  Button,
  Card,
  CardContent,
  Typography,
  Stack,
  TextField,
  Alert,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import PageContainer from "../components/PageContainer";
import FilePickerButton from "../components/inputs/FilePickerButton";

const QR_SIZE = 220;
const EXPORT_SIZE = 300;
const MAX_TEXT_LENGTH = 10;

/* =======================
   Shared render function
   ======================= */
const renderQrToCanvas = async (
  canvas: HTMLCanvasElement,
  text: string,
  logo: HTMLImageElement | null,
  size: number,
  showLogoText: boolean,
  logoText: string,
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = size;
  canvas.height = size;

  // Draw QR
  await QRCode.toCanvas(canvas, text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "H",
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  if (!logo) return;

  const cx = size / 2;

  const logoSize = size * 0.18;
  const padding = 6;
  const extraMargin = 4;

  const finalText =
    showLogoText && logoText.trim()
      ? logoText.trim().slice(0, MAX_TEXT_LENGTH)
      : "";

  const fontSize = Math.max(9, Math.round(size * 0.04));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const textWidth = finalText ? ctx.measureText(finalText).width : 0;
  const textHeight = finalText ? fontSize : 0;

  const requiredWidth = Math.max(logoSize, textWidth) + padding * 2;

  const requiredHeight =
    logoSize + (finalText ? textHeight + padding : 0) + padding * 2;

  const boxSize = Math.max(requiredWidth, requiredHeight) + extraMargin;

  const boxX = cx - boxSize / 2;
  const boxY = cx - boxSize / 2;

  // Background box
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(boxX, boxY, boxSize, boxSize);

  // Border
  const borderWidth = Math.max(1, Math.round(size * 0.008));
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(boxX, boxY, boxSize, boxSize);

  const contentHeight =
    logoSize + (finalText ? fontSize + Math.round(padding / 1.5) : 0);

  const contentStartY = boxY + (boxSize - contentHeight) / 2;

  // Logo
  const logoX = cx - logoSize / 2;
  const logoY = contentStartY;
  ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);

  // Optional text
  if (finalText) {
    ctx.fillStyle = "#000000";
    ctx.fillText(finalText, cx, logoY + logoSize + Math.round(padding / 1.5));
  }
};

const TextToQr: React.FC = () => {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);

  const [showLogoText, setShowLogoText] = useState(true);
  const [logoText, setLogoText] = useState("Scan Me");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /* =======================
     Render preview
     ======================= */
  useEffect(() => {
    if (!text.trim() || !canvasRef.current) return;

    renderQrToCanvas(
      canvasRef.current,
      text,
      logo,
      QR_SIZE,
      showLogoText,
      logoText,
    );
  }, [text, logo, showLogoText, logoText]);

  /* =======================
     Logo upload
     ======================= */
  const handleLogoUpload = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setLogo(img);
    img.src = URL.createObjectURL(file);
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const removeLogo = () => {
    setLogo(null);
    setShowLogoText(true);
    setLogoText("Scan Me");

    // Reset file input so same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* =======================
     Download
     ======================= */
  const downloadQr = async () => {
    if (!text.trim()) {
      setError("Please enter some text or a URL");
      return;
    }

    const canvas = document.createElement("canvas");
    await renderQrToCanvas(
      canvas,
      text,
      logo,
      EXPORT_SIZE,
      showLogoText,
      logoText,
    );

    const png = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = png;
    link.download = "qr-code-with-logo.png";
    link.click();
  };

  return (
    <PageContainer maxWidth={480}>

        <TextField
          label="Text or URL"
          placeholder="https://torensa.com"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          multiline
          minRows={3}
          fullWidth
        />

        <Stack direction="row" spacing={2}>
          <FilePickerButton
            variant="outlined"
            sx={{ textTransform: "none" }}
            label="Upload Logo"
            accept="image/*"
            inputRef={fileInputRef}
            onFilesSelected={handleLogoUpload}
          />

          {logo && (
            <Button
              variant="outlined"
              color="error"
              onClick={removeLogo}
              sx={{ textTransform: "none" }}
            >
              Remove Logo
            </Button>
          )}
        </Stack>

        {logo && (
          <>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showLogoText}
                  onChange={(e) => setShowLogoText(e.target.checked)}
                />
              }
              label="Show text under logo"
            />

            {showLogoText && (
              <TextField
                label="Logo text"
                value={logoText}
                inputProps={{ maxLength: MAX_TEXT_LENGTH }}
                helperText={`${logoText.length}/${MAX_TEXT_LENGTH} characters`}
                onChange={(e) => setLogoText(e.target.value)}
              />
            )}
          </>
        )}

        {text.trim() && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: 16,
              background: "#ffffff",
              borderRadius: 8,
            }}
          >
            <canvas
              ref={canvasRef}
              width={QR_SIZE}
              height={QR_SIZE}
              style={{ display: "block" }}
            />
          </div>
        )}

        <Button
          variant="contained"
          onClick={downloadQr}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Generate & Download QR
        </Button>

        {error && <Alert severity="error">{error}</Alert>}
    </PageContainer>
  );
};

export default TextToQr;
