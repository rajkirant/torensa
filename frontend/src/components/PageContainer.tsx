import React, { createContext, useContext, useEffect, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { useLocation } from "react-router-dom";
import serviceCards from "../metadata/serviceCards.json";
import OfflineChip from "./chips/OfflineChip";
import BackButton from "./buttons/BackButton";
import {
    type ServiceCardConfig,
    findServiceCardByPath,
} from "../utils/serviceCards";

type PageContainerProps = {
    children: React.ReactNode;
    maxWidth?: number;
};

type PageOptionsContextValue = {
    showAdvancedOptions: boolean;
    setShowAdvancedOptions: (value: boolean) => void;
    advancedOptionsEnabled: boolean;
};

const PageOptionsContext = createContext<PageOptionsContextValue>({
    showAdvancedOptions: false,
    setShowAdvancedOptions: () => {},
    advancedOptionsEnabled: false,
});

export function usePageOptions() {
    return useContext(PageOptionsContext);
}

export default function PageContainer({
                                          children,
                                          maxWidth = 1100,
                                      }: PageContainerProps) {
    const location = useLocation();
    const currentPath = location.pathname;

    const meta = findServiceCardByPath(
        serviceCards as ServiceCardConfig[],
        currentPath,
    );

    const title = meta?.title;
    const advancedOptionsEnabled = Boolean(meta?.advancedOptionsEnabled);
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

    useEffect(() => {
        setShowAdvancedOptions(false);
    }, [currentPath, advancedOptionsEnabled]);

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
                                flexWrap: { xs: "wrap", sm: "nowrap" },
                                rowGap: { xs: 1, sm: 0 },
                            }}
                        >
                            {title}

                            {advancedOptionsEnabled && (
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={showAdvancedOptions}
                                            onChange={(e) =>
                                                setShowAdvancedOptions(e.target.checked)
                                            }
                                        />
                                    }
                                    label="Show advanced options"
                                    sx={{
                                        ml: { xs: 0, sm: "auto" },
                                        mr: { xs: 0, sm: 1 },
                                        width: { xs: "100%", sm: "auto" },
                                        order: { xs: 2, sm: 0 },
                                    }}
                                />
                            )}

                            {meta?.offlineEnabled && (
                                <OfflineChip
                                    sx={{
                                        ml: {
                                            xs: "auto",
                                            sm: advancedOptionsEnabled ? 0 : "auto",
                                        },
                                        order: { xs: 1, sm: 0 },
                                    }}
                                />
                            )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {meta?.detailedDescription}
                        </Typography>
                        <PageOptionsContext.Provider
                            value={{
                                showAdvancedOptions,
                                setShowAdvancedOptions,
                                advancedOptionsEnabled,
                            }}
                        >
                            {children}
                        </PageOptionsContext.Provider>
                        <Stack direction="row" justifyContent="flex-end">
                            <BackButton />
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>
        </>
    );
}
