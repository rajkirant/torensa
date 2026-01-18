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
} from "@mui/material";

const QR_SIZE = 220;
const EXPORT_SIZE = 300;

const TextToQr: React.FC = () => {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /* =======================
     Render QR (Preview)
     ======================= */
  useEffect(() => {
    if (!text.trim() || !canvasRef.current) return;

    QRCode.toCanvas(
      canvasRef.current,
      text,
      {
        width: QR_SIZE,
        margin: 1,
        errorCorrectionLevel: "H",
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      },
      () => {},
    );
  }, [text]);

  /* =======================
     Logo Upload
     ======================= */
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setLogo(img);
    img.src = URL.createObjectURL(file);
  };

  const downloadQr = () => {
    if (!canvasRef.current) return;
    if (!text.trim()) {
      setError("Please enter some text or a URL");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = QR_SIZE;
    canvas.height = QR_SIZE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw the QR from preview canvas
    ctx.drawImage(canvasRef.current, 0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    if (logo) {
      // sizes tuned to match preview proportions
      const logoSize = QR_SIZE * 0.18; // same visual scale as preview
      const padding = 6; // increased padding to make box slightly bigger
      const extraMargin = 4; // small extra margin so exported box matches preview

      // text to render under the logo
      const textValue = "Scan Me";

      // set font scaled to canvas size and measure text
      const fontSize = Math.max(9, Math.round(QR_SIZE * 0.04));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const textMetrics = ctx.measureText(textValue);
      const textWidth = textMetrics.width;
      const textHeight = fontSize; // approximate

      // compute required box width and height
      const requiredWidth = Math.max(logoSize, textWidth) + padding * 2;
      const requiredHeight = logoSize + textHeight + padding * 3;

      // make the box square: choose the larger dimension and add extra margin
      const boxSize = Math.max(requiredWidth, requiredHeight) + extraMargin;

      // top-left of square box
      const boxX = cx - boxSize / 2;
      const boxY = cy - boxSize / 2;

      // Draw white square box (sharp corners)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(boxX, boxY, boxSize, boxSize);

      // Draw thin border around the square using reverted color
      const borderColor = "#cccccc"; // reverted to soft gray
      const borderWidth = Math.max(1, Math.round(QR_SIZE * 0.008));
      ctx.lineWidth = borderWidth;
      ctx.strokeStyle = borderColor;

      // Draw stroke crisply aligned to pixel grid
      const halfStroke = borderWidth / 2;
      ctx.strokeRect(
        Math.round(boxX + halfStroke) - halfStroke,
        Math.round(boxY + halfStroke) - halfStroke,
        Math.round(boxSize - borderWidth),
        Math.round(boxSize - borderWidth),
      );

      // Draw logo centered horizontally, positioned near top inside the square
      const logoX = cx - logoSize / 2;
      const logoY = boxY + padding;
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);

      // Draw text centered horizontally, below the logo
      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const textX = cx;
      const textY = logoY + logoSize + Math.round(padding / 1.5);
      ctx.fillText(textValue, textX, textY);
    }

    // Download
    const png = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = png;
    link.download = "qr-code-with-logo.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  return (
    <Card sx={{ maxWidth: 480, mx: "auto", mt: 6 }}>
      <CardContent>
        <Stack spacing={3}>
          <Typography variant="h5" fontWeight={700}>
            Text to QR Code
          </Typography>

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

          <Button
            variant="outlined"
            component="label"
            sx={{ textTransform: "none" }}
          >
            Upload Logo (optional)
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
            />
          </Button>

          {text.trim() && (
            <div
              id="qr-wrapper"
              style={{
                position: "relative",
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

              {/* Preview logo */}
              {logo && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 64,
                    minHeight: 64,
                    background: "#ffffff",
                    borderRadius: 0,
                    padding: 4,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    zIndex: 2,
                    boxSizing: "border-box",
                    border: "1px solid #cccccc", // thin soft gray border to match export
                  }}
                >
                  <img
                    src={logo.src}
                    alt="logo preview"
                    style={{
                      width: 28,
                      height: 28,
                      objectFit: "contain",
                    }}
                  />

                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: "#000",
                      textAlign: "center",
                      lineHeight: 1.2,
                    }}
                  >
                    Scan Me
                  </span>
                </div>
              )}
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
        </Stack>
      </CardContent>
    </Card>
  );
};

export default TextToQr;
