import { useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useAuth } from "../utils/auth";
import type { ReactNode } from "react";
import { ActionButton } from "../components/buttons/ActionButton";
import { TransparentButton } from "../components/buttons/TransparentButton";

export default function ProtectedRoute({
                                           children,
                                       }: {
    children: ReactNode;
}) {
    const { user, loading } = useAuth();
    const location = useLocation();

    const redirect = encodeURIComponent(
        location.pathname + location.search + location.hash,
    );

    // While auth state is loading
    if (loading) {
        return (
            <Box sx={{ p: 6, textAlign: "center" }}>
                <Typography>Checking authentication…</Typography>
            </Box>
        );
    }

    // Not logged in
    if (!user) {
        return (
            <Box
                sx={{
                    maxWidth: 420,
                    mx: "auto",
                    mt: 10,
                    p: 4,
                    textAlign: "center",
                    borderRadius: 3,
                    border: "1px solid rgba(255,255,255,0.12)",
                }}
            >
                <Typography variant="h6" fontWeight={700} gutterBottom>
                    Login required
                </Typography>

                <Typography variant="body2" sx={{ mb: 3, color: "text.secondary" }}>
                    You must be logged in to access this page.
                </Typography>

                <Stack spacing={1.5}>
                    <ActionButton
                        fullWidth
                        onClick={() => window.location.assign(`/login?redirect=${redirect}`)}
                    >
                        Log in
                    </ActionButton>

                    <TransparentButton
                        fullWidth
                        label="Sign up"
                        onClick={() =>
                            window.location.assign(`/signup?redirect=${redirect}`)
                        }
                    />
                </Stack>

                <Typography variant="caption" sx={{ display: "block", mt: 2, color: "text.secondary" }}>
                    Already have an account? Log in. New here? Create one.
                </Typography>
            </Box>
        );
    }

    // Logged in
    return <>{children}</>;
}
