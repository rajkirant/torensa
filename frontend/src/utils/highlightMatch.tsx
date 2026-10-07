import React from "react";
import Box from "@mui/material/Box";

/** Normalises a search box value for matching (trimmed, case-insensitive). */
export function normalizeQuery(value: string) {
  return value.trim().toLocaleLowerCase();
}

/** True when `text` contains the normalised `query`. */
export function matchesQuery(text: string, query: string) {
  return text.toLocaleLowerCase().includes(query);
}

/** Wraps each occurrence of the normalised `query` in a highlight. */
export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLocaleLowerCase();
  const parts: React.ReactNode[] = [];
  let start = 0;
  let index = lower.indexOf(query);
  while (index !== -1) {
    if (index > start) parts.push(text.slice(start, index));
    parts.push(
      <Box
        component="mark"
        key={index}
        sx={{
          bgcolor: "rgba(250,204,21,0.35)",
          color: "inherit",
          borderRadius: 0.5,
          px: 0.25,
        }}
      >
        {text.slice(index, index + query.length)}
      </Box>,
    );
    start = index + query.length;
    index = lower.indexOf(query, start);
  }
  if (start < text.length) parts.push(text.slice(start));
  return parts;
}
