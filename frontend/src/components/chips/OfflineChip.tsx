import React from "react";
import Chip, { ChipProps } from "@mui/material/Chip";

export default function OfflineChip(props: ChipProps) {
  return (
      <Chip
          label="Offline-ready"
          variant="outlined"
          color="success"
          {...props}
          sx={{
            height: 20,              // ✅ thinner overall
            fontSize: "0.72rem",     // ✅ prevents big text inheritance
            fontWeight: 600,
            lineHeight: 1,
            "& .MuiChip-label": {
              paddingTop: 0,
              paddingBottom: 0,
            },

            ...props.sx,             // allow overrides
          }}
      />
  );
}
