import React from "react";
import Chip, { ChipProps } from "@mui/material/Chip";

export default function AiPoweredChip(props: ChipProps) {
  return (
    <Chip
      label="AI-powered"
      variant="outlined"
      {...props}
      sx={{
        height: 20,
        fontSize: "0.72rem",
        fontWeight: 600,
        lineHeight: 1,
        color: "#ed08c3",
        borderColor: "#ed08c3",
        "& .MuiChip-label": {
          paddingTop: 0,
          paddingBottom: 0,
        },
        ...props.sx,
      }}
    />
  );
}
