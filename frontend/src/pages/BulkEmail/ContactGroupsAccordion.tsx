import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
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

type ContactGroup = {
  id: number;
  group_name: string;
  contacts: ContactRow[];
};

export default function ContactGroupsAccordion({ onSaved }: Props) {
  const [groupName, setGroupName] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([
    { name: "", email: "" },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 👇 New state for viewing saved groups
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState("");

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

  // 👇 Load groups from backend
  async function fetchGroups() {
    setGroupsError("");
    setLoadingGroups(true);
    try {
      const res = await apiFetch("/api/contact-groups/", {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setGroupsError(data?.error || "Failed to load contact groups");
        return;
      }

      setGroups(data.groups || []);
    } catch {
      setGroupsError("Unable to load contact groups");
    } finally {
      setLoadingGroups(false);
    }
  }

  // Load on mount
  useEffect(() => {
    fetchGroups();
  }, []);

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

      // 🔁 Refresh list after saving
      fetchGroups();
      onSaved();
    } catch {
      setError("Unable to save contact group");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box>
      {/* Form */}
      <Box component="form" onSubmit={handleSave}>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Create a contact group so you can quickly select recipients when
          sending bulk emails.
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

      {/* Saved groups list */}
      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Saved contact groups
      </Typography>

      {loadingGroups && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <CircularProgress size={18} />
          <Typography variant="body2">Loading groups…</Typography>
        </Stack>
      )}

      {groupsError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {groupsError}
        </Alert>
      )}

      {!loadingGroups && !groupsError && groups.length === 0 && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          No contact groups yet. Create one above.
        </Typography>
      )}

      <Stack spacing={1.5} sx={{ mt: 1 }}>
        {groups.map((group) => (
          <Box
            key={group.id}
            sx={{
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              p: 1.5,
            }}
          >
            <Typography variant="subtitle2">{group.group_name}</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {group.contacts.length} contact
              {group.contacts.length === 1 ? "" : "s"}
            </Typography>

            {group.contacts.length > 0 && (
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {group.contacts.slice(0, 3).map((c, idx) => (
                  <Typography
                    key={idx}
                    variant="body2"
                    sx={{ fontSize: "0.8rem" }}
                  >
                    {c.name} &lt;{c.email}&gt;
                  </Typography>
                ))}
                {group.contacts.length > 3 && (
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                  >
                    + {group.contacts.length - 3} more…
                  </Typography>
                )}
              </Stack>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
