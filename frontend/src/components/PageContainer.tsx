import React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { useLocation } from "react-router-dom";
import serviceCards from "../metadata/serviceCards.json";
import OfflineChip from "./chips/OfflineChip";
import BackButton from "./buttons/BackButton";

type ServiceCard = {
    id: string;
    component: string;
    title: string;
    description: string;
    detailedDescription: string;
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

    const title = meta?.title;

    return (
        <>
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
                                width: "100%",
                            }}
                        >
                            {title}

                            {meta?.offlineEnabled && (
                                <OfflineChip sx={{ ml: "auto" }} />
                            )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {meta?.detailedDescription}
                        </Typography>
                        {children}
                        <Stack direction="row" justifyContent="flex-end">
                            <BackButton />
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>
        </>
    );
}
