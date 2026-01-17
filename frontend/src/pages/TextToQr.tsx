import React, { useState } from "react";
import { QRCode } from "react-qr-code";

import {
  Button,
  Card,
  CardContent,
  Typography,
  Stack,
  TextField,
  Alert,
} from "@mui/material";

const TextToQr: React.FC = () => {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const downloadQr = () => {
    if (!text.trim()) {
      setError("Please enter some text or a URL");
      return;
    }

    const svg = document.querySelector("#qr-wrapper svg");
    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 300;
    canvas.width = size;
    canvas.height = size;

    const img = new Image();
    const svgBlob = new Blob([svgStr], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);

      const png = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = png;
      link.download = "qr-code.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
    };

    img.src = url;
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

          {text.trim() && (
            <div
              id="qr-wrapper"
              style={{
                display: "flex",
                justifyContent: "center",
                padding: 16,
                background: "#fff",
                borderRadius: 8,
              }}
            >
              <QRCode value={text} size={220} />
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
