import {
  Box,
  Button,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  FormControlLabel,
} from "@mui/material";
import { TransparentButton } from "../../components/buttons/TransparentButton";
import FlexWrapRow from "../../components/layout/FlexWrapRow";

type EncodeAccordionProps = {
  alg: "HS256" | "HS512";
  setAlg: (value: "HS256" | "HS512") => void;
  autoIat: boolean;
  setAutoIat: (value: boolean) => void;
  useExpiry: boolean;
  setUseExpiry: (value: boolean) => void;
  expiryDateLocal: string;
  setExpiryDateLocal: (value: string) => void;
  payloadText: string;
  setPayloadText: (value: string) => void;
  secret: string;
  setSecret: (value: string) => void;
  jwtOutput: string;
  onCopyGenerated: () => Promise<void>;
  onDecodeGenerated: () => void;
  onGenerate: () => void;
  clearStatus: () => void;
};

export default function EncodeAccordion({
  alg,
  setAlg,
  autoIat,
  setAutoIat,
  useExpiry,
  setUseExpiry,
  expiryDateLocal,
  setExpiryDateLocal,
  payloadText,
  setPayloadText,
  secret,
  setSecret,
  jwtOutput,
  onCopyGenerated,
  onDecodeGenerated,
  onGenerate,
  clearStatus,
}: EncodeAccordionProps) {
  return (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "flex-end" }}
      >
        <Box sx={{ minWidth: { xs: "100%", md: 220 }, maxWidth: { md: 260 } }}>
          <Typography variant="caption" color="text.secondary">
            Algorithm
          </Typography>
          <Select
            fullWidth
            size="small"
            value={alg}
            onChange={(e) => {
              setAlg(e.target.value as "HS256" | "HS512");
              clearStatus();
            }}
          >
            <MenuItem value="HS256">HS256</MenuItem>
            <MenuItem value="HS512">HS512</MenuItem>
          </Select>
        </Box>
        {useExpiry && (
          <Box sx={{ width: { xs: "100%", md: 280 } }}>
            <TextField
              label="Expiry (local date/time)"
              type="datetime-local"
              value={expiryDateLocal}
              onChange={(e) => {
                setExpiryDateLocal(e.target.value);
                clearStatus();
              }}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        )}
        <FlexWrapRow>
          <FormControlLabel
            control={
              <Switch
                checked={autoIat}
                onChange={(e) => {
                  setAutoIat(e.target.checked);
                  clearStatus();
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
                  clearStatus();
                }}
              />
            }
            label="Set exp"
          />
        </FlexWrapRow>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 2,
        }}
      >
        <TextField
          label="Payload (JSON)"
          value={payloadText}
          onChange={(e) => {
            setPayloadText(e.target.value);
            clearStatus();
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
          clearStatus();
        }}
        fullWidth
        helperText="Shared secret used to sign HS256/HS512 tokens."
      />

      <TextField
        label="Generated JWT"
        value={jwtOutput}
        fullWidth
        multiline
        minRows={3}
        InputProps={{ readOnly: true }}
      />

      <FlexWrapRow>
        <Button
          variant="contained"
          onClick={onGenerate}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Generate JWT
        </Button>
        <TransparentButton
          label="Copy Generated JWT"
          disabled={!jwtOutput.trim()}
          onClick={() => void onCopyGenerated()}
        />
        <TransparentButton
          label="Decode Generated JWT"
          disabled={!jwtOutput.trim()}
          onClick={onDecodeGenerated}
        />
      </FlexWrapRow>
    </Stack>
  );
}
