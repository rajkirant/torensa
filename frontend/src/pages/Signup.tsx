import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { apiFetch } from "../utils/api";

export default function Signup() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch("/api/signup/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Signup failed");
        return;
      }

      const data = await res.json();
      setUser(data.user); // auto login
      navigate("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto" }}>
      <h2>Create Account</h2>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label>Username</label>
          <input
            autoComplete="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Email</label>
          <input
            autoComplete="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Password</label>
          <input
            autoComplete="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Confirm Password</label>
          <input
            autoComplete="new-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        {error && <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>}

        <Button
          type="submit"
          fullWidth
          size="large"
          disabled={loading}
          sx={{
            mt: 1,
            py: 1.5,
            fontSize: "1.05rem",
            fontWeight: 700,
            letterSpacing: "0.03em",
            borderRadius: 3,
            textTransform: "none",
            color: "#ffffff",
            background: "linear-gradient(135deg, #059669, #2563eb)",
            boxShadow: "0 10px 25px rgba(37, 99, 235, 0.35)",
            "&:hover": {
              background: "linear-gradient(135deg, #047857, #1e40af)",
            },
            "&.Mui-disabled": {
              color: "#ffffff",
              opacity: 0.8,
            },
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={22} sx={{ color: "#ffffff", mr: 1 }} />
              Creating account…
            </>
          ) : (
            "Sign Up"
          )}
        </Button>
      </form>
    </div>
  );
}
