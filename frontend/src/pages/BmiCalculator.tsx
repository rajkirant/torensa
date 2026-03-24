import React, { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useTheme } from "@mui/material/styles";
import PageContainer from "../components/PageContainer";
import { ActionButton } from "../components/buttons/ActionButton";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import useToolStatus from "../hooks/useToolStatus";

/* ── types ─────────────────────────────────────────────── */

type Unit = "metric" | "imperial";

interface BmiResult {
  bmi: number;
  category: string;
  color: string;
}

/* ── helpers ───────────────────────────────────────────── */

function calculateBmi(
  weight: number,
  height: number,
  unit: Unit,
): BmiResult | null {
  if (weight <= 0 || height <= 0) return null;

  let bmi: number;
  if (unit === "metric") {
    // height in cm → convert to m
    const heightM = height / 100;
    bmi = weight / (heightM * heightM);
  } else {
    // weight in lbs, height in inches
    bmi = (weight / (height * height)) * 703;
  }

  if (!isFinite(bmi)) return null;

  let category: string;
  let color: string;
  if (bmi < 18.5) {
    category = "Underweight";
    color = "#3b82f6";
  } else if (bmi < 25) {
    category = "Normal weight";
    color = "#22c55e";
  } else if (bmi < 30) {
    category = "Overweight";
    color = "#f59e0b";
  } else {
    category = "Obese";
    color = "#ef4444";
  }

  return { bmi: Math.round(bmi * 10) / 10, category, color };
}

/* ── BMI scale bar ─────────────────────────────────────── */

const BMI_RANGES = [
  { label: "Underweight", min: 0, max: 18.5, color: "#3b82f6" },
  { label: "Normal", min: 18.5, max: 25, color: "#22c55e" },
  { label: "Overweight", min: 25, max: 30, color: "#f59e0b" },
  { label: "Obese", min: 30, max: 40, color: "#ef4444" },
];

function BmiScale({ bmi }: { bmi: number | null }) {
  const scaleMin = 10;
  const scaleMax = 40;
  const clampedBmi = bmi ? Math.max(scaleMin, Math.min(scaleMax, bmi)) : null;
  const markerPos = clampedBmi
    ? ((clampedBmi - scaleMin) / (scaleMax - scaleMin)) * 100
    : null;

  return (
    <Box sx={{ mt: 3, mb: 1 }}>
      <Box
        sx={{
          position: "relative",
          height: 20,
          borderRadius: 2,
          overflow: "hidden",
          display: "flex",
        }}
      >
        {BMI_RANGES.map((range) => {
          const width =
            ((Math.min(range.max, scaleMax) - Math.max(range.min, scaleMin)) /
              (scaleMax - scaleMin)) *
            100;
          return (
            <Box
              key={range.label}
              sx={{
                width: `${width}%`,
                backgroundColor: range.color,
                opacity: 0.7,
              }}
            />
          );
        })}
        {markerPos !== null && (
          <Box
            sx={{
              position: "absolute",
              left: `${markerPos}%`,
              top: -4,
              transform: "translateX(-50%)",
              width: 4,
              height: 28,
              backgroundColor: "#fff",
              border: "2px solid #000",
              borderRadius: 1,
              zIndex: 1,
            }}
          />
        )}
      </Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
        {BMI_RANGES.map((range) => (
          <Typography
            key={range.label}
            variant="caption"
            sx={{ color: range.color, fontWeight: 600, fontSize: 11 }}
          >
            {range.label}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

/* ── component ─────────────────────────────────────────── */

const BmiCalculator: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { error, success, setError, setSuccess, clear } = useToolStatus();

  const [unit, setUnit] = useState<Unit>("metric");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [result, setResult] = useState<BmiResult | null>(null);

  const handleUnitChange = (
    _: React.MouseEvent<HTMLElement>,
    newUnit: Unit | null,
  ) => {
    if (!newUnit) return;
    setUnit(newUnit);
    setWeight("");
    setHeight("");
    setHeightFt("");
    setHeightIn("");
    setResult(null);
    clear();
  };

  const handleCalculate = () => {
    clear();

    const w = parseFloat(weight);
    if (!w || w <= 0) {
      setError(
        `Enter a valid weight in ${unit === "metric" ? "kilograms" : "pounds"}.`,
      );
      return;
    }

    let h: number;
    if (unit === "metric") {
      h = parseFloat(height);
      if (!h || h <= 0) {
        setError("Enter a valid height in centimeters.");
        return;
      }
    } else {
      const ft = parseFloat(heightFt) || 0;
      const inches = parseFloat(heightIn) || 0;
      h = ft * 12 + inches;
      if (h <= 0) {
        setError("Enter a valid height in feet and inches.");
        return;
      }
    }

    const bmiResult = calculateBmi(w, h, unit);
    if (!bmiResult) {
      setError("Could not calculate BMI. Check your inputs.");
      return;
    }

    setResult(bmiResult);
    setSuccess(`Your BMI is ${bmiResult.bmi} — ${bmiResult.category}.`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCalculate();
  };

  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const borderColor = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";

  return (
    <PageContainer maxWidth={540}>
      <ToolStatusAlerts error={error} success={success} />

      <Box
        sx={{
          border: `1px solid ${borderColor}`,
          borderRadius: 3,
          backgroundColor: cardBg,
          p: { xs: 3, sm: 4 },
        }}
      >
        {/* Unit toggle */}
        <Stack alignItems="center" sx={{ mb: 3 }}>
          <ToggleButtonGroup
            value={unit}
            exclusive
            onChange={handleUnitChange}
            size="small"
          >
            <ToggleButton value="metric">Metric (kg / cm)</ToggleButton>
            <ToggleButton value="imperial">Imperial (lbs / ft)</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {/* Weight */}
        <TextField
          fullWidth
          label={unit === "metric" ? "Weight (kg)" : "Weight (lbs)"}
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ mb: 2 }}
        />

        {/* Height */}
        {unit === "metric" ? (
          <TextField
            fullWidth
            label="Height (cm)"
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            onKeyDown={handleKeyDown}
            sx={{ mb: 2 }}
          />
        ) : (
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Feet"
              type="number"
              value={heightFt}
              onChange={(e) => setHeightFt(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <TextField
              fullWidth
              label="Inches"
              type="number"
              value={heightIn}
              onChange={(e) => setHeightIn(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </Stack>
        )}

        <ActionButton fullWidth onClick={handleCalculate}>
          Calculate BMI
        </ActionButton>

        {/* Result */}
        {result && (
          <>
            <Box sx={{ textAlign: "center", mt: 3 }}>
              <Typography
                variant="h2"
                sx={{ fontWeight: 700, color: result.color }}
              >
                {result.bmi}
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: result.color, mt: 0.5 }}
              >
                {result.category}
              </Typography>
            </Box>
            <BmiScale bmi={result.bmi} />
          </>
        )}
      </Box>
    </PageContainer>
  );
};

export default BmiCalculator;
