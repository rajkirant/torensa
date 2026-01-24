import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Typography,
  TextField,
  IconButton,
  Stack,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { apiFetch } from "../../utils/api";

type Props = {
  onSaved: () => void;
};

type ContactRow = {
  name: string;
  email: string;
};

export default function ContactGroupsAccordion({ onSaved }: Props) {
  const [groupName, setGroupName] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([
    { name: "", email: "" },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function updateContact(
    index: number,
    field: keyof ContactRow,
    value: string,
  ) {
    setContacts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addRow() {
    setContacts((prev) => [...prev, { name: "", email: "" }]);
  }

  function removeRow(index: number) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!groupName.trim()) {
      setError("Please enter a group name");
      return;
    }

    const validContacts = contacts.filter(
      (c) => c.name.trim() && emailRegex.test(c.email.trim()),
    );

    if (!validContacts.length) {
      setError("Please add at least one valid contact with name and email");
      return;
    }

    setSaving(true);

    try {
      const res = await apiFetch("/api/contact-groups/save/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          group_name: groupName.trim(),
          contacts: validContacts,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to save contact group");
        return;
      }

      setGroupName("");
      setContacts([{ name: "", email: "" }]);
      setSuccess("Contact group saved");
      onSaved();
    } catch {
      setError("Unable to save contact group");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSave}>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Create a contact group so you can quickly select recipients when sending
        bulk emails.
      </Typography>

      <TextField
        label='Group name (e.g. "Newsletter Subscribers")'
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        fullWidth
        margin="normal"
      />

      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
        Contacts
      </Typography>

      <Stack spacing={1.5}>
        {contacts.map((row, index) => (
          <Stack key={index} direction="row" spacing={1} alignItems="center">
            <TextField
              label="Name"
              value={row.name}
              onChange={(e) => updateContact(index, "name", e.target.value)}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={row.email}
              onChange={(e) => updateContact(index, "email", e.target.value)}
              fullWidth
            />
            <IconButton
              aria-label="Remove contact"
              onClick={() => removeRow(index)}
              disabled={contacts.length === 1}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>

      <Button
        type="button"
        onClick={addRow}
        startIcon={<AddIcon />}
        sx={{ mt: 1, mb: 2, textTransform: "none" }}
      >
        Add another contact
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mt: 1 }}>
          {success}
        </Alert>
      )}

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={saving}
        sx={{
          mt: 3,
          py: 1.4,
          fontWeight: 700,
          textTransform: "none",
          borderRadius: 2,
        }}
      >
        {saving ? (
          <>
            <CircularProgress size={20} sx={{ color: "inherit", mr: 1 }} />
            Saving…
          </>
        ) : (
          "Save Contact Group"
        )}
      </Button>
    </Box>
  );
}
