import React from "react";
import { Card, CardContent, Typography, Stack } from "@mui/material";
import { useLocation } from "react-router-dom";
import serviceCards from "../metadata/serviceCards.json";
import OfflineChip from "./chips/OfflineChip";

type ServiceCard = {
    id: string;
    component: string;
    title: string;
    description: string;
    path: string;
    ctaLabel: string;
    offlineEnabled: boolean;
    authRequired: boolean;
};

type PageContainerProps = {
    children: React.ReactNode;
    maxWidth?: number;
};

export default function PageContainer({
                                          children,
                                          maxWidth = 1100,
                                      }: PageContainerProps) {
    const location = useLocation();
    const currentPath = location.pathname;

    const meta = (serviceCards as ServiceCard[]).find(
        (item) => item.path === currentPath,
    );

    const titleToShow = meta?.title ?? id ?? currentPath;

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
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Stack spacing={3}>

                    <Typography
                        variant="h5"
                        fontWeight={700}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%", // ✅ important
                        }}
                    >
                        {titleToShow}

                        {meta?.offlineEnabled && (
                            <OfflineChip sx={{ ml: "auto" }} />
                        )}
                    </Typography>





                    {children}
                </Stack>
            </CardContent>
        </Card>
    );
}
