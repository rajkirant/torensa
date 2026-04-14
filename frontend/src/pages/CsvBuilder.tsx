import React, { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import TableRowsIcon from "@mui/icons-material/TableRows";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PageContainer from "../components/PageContainer";
import FilePickerButton from "../components/inputs/FilePickerButton";
import downloadBlob from "../utils/downloadBlob";
import { apiFetch } from "../utils/api";
import { useAuth } from "../utils/auth";

type Mode = "choose" | "new" | "from-text" | "from-csv";

type CsvData = {
  headers: string[];
  rows: string[][];
};

type SavedCsvMeta = {
  id: number;
  name: string;
  updated_at: string;
};

// ─── CSV parsing ────────────────────────────────────────────────────────────

function parseCsvText(text: string): CsvData {
  const normalised = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalised.split("\n").filter((l) => l.trim());

  if (lines.length === 0) throw new Error("No data found in the CSV text.");

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseRow(lines[0]);
  if (headers.every((h) => !h)) throw new Error("Header row is empty.");

  const rows = lines.slice(1).map(parseRow);
  const colCount = headers.length;
  const normalisedRows = rows.map((r) => {
    while (r.length < colCount) r.push("");
    return r.slice(0, colCount);
  });

  return { headers, rows: normalisedRows };
}

function parseCsvFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

function toCsvString(data: CsvData): string {
  const escapeCell = (cell: string) => {
    if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };
  const lines = [
    data.headers.map(escapeCell).join(","),
    ...data.rows.map((row) => row.map(escapeCell).join(",")),
  ];
  return lines.join("\n");
}

// ─── Mode selector card ───────────────────────────────────────────────────────

function ModeCard({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={(theme) => ({
        flex: 1,
        minWidth: 160,
        p: 3,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        cursor: "pointer",
        textAlign: "center",
        transition: "border-color 0.15s, background-color 0.15s",
        "&:hover": {
          borderColor: "primary.main",
          bgcolor: theme.dropzone?.active ?? "action.hover",
        },
      })}
    >
      <Box sx={{ fontSize: 36, mb: 1, color: "primary.main" }}>{icon}</Box>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );
}

// ─── Spreadsheet editor ───────────────────────────────────────────────────────

function SpreadsheetEditor({
  data,
  onChange,
}: {
  data: CsvData;
  onChange: (data: CsvData) => void;
}) {
  const [editingHeader, setEditingHeader] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [draftValue, setDraftValue] = useState("");

  const startEditHeader = (colIdx: number) => {
    setEditingHeader(colIdx);
    setEditingCell(null);
    setDraftValue(data.headers[colIdx]);
  };

  const commitHeader = () => {
    if (editingHeader === null) return;
    const newHeaders = [...data.headers];
    newHeaders[editingHeader] = draftValue;
    onChange({ ...data, headers: newHeaders });
    setEditingHeader(null);
  };

  const startEditCell = (rowIdx: number, colIdx: number) => {
    setEditingCell({ row: rowIdx, col: colIdx });
    setEditingHeader(null);
    setDraftValue(data.rows[rowIdx][colIdx]);
  };

  const commitCell = () => {
    if (!editingCell) return;
    const newRows = data.rows.map((r) => [...r]);
    newRows[editingCell.row][editingCell.col] = draftValue;
    onChange({ ...data, rows: newRows });
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingHeader(null);
    setEditingCell(null);
  };

  const addColumn = () => {
    const newHeaders = [...data.headers, `Column ${data.headers.length + 1}`];
    const newRows = data.rows.map((r) => [...r, ""]);
    onChange({ headers: newHeaders, rows: newRows });
  };

  const deleteColumn = (colIdx: number) => {
    const newHeaders = data.headers.filter((_, i) => i !== colIdx);
    const newRows = data.rows.map((r) => r.filter((_, i) => i !== colIdx));
    onChange({ headers: newHeaders, rows: newRows });
  };

  const addRow = () => {
    const newRows = [...data.rows, Array(data.headers.length).fill("")];
    onChange({ ...data, rows: newRows });
  };

  const deleteRow = (rowIdx: number) => {
    const newRows = data.rows.filter((_, i) => i !== rowIdx);
    onChange({ ...data, rows: newRows });
  };

  const handleKeyDown = (e: React.KeyboardEvent, commitFn: () => void) => {
    if (e.key === "Enter") commitFn();
    if (e.key === "Escape") cancelEdit();
  };

  const colCount = data.headers.length;

  return (
    <Box>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          maxHeight: 420,
          overflowY: "auto",
          borderRadius: 2,
          "& .MuiTableCell-root": { py: 0.5, px: 1 },
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  width: 36,
                  bgcolor: "action.hover",
                  borderRight: "1px solid",
                  borderColor: "divider",
                  color: "text.disabled",
                  fontSize: 11,
                  textAlign: "center",
                }}
              >
                #
              </TableCell>

              {data.headers.map((header, colIdx) => (
                <TableCell
                  key={colIdx}
                  sx={{
                    minWidth: 120,
                    fontWeight: 700,
                    bgcolor: "action.hover",
                    borderRight: "1px solid",
                    borderColor: "divider",
                    whiteSpace: "nowrap",
                    position: "relative",
                  }}
                >
                  {editingHeader === colIdx ? (
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <TextField
                        autoFocus
                        size="small"
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, commitHeader)}
                        variant="standard"
                        sx={{ "& input": { fontSize: 13, fontWeight: 700 } }}
                      />
                      <IconButton size="small" onClick={commitHeader}>
                        <CheckIcon fontSize="inherit" />
                      </IconButton>
                      <IconButton size="small" onClick={cancelEdit}>
                        <CloseIcon fontSize="inherit" />
                      </IconButton>
                    </Stack>
                  ) : (
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <span style={{ flex: 1 }}>{header || "(empty)"}</span>
                      <Tooltip title="Rename column">
                        <IconButton
                          size="small"
                          onClick={() => startEditHeader(colIdx)}
                          sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
                        >
                          <EditIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                      {colCount > 1 && (
                        <Tooltip title="Delete column">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => deleteColumn(colIdx)}
                            sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
                          >
                            <DeleteIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  )}
                </TableCell>
              ))}

              <TableCell sx={{ bgcolor: "action.hover", width: 44, textAlign: "center" }}>
                <Tooltip title="Add column">
                  <IconButton size="small" onClick={addColumn} color="primary">
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {data.rows.map((row, rowIdx) => (
              <TableRow key={rowIdx} hover>
                <TableCell
                  sx={{
                    color: "text.disabled",
                    fontSize: 11,
                    textAlign: "center",
                    borderRight: "1px solid",
                    borderColor: "divider",
                    userSelect: "none",
                  }}
                >
                  {rowIdx + 1}
                </TableCell>

                {row.map((cell, colIdx) => (
                  <TableCell
                    key={colIdx}
                    sx={{
                      borderRight: "1px solid",
                      borderColor: "divider",
                      cursor: "text",
                      minWidth: 120,
                    }}
                    onClick={() => startEditCell(rowIdx, colIdx)}
                  >
                    {editingCell?.row === rowIdx && editingCell?.col === colIdx ? (
                      <TextField
                        autoFocus
                        size="small"
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, commitCell)}
                        onBlur={commitCell}
                        variant="standard"
                        sx={{ "& input": { fontSize: 13 } }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span style={{ fontSize: 13 }}>{cell}</span>
                    )}
                  </TableCell>
                ))}

                <TableCell sx={{ textAlign: "center" }}>
                  <Tooltip title="Delete row">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => deleteRow(rowIdx)}
                      sx={{ opacity: 0.4, "&:hover": { opacity: 1 } }}
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={addRow}
        sx={{ mt: 1, textTransform: "none" }}
      >
        Add row
      </Button>
    </Box>
  );
}

// ─── Save dialog ─────────────────────────────────────────────────────────────

function SaveDialog({
  open,
  initialName,
  onClose,
  onSave,
}: {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Save CSV</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="File name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSave(name.trim());
          }}
          sx={{ mt: 1 }}
          helperText="Saving with an existing name will overwrite it."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: "none" }}>
          Cancel
        </Button>
        <Button
          onClick={() => name.trim() && onSave(name.trim())}
          variant="contained"
          disabled={!name.trim()}
          sx={{ textTransform: "none" }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Load dialog ─────────────────────────────────────────────────────────────

function LoadDialog({
  open,
  onClose,
  onLoad,
}: {
  open: boolean;
  onClose: () => void;
  onLoad: (id: number, name: string) => void;
}) {
  const [list, setList] = useState<SavedCsvMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/csv/");
      if (!res.ok) throw new Error("Failed to load saved CSVs.");
      const data: SavedCsvMeta[] = await res.json();
      setList(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchList();
  }, [open, fetchList]);

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await apiFetch(`/api/csv/${id}/`, { method: "DELETE" });
      setList((prev) => prev.filter((f) => f.id !== id));
    } catch {
      setError("Failed to delete.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Load saved CSV</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}
        {!loading && !error && list.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: "center" }}>
            No saved CSVs yet.
          </Typography>
        )}
        {!loading && list.map((item, idx) => (
          <Box key={item.id}>
            {idx > 0 && <Divider />}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ px: 2, py: 1.5 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {item.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(item.updated_at).toLocaleString()}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="contained"
                onClick={() => onLoad(item.id, item.name)}
                sx={{ textTransform: "none", flexShrink: 0 }}
              >
                Open
              </Button>
              <Tooltip title="Delete">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(item.id)}
                    disabled={deleting === item.id}
                  >
                    {deleting === item.id ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <DeleteIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const CsvBuilderContent: React.FC = () => {
  const { user } = useAuth();
  const isLoggedIn = !!user;

  const [mode, setMode] = useState<Mode>("choose");
  const [pastedText, setPastedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<CsvData | null>(null);

  // Cloud save state
  const [currentSaveName, setCurrentSaveName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMode("choose");
    setCsvData(null);
    setError(null);
    setSaveSuccess(null);
    setPastedText("");
    setCurrentSaveName("");
  };

  // ── New blank CSV ────────────────────────────────────────────────────────
  const startNew = () => {
    setCsvData({
      headers: ["Column 1", "Column 2", "Column 3"],
      rows: [["", "", ""], ["", "", ""]],
    });
    setCurrentSaveName("");
    setMode("new");
    setError(null);
  };

  // ── From pasted text ─────────────────────────────────────────────────────
  const handleParseText = () => {
    setError(null);
    try {
      const data = parseCsvText(pastedText);
      setCsvData(data);
      setCurrentSaveName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse text.");
    }
  };

  // ── From uploaded CSV file ───────────────────────────────────────────────
  const handleFileUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setError("Please upload a .csv file.");
      return;
    }
    setError(null);
    try {
      const text = await parseCsvFile(file);
      const data = parseCsvText(text);
      setCsvData(data);
      setCurrentSaveName(file.name.replace(/\.csv$/i, ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file.");
    }
  };

  // ── Download ─────────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!csvData) return;
    const csvString = toCsvString(csvData);
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const fileName = currentSaveName ? `${currentSaveName}.csv` : "data.csv";
    downloadBlob(blob, fileName);
  };

  // ── Cloud save ───────────────────────────────────────────────────────────
  const handleSave = async (name: string) => {
    if (!csvData) return;
    setSaveDialogOpen(false);
    setSaving(true);
    setSaveSuccess(null);
    setError(null);
    try {
      const csvString = toCsvString(csvData);
      const res = await apiFetch("/api/csv/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content: csvString }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save.");
        return;
      }
      setCurrentSaveName(name);
      setSaveSuccess(`Saved as "${name}"`);
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // ── Cloud load ───────────────────────────────────────────────────────────
  const handleLoad = async (id: number, name: string) => {
    setLoadDialogOpen(false);
    setError(null);
    setSaveSuccess(null);
    try {
      const res = await apiFetch(`/api/csv/${id}/`);
      if (!res.ok) throw new Error("Failed to load.");
      const data = await res.json();
      const parsed = parseCsvText(data.content);
      setCsvData(parsed);
      setCurrentSaveName(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    }
  };

  // ── Spreadsheet view ─────────────────────────────────────────────────────
  if (csvData) {
    return (
      <Stack spacing={2.5}>
        {/* Top bar */}
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" gap={1}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {currentSaveName ? (
              <strong>{currentSaveName}</strong>
            ) : null}
            {" "}
            {csvData.headers.length} col{csvData.headers.length !== 1 ? "s" : ""},{" "}
            {csvData.rows.length} row{csvData.rows.length !== 1 ? "s" : ""}
          </Typography>

          {isLoggedIn && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<FolderOpenIcon />}
              onClick={() => setLoadDialogOpen(true)}
              sx={{ textTransform: "none" }}
            >
              My CSVs
            </Button>
          )}

          <Button
            size="small"
            variant="outlined"
            onClick={reset}
            sx={{ textTransform: "none" }}
          >
            Start over
          </Button>
        </Stack>

        <SpreadsheetEditor data={csvData} onChange={setCsvData} />

        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        {saveSuccess && (
          <Alert severity="success" onClose={() => setSaveSuccess(null)}>
            {saveSuccess}
          </Alert>
        )}

        {/* Action buttons */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          {isLoggedIn && (
            <Button
              variant="outlined"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={() => setSaveDialogOpen(true)}
              disabled={saving}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, flex: 1 }}
            >
              {saving ? "Saving…" : "Save to account"}
            </Button>
          )}

          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, flex: 1 }}
          >
            Download CSV
          </Button>
        </Stack>

        {!isLoggedIn && (
          <Typography variant="caption" color="text.secondary" textAlign="center">
            <a href="/login" style={{ color: "inherit" }}>Log in</a> to save CSVs to your account.
          </Typography>
        )}

        <SaveDialog
          open={saveDialogOpen}
          initialName={currentSaveName}
          onClose={() => setSaveDialogOpen(false)}
          onSave={handleSave}
        />

        <LoadDialog
          open={loadDialogOpen}
          onClose={() => setLoadDialogOpen(false)}
          onLoad={handleLoad}
        />
      </Stack>
    );
  }

  // ── Mode chooser ──────────────────────────────────────────────────────────
  if (mode === "choose") {
    return (
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap">
          <ModeCard
            icon={<TableRowsIcon fontSize="inherit" />}
            label="Start new CSV"
            description="Create a blank spreadsheet from scratch"
            onClick={startNew}
          />
          <ModeCard
            icon={<TextSnippetIcon fontSize="inherit" />}
            label="From text"
            description="Paste CSV text and convert it to a spreadsheet"
            onClick={() => { setMode("from-text"); setError(null); }}
          />
          <ModeCard
            icon={<UploadFileIcon fontSize="inherit" />}
            label="From existing CSV"
            description="Upload a .csv file and edit it"
            onClick={() => { setMode("from-csv"); setError(null); }}
          />
        </Stack>

        {isLoggedIn && (
          <>
            <Divider />
            <Stack direction="row" justifyContent="center">
              <Button
                variant="outlined"
                startIcon={<FolderOpenIcon />}
                onClick={() => setLoadDialogOpen(true)}
                sx={{ textTransform: "none" }}
              >
                Open saved CSV
              </Button>
            </Stack>
          </>
        )}

        <LoadDialog
          open={loadDialogOpen}
          onClose={() => setLoadDialogOpen(false)}
          onLoad={handleLoad}
        />
      </Stack>
    );
  }

  // ── From text ─────────────────────────────────────────────────────────────
  if (mode === "from-text") {
    return (
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button
            size="small"
            variant="text"
            onClick={reset}
            sx={{ textTransform: "none", ml: -0.5 }}
          >
            ← Back
          </Button>
          <Typography variant="subtitle2" color="text.secondary">
            Paste CSV text
          </Typography>
        </Stack>

        <TextField
          multiline
          minRows={8}
          maxRows={16}
          fullWidth
          placeholder={`name,email,city\nAlice,alice@example.com,Amsterdam\nBob,bob@example.com,Berlin`}
          value={pastedText}
          onChange={(e) => { setPastedText(e.target.value); setError(null); }}
          inputProps={{ style: { fontFamily: "monospace", fontSize: 13 } }}
          helperText="First row is treated as headers. Separate columns with commas."
        />

        {error && <Alert severity="error">{error}</Alert>}

        <Button
          variant="contained"
          disabled={!pastedText.trim()}
          onClick={handleParseText}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
        >
          Build spreadsheet
        </Button>
      </Stack>
    );
  }

  // ── From CSV file ─────────────────────────────────────────────────────────
  if (mode === "from-csv") {
    return (
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button
            size="small"
            variant="text"
            onClick={reset}
            sx={{ textTransform: "none", ml: -0.5 }}
          >
            ← Back
          </Button>
          <Typography variant="subtitle2" color="text.secondary">
            Upload a CSV file
          </Typography>
        </Stack>

        <Box
          sx={(theme) => ({
            p: 4,
            borderRadius: 2,
            border: "2px dashed",
            borderColor: "divider",
            textAlign: "center",
            bgcolor: theme.dropzone?.background ?? "transparent",
            "&:hover": {
              borderColor: "primary.main",
              bgcolor: theme.dropzone?.active ?? "action.hover",
            },
          })}
        >
          <UploadFileIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1 }} />
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Choose a .csv file from your device
          </Typography>
          <FilePickerButton
            variant="contained"
            label="Browse file"
            accept=".csv"
            onFilesSelected={handleFileUpload}
            inputRef={fileInputRef}
            resetAfterSelect
          />
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    );
  }

  return null;
};

const CsvBuilder: React.FC = () => (
  <PageContainer maxWidth={900}>
    <CsvBuilderContent />
  </PageContainer>
);

export default CsvBuilder;
