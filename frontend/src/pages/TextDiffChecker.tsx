import React, { useEffect, useMemo, useRef, useState } from "react";
import { diffLines } from "diff";

import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Divider,
    FormControlLabel,
    Checkbox,
    Stack,
    TextField,
    Typography,
} from "@mui/material";

type LinePart = {
    value: string;
    added?: boolean;
    removed?: boolean;
};

type Row = {
    left?: { no: number; text: string };
    right?: { no: number; text: string };
    kind: "same" | "added" | "removed" | "changed";
};

const normalize = (s: string) => s.replace(/\r\n/g, "\n");
const splitLines = (v: string) => v.replace(/\n$/, "").split("\n");

// baseline height (your "original size")
const MIN_TEXTAREA_HEIGHT = 320;

function getTextarea(root: HTMLDivElement | null) {
    return root?.querySelector("textarea") as HTMLTextAreaElement | null;
}

const TextDiffChecker: React.FC = () => {
    const [leftText, setLeftText] = useState("");
    const [rightText, setRightText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [onlyChanges, setOnlyChanges] = useState(false);
    const [mode, setMode] = useState<"edit" | "compare">("edit");

    // Sync height between the two textareas
    const leftRootRef = useRef<HTMLDivElement | null>(null);
    const rightRootRef = useRef<HTMLDivElement | null>(null);
    const [syncedHeight, setSyncedHeight] = useState<number>(MIN_TEXTAREA_HEIGHT);

    // When clicking a diff line, we jump to that line in edit mode.
    const [pendingJump, setPendingJump] = useState<null | {
        side: "left" | "right";
        lineNo: number;
    }>(null);

    const hasInput = leftText.trim().length > 0 || rightText.trim().length > 0;

    /* =========================
       Caret helpers
       ========================= */

    const indexAtLineStart = (text: string, lineNo: number) => {
        // lineNo is 1-based
        if (lineNo <= 1) return 0;

        let idx = 0;
        let current = 1;

        while (current < lineNo) {
            const next = text.indexOf("\n", idx);
            if (next === -1) return text.length; // line doesn't exist -> end
            idx = next + 1;
            current += 1;
        }

        return idx;
    };

    const focusAtLine = (root: HTMLDivElement | null, text: string, lineNo: number) => {
        const ta = getTextarea(root);
        if (!ta) return;

        const pos = indexAtLineStart(text, lineNo);

        ta.focus();
        ta.setSelectionRange(pos, pos);

        // scroll caret into view (approx by line height)
        const style = getComputedStyle(ta);
        const lineHeight = parseFloat(style.lineHeight || "16") || 16;
        const paddingTop = parseFloat(style.paddingTop || "0") || 0;

        const caretLine = text.slice(0, pos).split("\n").length - 1;
        const caretY = caretLine * lineHeight + paddingTop;

        const viewTop = ta.scrollTop;
        const viewBottom = viewTop + ta.clientHeight;

        if (caretY < viewTop) {
            ta.scrollTop = Math.max(0, caretY - lineHeight * 2);
        } else if (caretY > viewBottom - lineHeight) {
            ta.scrollTop = Math.max(0, caretY - ta.clientHeight + lineHeight * 2);
        }
    };

    /**
     * Ensure caret is visible when clicking empty area (bottom) of a tall textarea.
     */
    const focusAndRevealCaret = (root: HTMLDivElement | null) => {
        const ta = getTextarea(root);
        if (!ta) return;

        ta.focus();

        const pos = ta.selectionStart ?? ta.value.length;
        ta.setSelectionRange(pos, pos);

        const style = getComputedStyle(ta);
        const lineHeight = parseFloat(style.lineHeight || "16") || 16;
        const paddingTop = parseFloat(style.paddingTop || "0") || 0;

        const caretLine = ta.value.slice(0, pos).split("\n").length - 1;
        const caretY = caretLine * lineHeight + paddingTop;

        const viewTop = ta.scrollTop;
        const viewBottom = viewTop + ta.clientHeight;

        if (caretY < viewTop) {
            ta.scrollTop = Math.max(0, caretY - lineHeight * 2);
        } else if (caretY > viewBottom - lineHeight) {
            ta.scrollTop = Math.max(0, caretY - ta.clientHeight + lineHeight * 2);
        }
    };

    /**
     * After switching to edit mode, apply pending jump (if any).
     */
    useEffect(() => {
        if (mode !== "edit" || !pendingJump) return;

        requestAnimationFrame(() => {
            if (pendingJump.side === "left") {
                focusAtLine(leftRootRef.current, leftText, pendingJump.lineNo);
            } else {
                focusAtLine(rightRootRef.current, rightText, pendingJump.lineNo);
            }
            setPendingJump(null);
        });
    }, [mode, pendingJump, leftText, rightText]);

    /* =========================
       Height sync (grows with content)
       ========================= */

    useEffect(() => {
        if (mode !== "edit") return;

        const lRoot = leftRootRef.current;
        const rRoot = rightRootRef.current;
        const l = getTextarea(lRoot);
        const r = getTextarea(rRoot);
        if (!l || !r) return;

        const compute = () => {
            // Reset to natural height first so scrollHeight reflects content only
            l.style.height = "auto";
            r.style.height = "auto";

            const next = Math.max(l.scrollHeight, r.scrollHeight, MIN_TEXTAREA_HEIGHT);

            // Avoid micro-jitter loops
            setSyncedHeight((prev) => (Math.abs(prev - next) > 2 ? next : prev));
        };

        compute();

        // Recompute on resize (wrapping changes scrollHeight)
        const ro = new ResizeObserver(() => compute());
        ro.observe(lRoot!);
        ro.observe(rRoot!);

        return () => ro.disconnect();
    }, [leftText, rightText, mode]);

    /* =========================
       Diff computation
       ========================= */

    const rows = useMemo<Row[]>(() => {
        if (!hasInput) return [];

        const parts = diffLines(normalize(leftText), normalize(rightText)) as LinePart[];
        const out: Row[] = [];

        let leftNo = 1;
        let rightNo = 1;

        const pushSameLines = (lines: string[]) => {
            for (const line of lines) {
                out.push({
                    kind: "same",
                    left: { no: leftNo++, text: line },
                    right: { no: rightNo++, text: line },
                });
            }
        };

        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];

            if (!p.added && !p.removed) {
                pushSameLines(splitLines(p.value));
                continue;
            }

            // removed + added together => "changed block"
            if (p.removed && parts[i + 1]?.added) {
                const removedLines = splitLines(p.value);
                const addedLines = splitLines(parts[i + 1].value);
                const max = Math.max(removedLines.length, addedLines.length);

                for (let k = 0; k < max; k++) {
                    const l = removedLines[k];
                    const r = addedLines[k];
                    out.push({
                        kind: "changed",
                        left: l !== undefined ? { no: leftNo++, text: l } : undefined,
                        right: r !== undefined ? { no: rightNo++, text: r } : undefined,
                    });
                }

                i++; // consume next added part
                continue;
            }

            if (p.removed) {
                for (const line of splitLines(p.value)) {
                    out.push({ kind: "removed", left: { no: leftNo++, text: line }, right: undefined });
                }
                continue;
            }

            if (p.added) {
                for (const line of splitLines(p.value)) {
                    out.push({ kind: "added", left: undefined, right: { no: rightNo++, text: line } });
                }
            }
        }

        return out;
    }, [leftText, rightText, hasInput]);

    const stats = useMemo(() => {
        let added = 0;
        let removed = 0;
        let changed = 0;
        for (const r of rows) {
            if (r.kind === "added") added++;
            else if (r.kind === "removed") removed++;
            else if (r.kind === "changed") changed++;
        }
        return { added, removed, changed };
    }, [rows]);

    const filteredRows = useMemo(() => {
        if (!onlyChanges) return rows;
        return rows.filter((r) => r.kind !== "same");
    }, [rows, onlyChanges]);

    /* =========================
       Actions
       ========================= */

    const handleClear = () => {
        setLeftText("");
        setRightText("");
        setError(null);
        setOnlyChanges(false);
        setMode("edit");

        // Reset height to original baseline
        setSyncedHeight(MIN_TEXTAREA_HEIGHT);

        // Reset internal textarea scroll
        const l = getTextarea(leftRootRef.current);
        const r = getTextarea(rightRootRef.current);
        if (l) {
            l.scrollTop = 0;
            l.style.height = "auto";
        }
        if (r) {
            r.scrollTop = 0;
            r.style.height = "auto";
        }
    };

    const handleSwap = () => {
        setLeftText(rightText);
        setRightText(leftText);
        setError(null);
        setMode("edit");
    };

    const handleCompare = () => {
        if (!leftText.trim() && !rightText.trim()) {
            setError("Please paste text in at least one side to compare.");
            return;
        }
        setError(null);
        setMode("compare");
    };

    /* =========================
       Styles
       ========================= */

    const cellBaseSx = {
        px: 1.25,
        py: 0.75,
        whiteSpace: "pre-wrap" as const,
        wordBreak: "break-word" as const,
        fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.6,
        minHeight: 32,
    };

    const lineNoSx = {
        px: 1,
        py: 0.75,
        color: "text.secondary",
        textAlign: "right" as const,
        borderRight: "1px solid rgba(255,255,255,0.08)",
        userSelect: "none" as const,
        fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 12,
        minHeight: 32,
    };

    const rowBg = (kind: Row["kind"]) => {
        if (kind === "added") return "rgba(34,197,94,0.14)";
        if (kind === "removed") return "rgba(239,68,68,0.14)";
        if (kind === "changed") return "rgba(234,179,8,0.14)";
        return "transparent";
    };

    const leftBorder = (kind: Row["kind"]) => {
        if (kind === "added") return "4px solid rgba(34,197,94,0.7)";
        if (kind === "removed") return "4px solid rgba(239,68,68,0.7)";
        if (kind === "changed") return "4px solid rgba(234,179,8,0.75)";
        return "4px solid transparent";
    };

    /* =========================
       Render
       ========================= */

    return (
        <Card sx={{ maxWidth: 1100, mx: "auto", mt: 6 }}>
            <CardContent>
                <Stack spacing={3}>
                    <Typography variant="h5" fontWeight={700}>
                        Text Difference Checker
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                        Works offline after you&apos;ve opened it once while connected. Compare two versions of text in your
                        browser — nothing is uploaded.
                    </Typography>

                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems="center">
                        <Button variant="outlined" onClick={handleSwap} sx={{ textTransform: "none" }}>
                            Swap
                        </Button>
                        <Button variant="outlined" onClick={handleClear} sx={{ textTransform: "none" }}>
                            Clear
                        </Button>

                        <FormControlLabel
                            sx={{ ml: { xs: 0, md: 1 } }}
                            control={
                                <Checkbox
                                    checked={onlyChanges}
                                    onChange={(e) => setOnlyChanges(e.target.checked)}
                                    disabled={mode !== "compare"}
                                />
                            }
                            label="Show only changed lines"
                        />

                        <Box sx={{ flex: 1 }} />

                        <Button variant="contained" onClick={handleCompare} sx={{ textTransform: "none", fontWeight: 600 }}>
                            Compare
                        </Button>
                    </Stack>

                    {error && <Alert severity="error">{error}</Alert>}

                    {/* MAIN AREA */}
                    {mode === "edit" ? (
                        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                            <Box
                                ref={leftRootRef}
                                onMouseDown={() => focusAndRevealCaret(leftRootRef.current)}
                                sx={{ flex: 1 }}
                            >
                                <TextField
                                    label="Original (A)"
                                    placeholder="Paste the first version here…"
                                    value={leftText}
                                    onChange={(e) => {
                                        setLeftText(e.target.value);
                                        setError(null);
                                    }}
                                    multiline
                                    fullWidth
                                    minRows={12}
                                    InputProps={{
                                        sx: {
                                            "& textarea": {
                                                height: `${syncedHeight}px !important`,
                                                overflow: "auto",
                                                fontFamily:
                                                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                            },
                                        },
                                    }}
                                />
                            </Box>

                            <Box
                                ref={rightRootRef}
                                onMouseDown={() => focusAndRevealCaret(rightRootRef.current)}
                                sx={{ flex: 1 }}
                            >
                                <TextField
                                    label="Updated (B)"
                                    placeholder="Paste the second version here…"
                                    value={rightText}
                                    onChange={(e) => {
                                        setRightText(e.target.value);
                                        setError(null);
                                    }}
                                    multiline
                                    fullWidth
                                    minRows={12}
                                    InputProps={{
                                        sx: {
                                            "& textarea": {
                                                height: `${syncedHeight}px !important`,
                                                overflow: "auto",
                                                fontFamily:
                                                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                            },
                                        },
                                    }}
                                />
                            </Box>
                        </Stack>
                    ) : (
                        <>
                            <Divider />

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }}>
                                <Typography variant="subtitle1" fontWeight={700}>
                                    Side-by-side diff
                                </Typography>

                                <Typography variant="body2" color="text.secondary">
                                    Added: {stats.added} • Removed: {stats.removed} • Changed: {stats.changed}
                                </Typography>

                                <Box sx={{ flex: 1 }} />

                                <Button variant="outlined" onClick={() => setMode("edit")} sx={{ textTransform: "none" }}>
                                    Edit
                                </Button>
                            </Stack>

                            {/* Diff panel - click a line to jump to that line in edit mode */}
                            <Box
                                sx={{
                                    cursor: "default",
                                    borderRadius: 2,
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    overflow: "hidden",
                                    outline: "none",
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                                        backgroundColor: "rgba(255,255,255,0.03)",
                                    }}
                                >
                                    <Box sx={{ p: 1, fontWeight: 700 }}>A (Original)</Box>
                                    <Box sx={{ p: 1, fontWeight: 700, borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                                        B (Updated)
                                    </Box>
                                </Box>

                                {filteredRows.length === 0 ? (
                                    <Box sx={{ p: 2 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            No differences to show.
                                        </Typography>
                                    </Box>
                                ) : (
                                    filteredRows.map((r, idx) => (
                                        <Box
                                            key={`${idx}-${r.left?.no ?? "x"}-${r.right?.no ?? "y"}`}
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: "1fr 1fr",
                                                backgroundColor: rowBg(r.kind),
                                                borderLeft: leftBorder(r.kind),
                                                borderBottom: "1px solid rgba(255,255,255,0.08)",
                                            }}
                                        >
                                            {/* Left */}
                                            <Box
                                                sx={{
                                                    display: "grid",
                                                    gridTemplateColumns: "56px 1fr",
                                                    cursor: r.left ? "pointer" : "default",
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!r.left) return;
                                                    setPendingJump({ side: "left", lineNo: r.left.no });
                                                    setMode("edit");
                                                }}
                                            >
                                                <Box sx={lineNoSx}>{r.left?.no ?? ""}</Box>
                                                <Box
                                                    sx={{
                                                        ...cellBaseSx,
                                                        opacity: r.kind === "added" ? 0.55 : 1,
                                                        textDecoration: r.kind === "removed" ? "line-through" : "none",
                                                    }}
                                                >
                                                    {r.left?.text ?? " "}
                                                </Box>
                                            </Box>

                                            {/* Right */}
                                            <Box
                                                sx={{
                                                    display: "grid",
                                                    gridTemplateColumns: "56px 1fr",
                                                    borderLeft: "1px solid rgba(255,255,255,0.08)",
                                                    cursor: r.right ? "pointer" : "default",
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!r.right) return;
                                                    setPendingJump({ side: "right", lineNo: r.right.no });
                                                    setMode("edit");
                                                }}
                                            >
                                                <Box sx={lineNoSx}>{r.right?.no ?? ""}</Box>
                                                <Box sx={{ ...cellBaseSx, opacity: r.kind === "removed" ? 0.55 : 1 }}>
                                                    {r.right?.text ?? " "}
                                                </Box>
                                            </Box>
                                        </Box>
                                    ))
                                )}
                            </Box>

                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                Click a line on the left or right to jump into the editor at that line. Green = added, Red = removed,
                                Yellow = modified block.
                            </Typography>
                        </>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
};

export default TextDiffChecker;
