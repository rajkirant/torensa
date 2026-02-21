import React, { useState } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PageContainer from "../components/PageContainer";
import { ActionButton } from "../components/buttons/ActionButton";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { TransparentButton } from "../components/buttons/TransparentButton";
import useToolStatus from "../hooks/useToolStatus";

const generateUuid = () => crypto.randomUUID();

const UuidGenerator: React.FC = () => {
  const [count, setCount] = useState(1);
  const [uppercase, setUppercase] = useState(false);
  const [noHyphens, setNoHyphens] = useState(false);
  const [uuids, setUuids] = useState<string[]>([]);
  const { error, success, setError, setSuccess, clear } = useToolStatus();

  const format = (uuid: string) => {
    let value = uuid;
    if (noHyphens) value = value.replace(/-/g, "");
    if (uppercase) value = value.toUpperCase();
    return value;
  };

  const generate = () => {
    clear();

    if (!Number.isInteger(count) || count < 1 || count > 1000) {
      setError("Count must be between 1 and 1000.");
      return;
    }

    const list = Array.from({ length: count }, () => format(generateUuid()));
    setUuids(list);
    setSuccess(`Generated ${list.length} UUID${list.length > 1 ? "s" : ""}.`);
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(uuids.join("\n"));
      setError();
      setSuccess("Copied all UUIDs.");
    } catch {
      setError("Failed to copy to clipboard.");
    }
  };

  const clearResults = () => {
    setUuids([]);
    setError();
    setSuccess("Cleared results.");
  };

  return (
    <PageContainer maxWidth={860}>
      <Stack spacing={2}>
        <Box
          sx={{
            p: { xs: 1.5, sm: 2 },
            borderRadius: 2,
            border: "1px solid rgba(59,130,246,0.35)",
            background:
              "linear-gradient(140deg, rgba(59,130,246,0.17) 0%, rgba(15,23,42,0.12) 55%, rgba(14,165,233,0.12) 100%)",
          }}
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", md: "flex-start" }}
            >
              <TextField
                label="Count"
                type="number"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                inputProps={{ min: 1, max: 1000 }}
                sx={{ width: { xs: "100%", sm: 180 } }}
                helperText="1 - 1000"
              />

              <Stack spacing={0.5}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={uppercase}
                      onChange={(e) => setUppercase(e.target.checked)}
                    />
                  }
                  label="Uppercase"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={noHyphens}
                      onChange={(e) => setNoHyphens(e.target.checked)}
                    />
                  }
                  label="Remove hyphens"
                />
              </Stack>

              <Box sx={{ flex: 1 }} />

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <ActionButton onClick={generate}>
                  Generate UUIDs
                </ActionButton>
                <TransparentButton
                  label="Copy all"
                  onClick={() => void copyAll()}
                  disabled={uuids.length === 0}
                />
                <TransparentButton
                  label="Clear"
                  onClick={clearResults}
                  disabled={uuids.length === 0}
                />
              </Stack>
            </Stack>
          </Stack>
        </Box>

        <ToolStatusAlerts error={error} success={success} />

        {uuids.length > 0 && (
          <Box
            sx={{
              borderRadius: 2,
              border: "1px solid rgba(148,163,184,0.25)",
              bgcolor: "rgba(2,6,23,0.28)",
              overflow: "hidden",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "flex-start", sm: "center" }}
              sx={{
                px: 1.5,
                py: 1.2,
                borderBottom: "1px solid rgba(148,163,184,0.2)",
              }}
            >
              <Typography variant="subtitle2" fontWeight={700}>
                Generated UUIDs
              </Typography>
              <Chip
                size="small"
                label={`${uuids.length} item${uuids.length === 1 ? "" : "s"}`}
                sx={{
                  bgcolor: "rgba(59,130,246,0.2)",
                  border: "1px solid rgba(59,130,246,0.45)",
                }}
              />
            </Stack>

            <Box sx={{ maxHeight: 360, overflow: "auto", px: 1.2, py: 0.6 }}>
              {uuids.map((id, index) => (
                <Box
                  key={`${id}-${index}`}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "50px 1fr",
                    gap: 1,
                    px: 1,
                    py: 0.9,
                    borderRadius: 1,
                    "&:nth-of-type(odd)": { bgcolor: "rgba(148,163,184,0.06)" },
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    #{index + 1}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: 13,
                      lineHeight: 1.45,
                      wordBreak: "break-all",
                    }}
                  >
                    {id}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Stack>
    </PageContainer>
  );
};

export default UuidGenerator;
