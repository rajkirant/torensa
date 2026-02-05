import React, { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Divider,
    FormControlLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import { SignJWT, decodeProtectedHeader, decodeJwt } from "jose";
import PageContainer from "../components/PageContainer";

/* =========================
   Helpers
   ========================= */

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

const formatEpochSec = (epochSec: number) =>
    new Date(epochSec * 1000).toLocaleString();

const isEpochSeconds = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 && v < 99999999999;

type HoverTip = { x: number; y: number; text: string } | null;

/**
 * Renders JSON with hoverable exp/iat/nbf values.
 * Fixed UI issue:
 * - use overflow:auto container
 * - ensure pre respects wrapping and doesn't shrink to tiny column
 * - remove any "fixed width" behavior by giving it fullWidth in grid/flex
 */
function JsonWithTimeTooltips({
                                  obj,
                                  onHover,
                              }: {
    obj: any;
    onHover: (tip: HoverTip) => void;
}) {
    const renderValue = (
        key: string | null,
        value: any,
        indent: number,
    ): React.ReactNode => {
        const pad = " ".repeat(indent);

        if (value === null) return <span>null</span>;
        if (typeof value === "string") return <span>"{value}"</span>;
        if (typeof value === "boolean") return <span>{value ? "true" : "false"}</span>;

        if (typeof value === "number") {
            const isTimeKey = key === "exp" || key === "iat" || key === "nbf";
            if (isTimeKey && isEpochSeconds(value)) {
                return (
                    <span
                        style={{
                            textDecoration: "underline dotted",
                            cursor: "help",
                        }}
                        onMouseMove={(e) => {
                            onHover({
                                x: e.clientX + 12,
                                y: e.clientY + 12,
                                text: `${key}: ${formatEpochSec(value)} (${value})`,
                            });
                        }}
                        onMouseLeave={() => onHover(null)}
                    >
            {value}
          </span>
                );
            }
            return <span>{value}</span>;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) return <span>[]</span>;
            return (
                <>
                    <span>[</span>
                    {"\n"}
                    {value.map((item, idx) => (
                        <React.Fragment key={idx}>
                            {pad}
                            {"  "}
                            {renderValue(null, item, indent + 2)}
                            {idx < value.length - 1 ? "," : ""}
                            {"\n"}
                        </React.Fragment>
                    ))}
                    {pad}
                    <span>]</span>
                </>
            );
        }

        const entries = Object.entries(value ?? {});
        if (entries.length === 0) return <span>{"{}"}</span>;

        return (
            <>
                <span>{"{"}</span>
                {"\n"}
                {entries.map(([k, v], idx) => (
                    <React.Fragment key={k}>
                        {pad}
                        {"  "}
                        <span>"{k}"</span>: {renderValue(k, v, indent + 2)}
                        {idx < entries.length - 1 ? "," : ""}
                        {"\n"}
                    </React.Fragment>
                ))}
                {pad}
                <span>{"}"}</span>
            </>
        );
    };

    return (
        <pre
            style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 13,
                lineHeight: 1.6,
            }}
            onMouseLeave={() => onHover(null)}
        >
      {renderValue(null, obj, 0)}
    </pre>
    );
}

/* =========================
   Component
   ========================= */

const JwtTool: React.FC = () => {
    const [jwtInput, setJwtInput] = useState("");

    // Encode inputs
    const [alg, setAlg] = useState<"HS256" | "HS512">("HS256");
    const [headerText, setHeaderText] = useState(prettyJson({ typ: "JWT" }));
    const [payloadText, setPayloadText] = useState(
        prettyJson({
            sub: "1234567890",
            name: "John Doe",
        }),
    );
    const [secret, setSecret] = useState("your-256-bit-secret");

    // Time helpers (encode)
    const [autoIat, setAutoIat] = useState(true);
    const [useExpiry, setUseExpiry] = useState(true);
    const [expiryDateLocal, setExpiryDateLocal] = useState(() => {
        const now = Math.floor(Date.now() / 1000);
        return toIsoLocalForInput(now + 60 * 60);
    });

    const [jwtOutput, setJwtOutput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    const [hoverTip, setHoverTip] = useState<HoverTip>(null);

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

    const handleDecodeToInputs = () => {
        if (!decoded) return;

        const tokenAlg = (decoded.header as any)?.alg;
        if (tokenAlg === "HS256" || tokenAlg === "HS512") setAlg(tokenAlg);

        const { alg: _drop, ...restHeader } = decoded.header as any;
        setHeaderText(prettyJson(restHeader));
        setPayloadText(prettyJson(decoded.payload));

        setInfo("Loaded decoded header/payload into encoder fields.");
        setError(null);

        const exp = (decoded.payload as any)?.exp;
        if (isFiniteNumber(exp)) {
            setUseExpiry(true);
            setExpiryDateLocal(toIsoLocalForInput(exp));
        }
    };

    const handleEncode = async () => {
        setError(null);
        setInfo(null);

        try {
            const headerObj = safeParseJson(headerText) as any;
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
                .setProtectedHeader({ ...headerObj, alg })
                .sign(new TextEncoder().encode(secret));

            setJwtOutput(token);
            setInfo(`JWT generated successfully (${alg}).`);
        } catch (e: any) {
            setError(e?.message ?? "Failed to generate JWT. Check your JSON and secret.");
        }
    };

    const handleClear = () => {
        setJwtInput("");
        setJwtOutput("");
        setError(null);
        setInfo(null);
        setHoverTip(null);
    };

    return (
        <PageContainer maxWidth={980}>
                <Stack spacing={3}>
                    <Typography variant="h5" fontWeight={700}>
                        JWT Encoder / Decoder
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                        Works in your browser — nothing is uploaded. Decode JWTs and generate HS256/HS512 tokens
                        from your header/payload/secret.
                    </Typography>

                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems="center">
                        <Button variant="outlined" onClick={handleClear} sx={{ textTransform: "none" }}>
                            Clear
                        </Button>
                        <Box sx={{ flex: 1 }} />
                        <Button
                            variant="contained"
                            onClick={handleEncode}
                            sx={{ textTransform: "none", fontWeight: 600 }}
                        >
                            Generate JWT
                        </Button>
                    </Stack>

                    {error && <Alert severity="error">{error}</Alert>}
                    {info && <Alert severity="success">{info}</Alert>}

                    {/* Decode */}
                    <Stack spacing={1.5}>
                        <Typography variant="subtitle1" fontWeight={700}>
                            Decode
                        </Typography>

                        <TextField
                            label="JWT"
                            placeholder="Paste a JWT here…"
                            value={jwtInput}
                            onChange={(e) => {
                                setJwtInput(e.target.value);
                                setError(null);
                                setInfo(null);
                            }}
                            fullWidth
                            multiline
                            minRows={3}
                        />

                        <Stack direction="row" spacing={1} flexWrap="wrap">
                            <Button
                                variant="outlined"
                                sx={{ textTransform: "none" }}
                                disabled={!jwtInput.trim()}
                                onClick={async () => {
                                    try {
                                        await copyToClipboard(jwtInput.trim());
                                        setInfo("Copied JWT input.");
                                    } catch {
                                        setError("Unable to copy to clipboard.");
                                    }
                                }}
                            >
                                Copy JWT
                            </Button>

                            <Button
                                variant="outlined"
                                sx={{ textTransform: "none" }}
                                disabled={!decoded}
                                onClick={handleDecodeToInputs}
                            >
                                Use decoded values in encoder
                            </Button>
                        </Stack>

                        {/* FIX: Use a responsive grid so payload doesn't collapse to a thin column */}
                        {decoded ? (
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                                    gap: 2,
                                    alignItems: "stretch",
                                }}
                            >
                                <TextField
                                    label="Header (decoded)"
                                    value={prettyJson(decoded.header)}
                                    fullWidth
                                    multiline
                                    minRows={10}
                                    InputProps={{
                                        readOnly: true,
                                        sx: {
                                            "& textarea": {
                                                fontFamily:
                                                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                            },
                                        },
                                    }}
                                />

                                <Box sx={{ position: "relative", minWidth: 0 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Payload (decoded) — hover exp/iat/nbf values for date
                                    </Typography>

                                    <Box
                                        sx={{
                                            mt: 0.75,
                                            p: 2,
                                            borderRadius: 2,
                                            border: "1px solid rgba(255,255,255,0.12)",
                                            backgroundColor: "rgba(255,255,255,0.03)",
                                            minHeight: 260,
                                            width: "100%",
                                            minWidth: 0,
                                            overflow: "auto",
                                        }}
                                    >
                                        <JsonWithTimeTooltips obj={decoded.payload} onHover={setHoverTip} />
                                    </Box>
                                </Box>

                                {/* Tooltip (fixed position, outside grid flow) */}
                                {hoverTip && (
                                    <Box
                                        sx={{
                                            position: "fixed",
                                            left: hoverTip.x,
                                            top: hoverTip.y,
                                            zIndex: 2000,
                                            pointerEvents: "none",
                                            px: 1.2,
                                            py: 0.8,
                                            borderRadius: 1,
                                            bgcolor: "rgba(0,0,0,0.85)",
                                            color: "#fff",
                                            fontSize: 12,
                                            maxWidth: 360,
                                            boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
                                        }}
                                    >
                                        {hoverTip.text}
                                    </Box>
                                )}
                            </Box>
                        ) : (
                            jwtInput.trim() && (
                                <Alert severity="warning">Could not decode this JWT (is it well-formed?).</Alert>
                            )
                        )}
                    </Stack>

                    <Divider />

                    {/* Encode */}
                    <Stack spacing={1.5}>
                        <Typography variant="subtitle1" fontWeight={700}>
                            Encode
                        </Typography>

                        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                            <Box sx={{ minWidth: 200 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Algorithm
                                </Typography>
                                <Select
                                    fullWidth
                                    size="small"
                                    value={alg}
                                    onChange={(e) => {
                                        setAlg(e.target.value as "HS256" | "HS512");
                                        setError(null);
                                        setInfo(null);
                                    }}
                                >
                                    <MenuItem value="HS256">HS256</MenuItem>
                                    <MenuItem value="HS512">HS512</MenuItem>
                                </Select>
                            </Box>

                            <Box sx={{ flex: 1 }} />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={autoIat}
                                        onChange={(e) => {
                                            setAutoIat(e.target.checked);
                                            setError(null);
                                            setInfo(null);
                                        }}
                                    />
                                }
                                label="Auto-set iat"
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={useExpiry}
                                        onChange={(e) => {
                                            setUseExpiry(e.target.checked);
                                            setError(null);
                                            setInfo(null);
                                        }}
                                    />
                                }
                                label="Set exp"
                            />
                        </Stack>

                        {useExpiry && (
                            <TextField
                                label="Expiry (local date/time)"
                                type="datetime-local"
                                value={expiryDateLocal}
                                onChange={(e) => {
                                    setExpiryDateLocal(e.target.value);
                                    setError(null);
                                    setInfo(null);
                                }}
                                fullWidth
                                helperText="Sets exp as a UNIX timestamp (seconds) behind the scenes."
                                InputLabelProps={{ shrink: true }}
                            />
                        )}

                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                                gap: 2,
                            }}
                        >
                            <TextField
                                label="Header (JSON)"
                                value={headerText}
                                onChange={(e) => {
                                    setHeaderText(e.target.value);
                                    setError(null);
                                    setInfo(null);
                                }}
                                fullWidth
                                multiline
                                minRows={8}
                            />

                            <TextField
                                label="Payload (JSON)"
                                value={payloadText}
                                onChange={(e) => {
                                    setPayloadText(e.target.value);
                                    setError(null);
                                    setInfo(null);
                                }}
                                fullWidth
                                multiline
                                minRows={8}
                            />
                        </Box>

                        <TextField
                            label="Secret"
                            value={secret}
                            onChange={(e) => {
                                setSecret(e.target.value);
                                setError(null);
                                setInfo(null);
                            }}
                            fullWidth
                            helperText="For HS256/HS512: the shared secret used to sign the token."
                        />

                        <TextField
                            label="Generated JWT"
                            value={jwtOutput}
                            fullWidth
                            multiline
                            minRows={3}
                            InputProps={{ readOnly: true }}
                        />

                        <Stack direction="row" spacing={1} flexWrap="wrap">
                            <Button
                                variant="outlined"
                                sx={{ textTransform: "none" }}
                                disabled={!jwtOutput.trim()}
                                onClick={async () => {
                                    try {
                                        await copyToClipboard(jwtOutput.trim());
                                        setInfo("Copied generated JWT.");
                                    } catch {
                                        setError("Unable to copy to clipboard.");
                                    }
                                }}
                            >
                                Copy Generated JWT
                            </Button>

                            <Button
                                variant="outlined"
                                sx={{ textTransform: "none" }}
                                disabled={!jwtOutput.trim()}
                                onClick={() => {
                                    setJwtInput(jwtOutput.trim());
                                    setInfo("Moved generated JWT into decoder.");
                                    setError(null);
                                }}
                            >
                                Decode Generated JWT
                            </Button>
                        </Stack>
                    </Stack>
                </Stack>
            </PageContainer>
    );
};

export default JwtTool;
