import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import LinkIcon from "@mui/icons-material/Link";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ContactMailIcon from "@mui/icons-material/ContactMail";
import WifiIcon from "@mui/icons-material/Wifi";
import PageContainer, { usePageOptions } from "../components/PageContainer";
import FilePickerButton from "../components/inputs/FilePickerButton";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import { TransparentButton } from "../components/buttons/TransparentButton";
import downloadBlob from "../utils/downloadBlob";

const QR_SIZE = 220;
const EXPORT_SIZE = 300;
const MAX_TEXT_LENGTH = 10;

type QrType = "url" | "text" | "contact" | "wifi";
type WifiEncryption = "WPA" | "WEP" | "nopass";

const escapeWifiValue = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/:/g, "\\:");

const escapeVcardValue = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");

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

const TextToQrContent: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);

  const [showLogoText, setShowLogoText] = useState(true);
  const [logoText, setLogoText] = useState("Scan Me");

  const [basicText, setBasicText] = useState("");

  const [qrType, setQrType] = useState<QrType>("text");
  const [urlValue, setUrlValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactOrg, setContactOrg] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactWebsite, setContactWebsite] = useState("");

  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiEncryption, setWifiEncryption] = useState<WifiEncryption>("WPA");
  const [wifiHidden, setWifiHidden] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { showAdvancedOptions, advancedOptionsEnabled } = usePageOptions();
  const useAdvancedOptions = advancedOptionsEnabled && showAdvancedOptions;

  /* =======================
     Render preview
     ======================= */
  const qrValue = useMemo(() => {
    if (!useAdvancedOptions) return basicText.trim();

    if (qrType === "url") return urlValue.trim();
    if (qrType === "text") return textValue.trim();
    if (qrType === "contact") {
      const trimmedName = contactName.trim();
      const trimmedEmail = contactEmail.trim();
      const trimmedPhone = contactPhone.trim();
      const trimmedOrg = contactOrg.trim();
      const trimmedTitle = contactTitle.trim();
      const trimmedWebsite = contactWebsite.trim();

      if (
        !trimmedName &&
        !trimmedEmail &&
        !trimmedPhone &&
        !trimmedOrg &&
        !trimmedTitle &&
        !trimmedWebsite
      ) {
        return "";
      }

      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      if (trimmedName) {
        const escapedName = escapeVcardValue(trimmedName);
        lines.push(`FN:${escapedName}`);
        lines.push(`N:${escapedName};;;;`);
      }
      if (trimmedOrg) lines.push(`ORG:${escapeVcardValue(trimmedOrg)}`);
      if (trimmedTitle) lines.push(`TITLE:${escapeVcardValue(trimmedTitle)}`);
      if (trimmedPhone) lines.push(`TEL;TYPE=CELL:${escapeVcardValue(trimmedPhone)}`);
      if (trimmedEmail) lines.push(`EMAIL:${escapeVcardValue(trimmedEmail)}`);
      if (trimmedWebsite) lines.push(`URL:${escapeVcardValue(trimmedWebsite)}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }

    const trimmedSsid = wifiSsid.trim();
    if (!trimmedSsid) return "";

    const segments = [
      `T:${wifiEncryption}`,
      `S:${escapeWifiValue(trimmedSsid)}`,
    ];

    if (wifiEncryption !== "nopass") {
      const trimmedPassword = wifiPassword.trim();
      if (trimmedPassword) {
        segments.push(`P:${escapeWifiValue(trimmedPassword)}`);
      }
    }

    if (wifiHidden) {
      segments.push("H:true");
    }

    return `WIFI:${segments.join(";")};;`;
  }, [
    useAdvancedOptions,
    basicText,
    qrType,
    urlValue,
    textValue,
    contactName,
    contactEmail,
    contactPhone,
    contactOrg,
    contactTitle,
    contactWebsite,
    wifiSsid,
    wifiPassword,
    wifiEncryption,
    wifiHidden,
  ]);

  useEffect(() => {
    if (!qrValue.trim() || !canvasRef.current) return;

    renderQrToCanvas(
      canvasRef.current,
      qrValue,
      logo,
      QR_SIZE,
      showLogoText,
      logoText,
    );
  }, [qrValue, logo, showLogoText, logoText]);

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
  const getValidationError = () => {
    if (!useAdvancedOptions) {
      return basicText.trim() ? null : "Please enter some text or a URL.";
    }

    if (qrType === "url") {
      return urlValue.trim() ? null : "Please enter a URL.";
    }

    if (qrType === "text") {
      return textValue.trim() ? null : "Please enter text for the QR code.";
    }

    if (qrType === "contact") {
      return contactName.trim() ||
        contactEmail.trim() ||
        contactPhone.trim() ||
        contactOrg.trim() ||
        contactTitle.trim() ||
        contactWebsite.trim()
        ? null
        : "Please enter at least a name, email, or phone number.";
    }

    if (!wifiSsid.trim()) {
      return "Please enter a network name (SSID).";
    }

    if (wifiEncryption !== "nopass" && !wifiPassword.trim()) {
      return "Please enter the WiFi password.";
    }

    return null;
  };

  const downloadQr = async () => {
    const validationError = getValidationError();
    if (validationError) {
      setError(validationError);
      return;
    }

    const canvas = document.createElement("canvas");
    await renderQrToCanvas(
      canvas,
      qrValue,
      logo,
      EXPORT_SIZE,
      showLogoText,
      logoText,
    );
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to export QR image."));
      }, "image/png");
    });
    downloadBlob(pngBlob, "qr-code-with-logo.png");
  };

  return (
    <Stack spacing={2.5}>
        {useAdvancedOptions ? (
          <Stack spacing={2}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: "1px solid rgba(148,163,184,0.3)",
                bgcolor: "rgba(15,23,42,0.4)",
              }}
            >
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                QR Code Type
              </Typography>
              <TextField
                select
                label="QR Code Type"
                value={qrType}
                onChange={(e) => {
                  setQrType(e.target.value as QrType);
                  setError(null);
                }}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {qrType === "url" && <LinkIcon fontSize="small" />}
                      {qrType === "text" && <TextFieldsIcon fontSize="small" />}
                      {qrType === "contact" && <ContactMailIcon fontSize="small" />}
                      {qrType === "wifi" && <WifiIcon fontSize="small" />}
                    </InputAdornment>
                  ),
                }}
              >
                <MenuItem value="url">URL</MenuItem>
                <MenuItem value="text">Text</MenuItem>
                <MenuItem value="contact">Contact</MenuItem>
                <MenuItem value="wifi">WiFi</MenuItem>
              </TextField>
            </Box>

            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: "1px solid rgba(148,163,184,0.3)",
                bgcolor: "rgba(15,23,42,0.4)",
              }}
            >
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                Input Data
              </Typography>

              {qrType === "url" && (
                <TextField
                  label="URL"
                  placeholder="https://torensa.com"
                  value={urlValue}
                  onChange={(e) => {
                    setUrlValue(e.target.value);
                    setError(null);
                  }}
                  fullWidth
                />
              )}

              {qrType === "text" && (
                <TextField
                  label="Text"
                  placeholder="Add any message or link"
                  value={textValue}
                  onChange={(e) => {
                    setTextValue(e.target.value);
                    setError(null);
                  }}
                  multiline
                  minRows={3}
                  fullWidth
                />
              )}

              {qrType === "contact" && (
                <Stack spacing={2}>
                  <TextField
                    label="Full name"
                    value={contactName}
                    onChange={(e) => {
                      setContactName(e.target.value);
                      setError(null);
                    }}
                    fullWidth
                  />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="Phone"
                      value={contactPhone}
                      onChange={(e) => {
                        setContactPhone(e.target.value);
                        setError(null);
                      }}
                      fullWidth
                    />
                    <TextField
                      label="Email"
                      value={contactEmail}
                      onChange={(e) => {
                        setContactEmail(e.target.value);
                        setError(null);
                      }}
                      fullWidth
                    />
                  </Stack>
                  <TextField
                    label="Organization"
                    value={contactOrg}
                    onChange={(e) => {
                      setContactOrg(e.target.value);
                      setError(null);
                    }}
                    fullWidth
                  />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="Title"
                      value={contactTitle}
                      onChange={(e) => {
                        setContactTitle(e.target.value);
                        setError(null);
                      }}
                      fullWidth
                    />
                    <TextField
                      label="Website"
                      value={contactWebsite}
                      onChange={(e) => {
                        setContactWebsite(e.target.value);
                        setError(null);
                      }}
                      fullWidth
                    />
                  </Stack>
                </Stack>
              )}

              {qrType === "wifi" && (
                <Stack spacing={2}>
                  <TextField
                    label="Network Name (SSID)"
                    placeholder="MyWiFiNetwork"
                    value={wifiSsid}
                    onChange={(e) => {
                      setWifiSsid(e.target.value);
                      setError(null);
                    }}
                    fullWidth
                  />
                  <TextField
                    label="Password"
                    placeholder="Network Password"
                    value={wifiPassword}
                    onChange={(e) => {
                      setWifiPassword(e.target.value);
                      setError(null);
                    }}
                    type="password"
                    fullWidth
                  />
                  <TextField
                    select
                    label="Encryption"
                    value={wifiEncryption}
                    onChange={(e) => {
                      setWifiEncryption(e.target.value as WifiEncryption);
                      setError(null);
                    }}
                    fullWidth
                  >
                    <MenuItem value="WPA">WPA/WPA2</MenuItem>
                    <MenuItem value="WEP">WEP</MenuItem>
                    <MenuItem value="nopass">None</MenuItem>
                  </TextField>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={wifiHidden}
                        onChange={(e) => {
                          setWifiHidden(e.target.checked);
                          setError(null);
                        }}
                      />
                    }
                    label="Hidden Network"
                  />
                </Stack>
              )}
            </Box>
          </Stack>
        ) : (
          <TextField
            label="Text or URL"
            placeholder="https://torensa.com"
            value={basicText}
            onChange={(e) => {
              setBasicText(e.target.value);
              setError(null);
            }}
            multiline
            minRows={3}
            fullWidth
          />
        )}

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <FilePickerButton
            variant="outlined"
            sx={{ textTransform: "none" }}
            label="Upload Logo"
            accept="image/*"
            inputRef={fileInputRef}
            onFilesSelected={handleLogoUpload}
          />

          {logo && (
            <TransparentButton
              label="Remove Logo"
              color="error"
              onClick={removeLogo}
            />
          )}
        </Box>

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

        {qrValue.trim() && (
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

        <ActionButton onClick={downloadQr}>
          Generate & Download QR
        </ActionButton>

        <ToolStatusAlerts error={error} />
    </Stack>
  );
};

const TextToQr: React.FC = () => {
  return (
    <PageContainer maxWidth={680}>
      <TextToQrContent />
    </PageContainer>
  );
};

export default TextToQr;
