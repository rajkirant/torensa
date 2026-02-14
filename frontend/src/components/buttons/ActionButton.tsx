import Button, { type ButtonProps } from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

type ActionButtonProps = ButtonProps & {
  loading?: boolean;
};

export function ActionButton({
  sx,
  loading = false,
  disabled,
  children,
  startIcon,
  endIcon,
  ...props
}: ActionButtonProps) {
  return (
    <Button
      variant="contained"
      disabled={disabled || loading}
      startIcon={loading ? undefined : startIcon}
      endIcon={loading ? undefined : endIcon}
      sx={[{ textTransform: "none", fontWeight: 600 }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...props}
    >
      {loading ? <CircularProgress size={20} color="inherit" /> : children}
    </Button>
  );
}
