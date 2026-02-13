import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

type BackButtonProps = {
  fallbackTo?: string;
};

export default function BackButton({ fallbackTo = "/" }: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo);
  };

  return (
    <Button
      variant="contained"
      startIcon={<ArrowBackIcon />}
      onClick={handleBack}
      sx={{
        textTransform: "none",
        fontWeight: 700,
        borderRadius: 999,
        boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
      }}
      aria-label="Go back"
    >
      Back
    </Button>
  );
}
