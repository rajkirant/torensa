import React, { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import PageContainer from "../components/PageContainer";
import { ActionButton } from "../components/buttons/ActionButton";
import { apiFetch } from "../utils/api";
import { formatApiError } from "../utils/apiError";

type TodoItem = { id: number; text: string; completed: boolean };
type TodoCategory = { id: number; name: string; items: TodoItem[] };

export default function ToDo() {
  const [categories, setCategories] = useState<TodoCategory[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<number, boolean>
  >({});

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/todo/categories/")
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(
            formatApiError(
              data,
              `Unable to load your To Do list (${response.status}).`,
            ),
          );
        }
        const data = await response.json();
        if (!cancelled) setCategories(data);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addCategory = async () => {
    const name = categoryName.trim();
    if (!name) return;
    try {
      const response = await apiFetch("/api/todo/categories/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(
          formatApiError(
            data,
            `Unable to create category (${response.status}).`,
          ),
        );
        return;
      }
      const category = await response.json();
      setCategories((current) => [...current, category]);
      setCategoryName("");
    } catch {
      setError("Unable to reach the server. Please try again.");
    }
  };

  const addItem = async (categoryId: number) => {
    const text = (itemDrafts[categoryId] || "").trim();
    if (!text) return;
    try {
      const response = await apiFetch(
        `/api/todo/categories/${categoryId}/items/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(
          formatApiError(data, `Unable to add item (${response.status}).`),
        );
        return;
      }
      const item = await response.json();
      setCategories((current) =>
        current.map((category) =>
          category.id === categoryId
            ? { ...category, items: [...category.items, item] }
            : category,
        ),
      );
      setItemDrafts((current) => ({ ...current, [categoryId]: "" }));
    } catch {
      setError("Unable to reach the server. Please try again.");
    }
  };

  const toggleItem = async (categoryId: number, itemId: number) => {
    const category = categories.find((entry) => entry.id === categoryId);
    const item = category?.items.find((entry) => entry.id === itemId);
    if (!item) return;
    const completed = !item.completed;
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.map((item) =>
                item.id === itemId ? { ...item, completed } : item,
              ),
            }
          : category,
      ),
    );
    const response = await apiFetch(`/api/todo/items/${itemId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (!response.ok) {
      setCategories((current) =>
        current.map((entry) =>
          entry.id === categoryId
            ? {
                ...entry,
                items: entry.items.map((entryItem) =>
                  entryItem.id === itemId
                    ? { ...entryItem, completed: item.completed }
                    : entryItem,
                ),
              }
            : entry,
        ),
      );
      setError("Unable to update item.");
    }
  };

  const removeItem = async (categoryId: number, itemId: number) => {
    const response = await apiFetch(`/api/todo/items/${itemId}/`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Unable to remove item.");
      return;
    }
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.filter((item) => item.id !== itemId),
            }
          : category,
      ),
    );
  };

  const removeCategory = async (categoryId: number) => {
    const response = await apiFetch(`/api/todo/categories/${categoryId}/`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Unable to remove category.");
      return;
    }
    setCategories((current) =>
      current.filter((category) => category.id !== categoryId),
    );
    setCollapsedCategories((current) => {
      const next = { ...current };
      delete next[categoryId];
      return next;
    });
  };

  const toggleCategory = (categoryId: number) => {
    setCollapsedCategories((current) => ({
      ...current,
      [categoryId]: !current[categoryId],
    }));
  };

  return (
    <PageContainer maxWidth={900}>
      <Stack spacing={3}>
        {loading && <CircularProgress sx={{ alignSelf: "center" }} />}
        {error && <Typography color="error">{error}</Typography>}
        <Box
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 2,
            border: "1px solid rgba(14,165,166,0.35)",
            background:
              "linear-gradient(140deg, rgba(14,165,166,0.18), rgba(15,23,42,0.12))",
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              label="New category"
              placeholder="e.g. Work, Home, Shopping"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addCategory()}
              size="small"
              sx={{ flex: 1 }}
            />
            <ActionButton
              onClick={addCategory}
              startIcon={<FolderOpenOutlinedIcon />}
            >
              Create category
            </ActionButton>
          </Stack>
        </Box>

        {categories.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 7, opacity: 0.65 }}>
            <ListAltOutlinedIcon
              sx={{ fontSize: 48, mb: 1, color: "primary.main" }}
            />
            <Typography variant="h6">Your list starts here</Typography>
            <Typography variant="body2" color="text.secondary">
              Create a category to begin organizing your tasks.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {categories.map((category) => {
              const completed = category.items.filter(
                (item) => item.completed,
              ).length;
              const isExpanded = !collapsedCategories[category.id];
              return (
                <Box
                  key={category.id}
                  sx={{
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: 2,
                    overflow: "hidden",
                    backgroundColor: "rgba(2,6,23,0.2)",
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    onClick={() => toggleCategory(category.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleCategory(category.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    sx={{
                      px: 2,
                      py: 1.25,
                      borderBottom: "1px solid rgba(148,163,184,0.2)",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <FolderOpenOutlinedIcon color="primary" fontSize="small" />
                    <Typography fontWeight={700} sx={{ flex: 1 }}>
                      {category.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {completed}/{category.items.length}
                    </Typography>
                    <Tooltip title="Remove category">
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeCategory(category.id);
                        }}
                        aria-label={`Remove ${category.name}`}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <ExpandMoreIcon
                      sx={{
                        transform: isExpanded
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 180ms ease",
                      }}
                    />
                  </Stack>
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    {category.items.map((item) => (
                      <Stack
                        key={item.id}
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        sx={{
                          px: 1.5,
                          py: 0.5,
                          "&:nth-of-type(odd)": {
                            backgroundColor: "rgba(148,163,184,0.05)",
                          },
                        }}
                      >
                        <Checkbox
                          checked={item.completed}
                          onChange={() => void toggleItem(category.id, item.id)}
                          sx={{ p: 0.5 }}
                        />
                        <Typography
                          sx={{
                            flex: 1,
                            textDecoration: item.completed
                              ? "line-through"
                              : "none",
                            opacity: item.completed ? 0.55 : 1,
                          }}
                        >
                          {item.text}
                        </Typography>
                        <Tooltip title="Remove item">
                          <IconButton
                            size="small"
                            onClick={() =>
                              void removeItem(category.id, item.id)
                            }
                            aria-label={`Remove ${item.text}`}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ))}
                    <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
                      <TextField
                        label="Add item"
                        value={itemDrafts[category.id] || ""}
                        onChange={(event) =>
                          setItemDrafts((current) => ({
                            ...current,
                            [category.id]: event.target.value,
                          }))
                        }
                        onKeyDown={(event) =>
                          event.key === "Enter" && void addItem(category.id)
                        }
                        size="small"
                        fullWidth
                      />
                      <IconButton
                        color="primary"
                        onClick={() => void addItem(category.id)}
                        aria-label={`Add item to ${category.name}`}
                      >
                        <AddIcon />
                      </IconButton>
                    </Stack>
                  </Collapse>
                </Box>
              );
            })}
          </Stack>
        )}
      </Stack>
    </PageContainer>
  );
}
