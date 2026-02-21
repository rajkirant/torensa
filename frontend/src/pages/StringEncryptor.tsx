import { useState } from "react";
import CryptoJS from "crypto-js";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import { TransparentButton } from "../components/buttons/TransparentButton";
import { apiFetch } from "../utils/api";

type Algorithm = "CRYPTOJS_AES" | "PBKDF2_HMAC_SHA512_AES_256";

export default function StringEncryptor() {
  const [input, setInput] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [output, setOutput] = useState("");
  const [algorithm, setAlgorithm] = useState<Algorithm>("CRYPTOJS_AES");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearStatus = () => {
    setError(null);
    setSuccess(null);
  };
  const failDecrypt = (message: string) => {
    setOutput("");
    setError(message);
  };

  const encrypt = async () => {
    clearStatus();
    if (!input.trim()) return setError("Please enter text to encrypt.");
    if (!secretKey.trim()) return setError("Please enter a secret key.");

    if (algorithm === "CRYPTOJS_AES") {
      try {
        const cipher = CryptoJS.AES.encrypt(input, secretKey).toString();
        setOutput(cipher);
        setSuccess("Text encrypted successfully (CryptoJS AES).");
      } catch (e: any) {
        setError(e?.message ?? "Failed to encrypt text.");
      }
      return;
    }

    setBusy(true);
    try {
      const response = await apiFetch("/api/string-crypto/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "encrypt",
          algorithm: "PBKDF2_HMAC_SHA512_AES_256",
          text: input,
          secretKey,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "Failed to encrypt text.");
        return;
      }
      setOutput(typeof data?.output === "string" ? data.output : "");
      setSuccess("Text encrypted successfully (PBKDF2-HMAC-SHA512 + AES-256).");
    } catch {
      setError("Network error. Could not reach encryption service.");
    } finally {
      setBusy(false);
    }
  };

  const decrypt = async () => {
    clearStatus();
    if (!input.trim()) return failDecrypt("Please enter encrypted text.");
    if (!secretKey.trim()) return failDecrypt("Please enter a secret key.");

    if (algorithm === "CRYPTOJS_AES") {
      try {
        const bytes = CryptoJS.AES.decrypt(input, secretKey);
        const plain = bytes.toString(CryptoJS.enc.Utf8);
        if (!plain) {
          failDecrypt("Failed to decrypt. Check encrypted text and secret key.");
          return;
        }
        setOutput(plain);
        setSuccess("Text decrypted successfully (CryptoJS AES).");
      } catch (e: any) {
        failDecrypt(e?.message ?? "Failed to decrypt text.");
      }
      return;
    }

    setBusy(true);
    try {
      const response = await apiFetch("/api/string-crypto/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "decrypt",
          algorithm: "PBKDF2_HMAC_SHA512_AES_256",
          text: input,
          secretKey,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        failDecrypt(data?.error || "Failed to decrypt text.");
        return;
      }
      setOutput(typeof data?.output === "string" ? data.output : "");
      setSuccess("Text decrypted successfully (PBKDF2-HMAC-SHA512 + AES-256).");
    } catch {
      failDecrypt("Network error. Could not reach decryption service.");
    } finally {
      setBusy(false);
    }
  };

  const copyOutput = async () => {
    clearStatus();
    if (!output.trim()) return setError("Nothing to copy.");
    try {
      await navigator.clipboard.writeText(output);
      setSuccess("Output copied.");
    } catch {
      setError("Copy failed. Clipboard permission may be blocked.");
    }
  };

  return (
    <PageContainer maxWidth={860}>
      <Stack spacing={2}>
        <TextField
          select
          label="Algorithm"
          value={algorithm}
          onChange={(e) => {
            setAlgorithm(e.target.value as Algorithm);
            clearStatus();
          }}
          fullWidth
        >
          <MenuItem value="CRYPTOJS_AES">CryptoJS AES (Local)</MenuItem>
          <MenuItem value="PBKDF2_HMAC_SHA512_AES_256">
            PBKDF2-HMAC-SHA512 + AES-256 (Server)
          </MenuItem>
        </TextField>

        <Typography variant="body2" color="text.secondary">
          {algorithm === "CRYPTOJS_AES"
            ? "Runs fully in browser."
            : "Uses Python backend with PBKDF2-HMAC-SHA512 and AES-256-GCM."}
        </Typography>

        <TextField
          label="Input Text"
          placeholder="Enter plain text or encrypted text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            clearStatus();
          }}
          multiline
          minRows={5}
          fullWidth
        />

        <TextField
          label="Secret Key"
          type="password"
          placeholder="Enter secret key"
          value={secretKey}
          onChange={(e) => {
            setSecretKey(e.target.value);
            clearStatus();
          }}
          fullWidth
        />

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <ActionButton onClick={() => void encrypt()} loading={busy}>
            Encrypt
          </ActionButton>
          <ActionButton onClick={() => void decrypt()} loading={busy}>
            Decrypt
          </ActionButton>
          <TransparentButton label="Copy Output" onClick={() => void copyOutput()} />
          <TransparentButton
            label="Clear"
            onClick={() => {
              setInput("");
              setOutput("");
              setSecretKey("");
              clearStatus();
            }}
          />
        </Box>

        <TextField
          label="Output"
          value={output}
          onChange={(e) => setOutput(e.target.value)}
          multiline
          minRows={5}
          fullWidth
        />

        <ToolStatusAlerts error={error} success={success} />
      </Stack>
    </PageContainer>
  );
}
