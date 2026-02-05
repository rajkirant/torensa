import React, { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    FormControlLabel,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import PageContainer from "../components/PageContainer";

const generateUuid = () => crypto.randomUUID();

const UuidGenerator: React.FC = () => {
    const [count, setCount] = useState(1);
    const [uppercase, setUppercase] = useState(false);
    const [noHyphens, setNoHyphens] = useState(false);
    const [uuids, setUuids] = useState<string[]>([]);
    const [info, setInfo] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const format = (uuid: string) => {
        let v = uuid;
        if (noHyphens) v = v.replace(/-/g, "");
        if (uppercase) v = v.toUpperCase();
        return v;
    };

    const generate = () => {
        setError(null);
        setInfo(null);

        if (!Number.isInteger(count) || count < 1 || count > 1000) {
            setError("Count must be between 1 and 1000.");
            return;
        }

        const list = Array.from({ length: count }, () => format(generateUuid()));
        setUuids(list);
        setInfo(`Generated ${list.length} UUID${list.length > 1 ? "s" : ""}.`);
    };

    const copyAll = async () => {
        try {
            await navigator.clipboard.writeText(uuids.join("\n"));
            setInfo("Copied all UUIDs.");
        } catch {
            setError("Failed to copy to clipboard.");
        }
    };

    return (
        <PageContainer maxWidth={720}>



                    <Typography variant="body2" color="text.secondary">
                        Generate UUID v4 values locally in your browser — nothing is uploaded.
                    </Typography>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <TextField
                            label="Count"
                            type="number"
                            value={count}
                            onChange={(e) => setCount(Number(e.target.value))}
                            inputProps={{ min: 1, max: 1000 }}
                            sx={{ maxWidth: 160 }}
                            helperText="1 – 1000"
                        />

                        <Stack spacing={1}>
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

                        <Button
                            variant="contained"
                            onClick={generate}
                            sx={{ textTransform: "none", fontWeight: 600 }}
                        >
                            Generate
                        </Button>
                    </Stack>

                    {error && <Alert severity="error">{error}</Alert>}
                    {info && <Alert severity="success">{info}</Alert>}

                    {uuids.length > 0 && (
                        <>
                            <TextField
                                label="Generated UUIDs"
                                value={uuids.join("\n")}
                                multiline
                                minRows={Math.min(10, uuids.length)}
                                fullWidth
                                InputProps={{
                                    readOnly: true,
                                    sx: {
                                        fontFamily:
                                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                    },
                                }}
                            />

                            <Stack direction="row" spacing={1}>
                                <Button
                                    variant="outlined"
                                    onClick={copyAll}
                                    sx={{ textTransform: "none" }}
                                >
                                    Copy all
                                </Button>

                                <Button
                                    variant="outlined"
                                    onClick={() => setUuids([])}
                                    sx={{ textTransform: "none" }}
                                >
                                    Clear
                                </Button>
                            </Stack>
                        </>
                    )}

            </PageContainer>
    );
};

export default UuidGenerator;
