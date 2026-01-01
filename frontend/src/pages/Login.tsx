import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

export default function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setError("Invalid username or password");
        return;
      }

      const data = await res.json();
      setUser(data.user);
      navigate("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto" }}>
      <h2>Login</h2>

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
          <label>Password</label>
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            background: "linear-gradient(135deg, #2563eb, #7c3aed)",
            boxShadow: "0 10px 25px rgba(124, 58, 237, 0.35)",
            "&:hover": {
              background: "linear-gradient(135deg, #1e40af, #6d28d9)",
              boxShadow: "0 12px 28px rgba(124, 58, 237, 0.5)",
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
              Logging in…
            </>
          ) : (
            "Login"
          )}
        </Button>
      </form>
    </div>
  );
}
