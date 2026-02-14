import React, { useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  TextField,
  Alert,
  Divider,
  IconButton,
  Chip,
  MenuItem,
  FormControlLabel,
  Checkbox,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import PageContainer from "../components/PageContainer";
import { ActionButton } from "../components/buttons/ActionButton";
import { TransparentButton } from "../components/buttons/TransparentButton";

/* ===================== TYPES ===================== */

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

type DocType = "invoice" | "receipt";

type FormState = {
  docType: DocType;
  docNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;

  sellerName: string;
  sellerDetails: string;

  billToName: string;
  billToDetails: string;

  notes: string;

  taxRate: number; // percent
  discount: number; // amount
  shipping: number; // amount

  showDueDate: boolean;
};

/* ===================== CONSTANTS ===================== */

const STORAGE_KEY = "torensa_invoice_generator_v1";

const CURRENCY_OPTIONS = [
  { code: "GBP", label: "GBP (£)" },
  { code: "USD", label: "USD ($)" },
  { code: "EUR", label: "EUR (€)" },
  { code: "CAD", label: "CAD ($)" },
  { code: "AUD", label: "AUD ($)" },
  { code: "INR", label: "INR (₹)" },
] as const;

const todayISO = () => new Date().toISOString().slice(0, 10);
const makeId = () => crypto.randomUUID();

/* ===================== HELPERS ===================== */

const safeNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const money = (value: number, currency: string) =>
  `${currency} ${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`;

/**
 * Ensures a REAL ArrayBuffer (never SharedArrayBuffer),
 * avoiding TS BlobPart typing issues in some setups.
 */
const toArrayBuffer = (u8: Uint8Array): ArrayBuffer => {
  return u8.slice().buffer as ArrayBuffer;
};

/* ===================== DEFAULT STATE ===================== */

const defaultState = () => ({
  form: {
    docType: "invoice" as DocType,
    docNumber: `INV-${new Date().getFullYear()}-001`,
    issueDate: todayISO(),
    dueDate: todayISO(),
    currency: "GBP",

    sellerName: "Torensa Ltd",
    sellerDetails: "London, UK\nhello@torensa.com",

    billToName: "",
    billToDetails: "",

    notes: "Thank you for your business.",

    taxRate: 0,
    discount: 0,
    shipping: 0,

    showDueDate: true,
  } satisfies FormState,
  items: [
    {
      id: makeId(),
      description: "Service / Product",
      quantity: 1,
      unitPrice: 50,
    },
  ] as LineItem[],
});

/* ===================== PDF GENERATION ===================== */

async function generatePdf(form: FormState, items: LineItem[]) {
  const pdf = await PDFDocument.create();

  // A4 page size (points)
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;

  const margin = 48;
  let page = pdf.addPage([PAGE_W, PAGE_H]);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const gray = rgb(0.35, 0.35, 0.35);
  const lineColor = rgb(0.85, 0.85, 0.85);

  let y = PAGE_H - margin;

  const drawLine = (yPos: number) => {
    page.drawLine({
      start: { x: margin, y: yPos },
      end: { x: PAGE_W - margin, y: yPos },
      thickness: 1,
      color: lineColor,
    });
  };

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    size = 11,
    isBold = false,
    color = black,
  ) => {
    page.drawText(text, {
      x,
      y: yPos,
      size,
      font: isBold ? bold : font,
      color,
    });
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin + 80) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - margin;
    }
  };

  const title = form.docType === "invoice" ? "INVOICE" : "RECEIPT";

  // Header
  drawText(title, margin, y, 22, true);
  y -= 30;

  drawText(form.sellerName || "", margin, y, 12, true);
  y -= 18;

  const sellerLines = (form.sellerDetails || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const line of sellerLines) {
    drawText(line, margin, y, 10, false, gray);
    y -= 14;
  }

  // Meta (right)
  const metaX = PAGE_W - margin - 220;
  const metaY = PAGE_H - margin - 8;

  drawText(
    form.docType === "invoice" ? "Invoice #" : "Receipt #",
    metaX,
    metaY,
    10,
    true,
    gray,
  );
  drawText(form.docNumber || "", metaX + 90, metaY, 10);

  drawText("Issue date", metaX, metaY - 16, 10, true, gray);
  drawText(form.issueDate || "", metaX + 90, metaY - 16, 10);

  if (form.docType === "invoice" && form.showDueDate) {
    drawText("Due date", metaX, metaY - 32, 10, true, gray);
    drawText(form.dueDate || "", metaX + 90, metaY - 32, 10);
  }

  const afterHeaderY = Math.min(y, metaY - 50);
  drawLine(afterHeaderY);
  y = afterHeaderY - 24;

  // Bill To
  drawText("Bill To", margin, y, 11, true, gray);
  y -= 18;

  drawText(form.billToName || "", margin, y, 12, true);
  y -= 18;

  const billLines = (form.billToDetails || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const line of billLines) {
    drawText(line, margin, y, 10, false, gray);
    y -= 14;
  }

  y -= 10;
  drawLine(y);
  y -= 22;

  // Items header
  drawText("Description", margin, y, 10, true, gray);
  drawText("Qty", PAGE_W - margin - 220, y, 10, true, gray);
  drawText("Unit", PAGE_W - margin - 160, y, 10, true, gray);
  drawText("Total", PAGE_W - margin - 70, y, 10, true, gray);
  y -= 12;
  drawLine(y);
  y -= 20;

  // Items rows
  const validItems = items.filter(
    (it) => it.description.trim() && it.quantity > 0,
  );
  let subtotal = 0;

  for (const it of validItems) {
    ensureSpace(40);

    const qty = Math.max(0, safeNumber(it.quantity, 0));
    const unit = Math.max(0, safeNumber(it.unitPrice, 0));
    const lineTotal = qty * unit;
    subtotal += lineTotal;

    drawText(it.description, margin, y, 10);
    drawText(String(qty), PAGE_W - margin - 220, y, 10);
    drawText(money(unit, form.currency), PAGE_W - margin - 160, y, 10);
    drawText(money(lineTotal, form.currency), PAGE_W - margin - 70, y, 10);
    y -= 18;
  }

  y -= 8;
  drawLine(y);
  y -= 22;

  // Totals
  const taxRate = Math.max(0, safeNumber(form.taxRate, 0));
  const tax = subtotal * (taxRate / 100);

  const shipping = Math.max(0, safeNumber(form.shipping, 0));
  const discount = Math.max(0, safeNumber(form.discount, 0));

  const total = Math.max(0, subtotal + tax + shipping - discount);

  ensureSpace(110);

  const totalsLeftX = PAGE_W - margin - 220;

  drawText("Subtotal", totalsLeftX, y, 10, true, gray);
  drawText(money(subtotal, form.currency), totalsLeftX + 110, y, 10);
  y -= 16;

  drawText(`Tax (${taxRate.toFixed(2)}%)`, totalsLeftX, y, 10, true, gray);
  drawText(money(tax, form.currency), totalsLeftX + 110, y, 10);
  y -= 16;

  drawText("Shipping", totalsLeftX, y, 10, true, gray);
  drawText(money(shipping, form.currency), totalsLeftX + 110, y, 10);
  y -= 16;

  drawText("Discount", totalsLeftX, y, 10, true, gray);
  drawText(`- ${money(discount, form.currency)}`, totalsLeftX + 110, y, 10);
  y -= 16;

  drawLine(y + 6);
  drawText("Total", totalsLeftX, y - 8, 12, true);
  drawText(money(total, form.currency), totalsLeftX + 110, y - 8, 12, true);
  y -= 30;

  // Notes
  const notes = (form.notes || "").trim();
  if (notes) {
    ensureSpace(80);
    drawText("Notes", margin, y, 10, true, gray);
    y -= 16;

    notes
      .split("\n")
      .slice(0, 12)
      .forEach((line) => {
        drawText(line, margin, y, 10);
        y -= 14;
      });
  }

  return pdf.save();
}

/* ===================== COMPONENT ===================== */

export default function InvoiceGenerator() {
  const init = defaultState();
  const [form, setForm] = useState<FormState>(init.form);
  const [items, setItems] = useState<LineItem[]>(init.items);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const firstLoad = useRef(true);

  // Load saved state
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      firstLoad.current = false;
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.form) setForm((prev) => ({ ...prev, ...parsed.form }));
      if (Array.isArray(parsed?.items) && parsed.items.length)
        setItems(parsed.items);
    } catch {
      // ignore
    } finally {
      firstLoad.current = false;
    }
  }, []);

  // Save state
  useEffect(() => {
    if (firstLoad.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, items }));
    } catch {
      // ignore
    }
  }, [form, items]);

  const subtotal = useMemo(() => {
    return items.reduce((s, it) => {
      const q = Math.max(0, safeNumber(it.quantity, 0));
      const u = Math.max(0, safeNumber(it.unitPrice, 0));
      return s + q * u;
    }, 0);
  }, [items]);

  const taxAmount = useMemo(() => {
    const rate = Math.max(0, safeNumber(form.taxRate, 0));
    return subtotal * (rate / 100);
  }, [subtotal, form.taxRate]);

  const total = useMemo(() => {
    const shipping = Math.max(0, safeNumber(form.shipping, 0));
    const discount = Math.max(0, safeNumber(form.discount, 0));
    return Math.max(0, subtotal + taxAmount + shipping - discount);
  }, [subtotal, taxAmount, form.shipping, form.discount]);

  const updateForm = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: makeId(), description: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
    setError(null);
  };

  const reset = () => {
    const d = defaultState();
    setForm(d.form);
    setItems(d.items);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const download = async () => {
    try {
      setError(null);

      if (!form.sellerName.trim())
        return setError("Please add your seller/business name.");
      if (!form.billToName.trim())
        return setError("Please add a Bill To name.");
      const validItems = items.filter(
        (it) => it.description.trim() && it.quantity > 0,
      );
      if (validItems.length === 0)
        return setError("Please add at least one line item.");

      setBusy(true);

      const bytes = await generatePdf(form, items);

      const blob = new Blob([toArrayBuffer(bytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;

      const prefix = form.docType === "invoice" ? "invoice" : "receipt";
      const safeNum = (form.docNumber || "").trim().replace(/[^\w\-]+/g, "_");
      a.download = `${prefix}_${safeNum || "document"}.pdf`;

      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e: any) {
      setError(
        e?.message
          ? `Failed to generate PDF: ${e.message}`
          : "Failed to generate PDF.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>

        {/* Doc meta */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Type"
            value={form.docType}
            onChange={(e) => updateForm("docType", e.target.value as DocType)}
            select
            fullWidth
          >
            <MenuItem value="invoice">Invoice</MenuItem>
            <MenuItem value="receipt">Receipt</MenuItem>
          </TextField>

          <TextField
            label={form.docType === "invoice" ? "Invoice #" : "Receipt #"}
            value={form.docNumber}
            onChange={(e) => updateForm("docNumber", e.target.value)}
            fullWidth
          />

          <TextField
            label="Currency"
            value={form.currency}
            onChange={(e) => updateForm("currency", e.target.value)}
            select
            fullWidth
          >
            {CURRENCY_OPTIONS.map((c) => (
              <MenuItem key={c.code} value={c.code}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems="center"
        >
          <TextField
            label="Issue date"
            type="date"
            value={form.issueDate}
            onChange={(e) => updateForm("issueDate", e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <TextField
            label="Due date"
            type="date"
            value={form.dueDate}
            onChange={(e) => updateForm("dueDate", e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            disabled={form.docType !== "invoice" || !form.showDueDate}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={form.showDueDate}
                onChange={(e) => updateForm("showDueDate", e.target.checked)}
                disabled={form.docType !== "invoice"}
              />
            }
            label="Show due date"
            sx={{ whiteSpace: "nowrap" }}
          />
        </Stack>

        <Divider />

        {/* Parties */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Stack spacing={2} flex={1}>
            <TextField
              label="Seller / Business name"
              value={form.sellerName}
              onChange={(e) => updateForm("sellerName", e.target.value)}
              fullWidth
            />
            <TextField
              label="Seller details (address, email, phone)"
              value={form.sellerDetails}
              onChange={(e) => updateForm("sellerDetails", e.target.value)}
              multiline
              minRows={4}
              fullWidth
            />
          </Stack>

          <Stack spacing={2} flex={1}>
            <TextField
              label="Bill To name"
              value={form.billToName}
              onChange={(e) => updateForm("billToName", e.target.value)}
              fullWidth
            />
            <TextField
              label="Bill To details (address, email, etc.)"
              value={form.billToDetails}
              onChange={(e) => updateForm("billToDetails", e.target.value)}
              multiline
              minRows={4}
              fullWidth
            />
          </Stack>
        </Stack>

        <Divider />

        {/* Items */}
        <Stack spacing={1}>
          <Typography variant="subtitle1" fontWeight={700}>
            Line items
          </Typography>

          {items.map((it) => (
            <Stack
              key={it.id}
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ md: "center" }}
              sx={{
                p: 2,
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 2,
              }}
            >
              <TextField
                label="Description"
                value={it.description}
                onChange={(e) =>
                  updateItem(it.id, { description: e.target.value })
                }
                fullWidth
              />
              <TextField
                label="Qty"
                type="number"
                value={it.quantity}
                onChange={(e) =>
                  updateItem(it.id, {
                    quantity: safeNumber(e.target.value, 1),
                  })
                }
                inputProps={{ min: 0, step: 1 }}
                sx={{ width: { md: 120 } }}
              />
              <TextField
                label="Unit price"
                type="number"
                value={it.unitPrice}
                onChange={(e) =>
                  updateItem(it.id, {
                    unitPrice: safeNumber(e.target.value, 0),
                  })
                }
                inputProps={{ min: 0, step: "0.01" }}
                sx={{ width: { md: 160 } }}
              />

              <Stack direction="row" spacing={1} alignItems="center">
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ minWidth: 150 }}
                >
                  {money(
                    Math.max(0, safeNumber(it.quantity, 0)) *
                      Math.max(0, safeNumber(it.unitPrice, 0)),
                    form.currency,
                  )}
                </Typography>

                <IconButton
                  aria-label="Remove item"
                  onClick={() => removeItem(it.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
            </Stack>
          ))}

          <TransparentButton
            label="Add item"
            startIcon={<AddIcon />}
            onClick={addItem}
            sx={{ width: "fit-content" }}
          />
        </Stack>

        <Divider />

        {/* Notes + totals */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Stack spacing={2} flex={1}>
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => updateForm("notes", e.target.value)}
              multiline
              minRows={4}
              fullWidth
            />
          </Stack>

          <Stack spacing={2} flex={1}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Tax rate (%)"
                type="number"
                value={form.taxRate}
                onChange={(e) =>
                  updateForm("taxRate", safeNumber(e.target.value, 0))
                }
                inputProps={{ min: 0, step: "0.01" }}
                fullWidth
              />
              <TextField
                label="Shipping"
                type="number"
                value={form.shipping}
                onChange={(e) =>
                  updateForm("shipping", safeNumber(e.target.value, 0))
                }
                inputProps={{ min: 0, step: "0.01" }}
                fullWidth
              />
              <TextField
                label="Discount"
                type="number"
                value={form.discount}
                onChange={(e) =>
                  updateForm("discount", safeNumber(e.target.value, 0))
                }
                inputProps={{ min: 0, step: "0.01" }}
                fullWidth
              />
            </Stack>

            <Stack
              spacing={1}
              sx={{
                p: 2,
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 2,
              }}
            >
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Subtotal
                </Typography>
                <Typography variant="body2">
                  {money(subtotal, form.currency)}
                </Typography>
              </Stack>

              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Tax
                </Typography>
                <Typography variant="body2">
                  {money(taxAmount, form.currency)}
                </Typography>
              </Stack>

              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Total
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {money(total, form.currency)}
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </Stack>

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <ActionButton onClick={download} loading={busy}>
            Generate & Download PDF
          </ActionButton>

          <TransparentButton label="Reset" color="error" onClick={reset} />
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

    </PageContainer>
  );
}
