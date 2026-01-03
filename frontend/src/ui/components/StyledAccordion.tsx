import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { ReactNode } from "react";

type Props = {
  title: string;
  accentColor?: string;
  expanded: boolean;
  onChange: (expanded: boolean) => void;
  children: ReactNode;
};

export default function StyledAccordion({
  title,
  accentColor = "#60a5fa",
  expanded,
  onChange,
  children,
}: Props) {
  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => onChange(isExpanded)}
      sx={{
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,0.2)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        boxShadow: "0 8px 22px rgba(0,0,0,0.3)",
        overflow: "hidden",
        mb: 2,
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography fontWeight={700} sx={{ color: accentColor }}>
          {title}
        </Typography>
      </AccordionSummary>

      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}
