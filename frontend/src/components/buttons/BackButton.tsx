import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage, withLanguagePrefix } from "../../utils/language";

type BackButtonProps = {
  fallbackTo?: string;
};

export default function BackButton({ fallbackTo = "/" }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    const shouldForceEnglishPrefix =
      location.pathname === "/en" || location.pathname.startsWith("/en/");
    navigate(
      withLanguagePrefix(fallbackTo, language, {
        forcePrefix: language === "en" && shouldForceEnglishPrefix,
      }),
    );
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
