import { useEffect, useState } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { apiFetch } from "../utils/api";
import { useAuth } from "../utils/auth";

type VerifyEmailLocationState = {
  verificationSent?: boolean;
  verificationError?: boolean;
};

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const code = searchParams.get("code") || "";
  const { user, setUser } = useAuth();
  const locationState =
    (location.state as VerifyEmailLocationState | null) ?? null;

  const [status, setStatus] = useState<
    "loading" | "success" | "error" | "idle"
  >(code ? "loading" : "idle");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (code) return;
    if (!locationState) return;

    if (locationState.verificationSent) {
      setStatus("idle");
      setMessage("Verification email sent. Please check your inbox.");
      return;
    }

    if (locationState.verificationError) {
      setStatus("error");
      setMessage(
        "Your account was created, but the verification email could not be sent. If SES is still in sandbox, the recipient email must be verified first. You can also resend once SES production access is approved.",
      );
    }
  }, [code, locationState]);

  useEffect(() => {
    if (!code) return;

    apiFetch("/api/verify-email/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (res.ok) {
          setStatus("success");
          setMessage(data?.message || "Email verified successfully!");
          if (user) {
            setUser({ ...user, email_verified: true });
          }
        } else {
          setStatus("error");
          setMessage(data?.error || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [code]);

  async function handleResend() {
    setResending(true);
    try {
      const res = await apiFetch("/api/verify-email/resend/", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setMessage(data?.message || "Verification email sent!");
        setStatus("success");
      } else {
        setMessage(data?.error || "Failed to resend. Please try again.");
        setStatus("error");
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
      setStatus("error");
    } finally {
      setResending(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
      <h1>Email Verification</h1>

      {status === "loading" && (
        <div style={{ marginTop: 32 }}>
          <CircularProgress size={36} />
          <p style={{ color: "#6b7280", marginTop: 16 }}>
            Verifying your email…
          </p>
        </div>
      )}

      {status === "success" && (
        <div style={{ marginTop: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 16px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #059669, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              color: "#fff",
            }}
          >
            ✓
          </div>
          <p style={{ color: "#059669", fontSize: 16, fontWeight: 600 }}>
            {message}
          </p>
          <Link
            to="/"
            style={{ color: "#2563eb", marginTop: 16, display: "inline-block" }}
          >
            Go to Home
          </Link>
        </div>
      )}

      {status === "error" && (
        <div style={{ marginTop: 32 }}>
          <p style={{ color: "#dc2626", fontSize: 15 }}>{message}</p>
          {user && (
            <Button
              onClick={handleResend}
              disabled={resending}
              sx={{
                mt: 2,
                textTransform: "none",
                fontWeight: 600,
                borderRadius: 3,
                color: "#ffffff",
                background: "linear-gradient(135deg, #059669, #2563eb)",
                "&:hover": {
                  background: "linear-gradient(135deg, #047857, #1e40af)",
                },
              }}
            >
              {resending ? (
                <>
                  <CircularProgress size={18} sx={{ color: "#fff", mr: 1 }} />
                  Sending…
                </>
              ) : (
                "Resend Verification Email"
              )}
            </Button>
          )}
        </div>
      )}

      {status === "idle" && (
        <div style={{ marginTop: 32 }}>
          <p style={{ color: "#6b7280" }}>
            {message ||
              (user
                ? "Click below to receive a new verification email."
                : "Please check your inbox for the verification link.")}
          </p>
          {user && (
            <Button
              onClick={handleResend}
              disabled={resending}
              sx={{
                mt: 2,
                textTransform: "none",
                fontWeight: 600,
                borderRadius: 3,
                color: "#ffffff",
                background: "linear-gradient(135deg, #059669, #2563eb)",
                "&:hover": {
                  background: "linear-gradient(135deg, #047857, #1e40af)",
                },
              }}
            >
              {resending ? (
                <>
                  <CircularProgress size={18} sx={{ color: "#fff", mr: 1 }} />
                  Sending…
                </>
              ) : (
                "Send Verification Email"
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
