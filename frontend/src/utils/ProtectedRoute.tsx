import { Navigate, useLocation } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import { useAuth } from "./auth";
import { JSX } from "@emotion/react/jsx-dev-runtime";

export default function ProtectedRoute({
  children,
}: {
  children: JSX.Element;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

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

        <Button
          variant="contained"
          fullWidth
          onClick={() =>
            window.location.assign(
              `/login?redirect=${encodeURIComponent(location.pathname)}`,
            )
          }
        >
          Go to Login
        </Button>
      </Box>
    );
  }

  // Logged in
  return children;
}
