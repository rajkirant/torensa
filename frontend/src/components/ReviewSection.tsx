import React, { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { useAuth } from "../utils/auth";
import { apiFetch } from "../utils/api";

/* ── types ──────────────────────────────────────────────── */

interface ReviewItem {
  id: number;
  username: string;
  rating: number;
  comment: string;
  created_at: string;
  is_own: boolean;
}

interface Summary {
  average_rating: number | null;
  total_reviews: number;
}

interface UserReview {
  rating: number;
  comment: string;
}

/* ── star renderer ──────────────────────────────────────── */

function Stars({
  value,
  interactive = false,
  onChange,
  size = 22,
}: {
  value: number;
  interactive?: boolean;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const display = interactive ? hover || value : value;

  return (
    <Box sx={{ display: "flex", gap: 0.25 }}>
      {[1, 2, 3, 4, 5].map((s) =>
        interactive ? (
          <IconButton
            key={s}
            size="small"
            onClick={() => onChange?.(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            sx={{ p: 0.25, color: display >= s ? "#facc15" : "rgba(255,255,255,0.25)" }}
          >
            {display >= s ? (
              <StarIcon sx={{ fontSize: size }} />
            ) : (
              <StarBorderIcon sx={{ fontSize: size }} />
            )}
          </IconButton>
        ) : (
          <Box
            key={s}
            component="span"
            sx={{ color: display >= s ? "#facc15" : "rgba(255,255,255,0.2)", lineHeight: 1 }}
          >
            {display >= s ? (
              <StarIcon sx={{ fontSize: size }} />
            ) : (
              <StarBorderIcon sx={{ fontSize: size }} />
            )}
          </Box>
        ),
      )}
    </Box>
  );
}

/* ── main component ─────────────────────────────────────── */

export default function ReviewSection({ toolPath }: { toolPath: string }) {
  const { user } = useAuth();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ average_rating: null, total_reviews: 0 });
  const [userReview, setUserReview] = useState<UserReview | null>(null);
  const [loading, setLoading] = useState(true);

  // form state
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [showTrustpilotNudge, setShowTrustpilotNudge] = useState(false);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/reviews/?tool_path=${encodeURIComponent(toolPath)}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews);
        setSummary(data.summary);
        setUserReview(data.user_review);
        if (data.user_review) {
          setFormRating(data.user_review.rating);
          setFormComment(data.user_review.comment);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [toolPath]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (formRating === 0) {
      setFormError("Please select a star rating.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/reviews/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_path: toolPath, rating: formRating, comment: formComment }),
      });
      if (res.ok) {
        await fetchReviews();
        if (formRating === 5) setShowTrustpilotNudge(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || "Failed to submit review.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    const res = await apiFetch(`/api/reviews/${id}/`, { method: "DELETE" });
    if (res.ok) {
      setFormRating(0);
      setFormComment("");
      await fetchReviews();
    }
  }

  return (
    <Box component="section">
      <Divider sx={{ mb: 3, opacity: 0.2 }} />

      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: "1rem", letterSpacing: 0.3 }}>
          Reviews
        </Typography>
        {summary.total_reviews > 0 && (
          <>
            <Stars value={Math.round(summary.average_rating ?? 0)} size={18} />
            <Typography variant="body2" color="text.secondary">
              {summary.average_rating?.toFixed(1)} ({summary.total_reviews}{" "}
              {summary.total_reviews === 1 ? "review" : "reviews"})
            </Typography>
          </>
        )}
      </Stack>

      {/* Write / edit review — logged-in users only */}
      {user ? (
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
            {userReview ? "Edit your review" : "Write a review"}
          </Typography>

          <Stars value={formRating} interactive onChange={setFormRating} />

          <TextField
            multiline
            minRows={2}
            maxRows={6}
            fullWidth
            placeholder="Optional comment…"
            value={formComment}
            onChange={(e) => setFormComment(e.target.value)}
            inputProps={{ maxLength: 2000 }}
            sx={{ mt: 1.5 }}
            size="small"
          />

          {formError && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
              {formError}
            </Typography>
          )}

          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} alignItems="center">
            <Button
              type="submit"
              variant="contained"
              size="small"
              disabled={submitting}
              sx={{
                textTransform: "none",
                background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                "&:hover": { background: "linear-gradient(135deg,#2563eb,#4f46e5)" },
              }}
            >
              {submitting ? <CircularProgress size={16} color="inherit" /> : userReview ? "Update" : "Submit"}
            </Button>

            {userReview && (
              <Tooltip title="Delete your review">
                <IconButton
                  size="small"
                  onClick={() => {
                    const own = reviews.find((r) => r.is_own);
                    if (own) handleDelete(own.id);
                  }}
                  sx={{ color: "error.main" }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          {showTrustpilotNudge && (
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 2,
                border: "1px solid rgba(0,182,122,0.35)",
                background: "rgba(0,182,122,0.07)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Thanks for your review! Enjoying Torensa? Share it on{" "}
                <Box
                  component="a"
                  href="https://www.trustpilot.com/evaluate/torensa.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: "#00b67a", fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                >
                  Trustpilot
                </Box>{" "}
                too.
              </Typography>
              <IconButton size="small" onClick={() => setShowTrustpilotNudge(false)} sx={{ color: "text.secondary", flexShrink: 0 }}>
                <Box component="span" sx={{ fontSize: "1rem", lineHeight: 1 }}>×</Box>
              </IconButton>
            </Box>
          )}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          <Box
            component="a"
            href="/login"
            sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
          >
            Log in
          </Box>{" "}
          to leave a review.
        </Typography>
      )}

      {/* Review list */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : reviews.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No reviews yet. Be the first!
        </Typography>
      ) : (
        <Stack spacing={2}>
          {reviews.map((r) => (
            <Box
              key={r.id}
              sx={{
                p: 2,
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.08)",
                background: r.is_own ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.02)",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Typography variant="body2" fontWeight={600}>
                  {r.username}
                  {r.is_own && (
                    <Box component="span" sx={{ ml: 0.75, fontSize: "0.7rem", color: "primary.light" }}>
                      (you)
                    </Box>
                  )}
                </Typography>
                <Stars value={r.rating} size={16} />
                <Typography variant="caption" color="text.secondary" sx={{ ml: "auto !important" }}>
                  {new Date(r.created_at).toLocaleDateString()}
                </Typography>
              </Stack>
              {r.comment && (
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {r.comment}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
