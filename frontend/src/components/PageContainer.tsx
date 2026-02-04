import React from "react";
import { Card, CardContent } from "@mui/material";

type PageContainerProps = {
  children: React.ReactNode;
  maxWidth?: number;
};

export default function PageContainer({
  children,
  maxWidth = 1100,
}: PageContainerProps) {
  return (
    <Card
      sx={{
        maxWidth,
        mx: "auto",
        mt: 6,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
        transition: "all 0.2s ease-in-out",
      }}
    >
      <CardContent
        sx={{
          p: { xs: 3, sm: 4 },
        }}
      >
        {children}
      </CardContent>
    </Card>
  );
}
