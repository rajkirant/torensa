import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { SignJWT, decodeProtectedHeader, decodeJwt } from "jose";
import PageContainer from "../../components/PageContainer";
import ToolStatusAlerts from "../../components/alerts/ToolStatusAlerts";
import DecodeAccordion from "./DecodeAccordion";
import EncodeAccordion from "./EncodeAccordion";
import useToolStatus from "../../hooks/useToolStatus";

type HoverTip = { x: number; y: number; text: string } | null;

const prettyJson = (obj: unknown) => JSON.stringify(obj, null, 2);

const safeParseJson = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed);
};

const copyToClipboard = async (text: string) => {
  await navigator.clipboard.writeText(text);
};

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const toIsoLocalForInput = (epochSec: number) => {
  const d = new Date(epochSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const fromIsoLocalInputToEpochSec = (value: string) => {
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
};

const accordionStyle = {
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.18)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
  boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
  overflow: "hidden",
  "&:before": { display: "none" },
  mb: 2,
};

export default function JwtToolPage() {
  const [jwtInput, setJwtInput] = useState("");
  const [alg, setAlg] = useState<"HS256" | "HS512">("HS512");
  const [payloadText, setPayloadText] = useState(
    prettyJson({
      sub: "1234567890",
      name: "John Doe",
    }),
  );
  const [secret, setSecret] = useState("secret-key");

  const [autoIat, setAutoIat] = useState(true);
  const [useExpiry, setUseExpiry] = useState(true);
  const [expiryDateLocal, setExpiryDateLocal] = useState(() => {
    const now = Math.floor(Date.now() / 1000);
    return toIsoLocalForInput(now + 60 * 60);
  });

  const [jwtOutput, setJwtOutput] = useState("");
  const { error, success, setError, setSuccess, clear } = useToolStatus();
  const [hoverTip, setHoverTip] = useState<HoverTip>(null);
  const [expanded, setExpanded] = useState({
    decode: false,
    encode: false,
  });

  const decoded = useMemo(() => {
    const t = jwtInput.trim();
    if (!t) return null;

    try {
      const header = decodeProtectedHeader(t);
      const payload = decodeJwt(t);
      return { header, payload };
    } catch {
      return null;
    }
  }, [jwtInput]);

  const clearStatus = () => clear();

  const handleDecodeToInputs = () => {
    if (!decoded) return;

    const tokenAlg = (decoded.header as any)?.alg;
    if (tokenAlg === "HS256" || tokenAlg === "HS512") setAlg(tokenAlg);

    setPayloadText(prettyJson(decoded.payload));
    setSuccess("Loaded decoded payload into encoder fields.");
    setError();

    const exp = (decoded.payload as any)?.exp;
    if (isFiniteNumber(exp)) {
      setUseExpiry(true);
      setExpiryDateLocal(toIsoLocalForInput(exp));
    }

    setExpanded({ decode: false, encode: true });
  };

  const handleEncode = async () => {
    clear();

    try {
      const payloadObj = safeParseJson(payloadText) as any;

      const now = Math.floor(Date.now() / 1000);
      const nextPayload: Record<string, any> = { ...payloadObj };

      if (autoIat) nextPayload.iat = now;

      if (useExpiry) {
        const expSec = fromIsoLocalInputToEpochSec(expiryDateLocal);
        if (expSec == null) {
          setError("Invalid expiry date/time.");
          return;
        }
        if (expSec <= now) {
          setError("Expiry must be in the future.");
          return;
        }
        nextPayload.exp = expSec;
      }

      const token = await new SignJWT(nextPayload)
        .setProtectedHeader({ alg, typ: "JWT" })
        .sign(new TextEncoder().encode(secret));

      setJwtOutput(token);
      setSuccess(`JWT generated successfully (${alg}).`);
    } catch (e: any) {
      setError(
        e?.message ?? "Failed to generate JWT. Check your JSON and secret.",
      );
    }
  };

  const handleClear = () => {
    setJwtInput("");
    setJwtOutput("");
    setHoverTip(null);
    clear();
  };

  return (
    <>
      <PageContainer maxWidth={980}>
        <Stack spacing={1.5} sx={{ pb: "112px" }}>
          <ToolStatusAlerts error={error} success={success} />

          <Accordion
            expanded={expanded.decode}
            onChange={(_, isExpanded) =>
              setExpanded((prev) => ({ ...prev, decode: isExpanded }))
            }
            sx={accordionStyle}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={700} sx={{ color: "#60a5fa" }}>
                Decode JWT
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <DecodeAccordion
                jwtInput={jwtInput}
                setJwtInput={setJwtInput}
                decoded={decoded}
                onDecodeToInputs={handleDecodeToInputs}
                onClear={handleClear}
                onCopyJwt={async () => {
                  try {
                    await copyToClipboard(jwtInput.trim());
                    setSuccess("Copied JWT input.");
                    setError();
                  } catch {
                    setError("Unable to copy to clipboard.");
                  }
                }}
                hoverTip={hoverTip}
                setHoverTip={setHoverTip}
                clearStatus={clearStatus}
              />
            </AccordionDetails>
          </Accordion>

          <Accordion
            expanded={expanded.encode}
            onChange={(_, isExpanded) =>
              setExpanded((prev) => ({ ...prev, encode: isExpanded }))
            }
            sx={accordionStyle}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={700} sx={{ color: "#fbbf24" }}>
                Encode JWT
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <EncodeAccordion
                alg={alg}
                setAlg={setAlg}
                autoIat={autoIat}
                setAutoIat={setAutoIat}
                useExpiry={useExpiry}
                setUseExpiry={setUseExpiry}
                expiryDateLocal={expiryDateLocal}
                setExpiryDateLocal={setExpiryDateLocal}
                payloadText={payloadText}
                setPayloadText={setPayloadText}
                secret={secret}
                setSecret={setSecret}
                jwtOutput={jwtOutput}
                onGenerate={() => void handleEncode()}
                onCopyGenerated={async () => {
                  try {
                    await copyToClipboard(jwtOutput.trim());
                    setSuccess("Copied generated JWT.");
                    setError();
                  } catch {
                    setError("Unable to copy to clipboard.");
                  }
                }}
                onDecodeGenerated={() => {
                  setJwtInput(jwtOutput.trim());
                  setSuccess("Moved generated JWT into decoder.");
                  setError();
                  setExpanded({ decode: true, encode: false });
                }}
                clearStatus={clearStatus}
              />
            </AccordionDetails>
          </Accordion>
        </Stack>
      </PageContainer>

      <Box
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300,
          px: 2,
          pt: 1.25,
          pb: "calc(12px + env(safe-area-inset-bottom))",
          background:
            "linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.92) 40%, rgba(15,23,42,0.98) 100%)",
        }}
      >
       
      </Box>
    </>
  );
}
