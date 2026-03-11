import { useRef, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import type { SvgIconComponent } from "@mui/icons-material";

type FileDropZoneProps = {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFilesSelected: (files: FileList | null) => void;
  label?: ReactNode;
  icon?: SvgIconComponent;
};

export default function FileDropZone({
  accept,
  multiple = false,
  disabled = false,
  onFilesSelected,
  label = "Drag & drop files here, or tap to browse",
  icon: Icon = CloudUploadIcon,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!disabled) onFilesSelected(e.dataTransfer.files);
  };

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilesSelected(e.target.files);
    e.target.value = "";
  };

  return (
    <Box
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        p: 3,
        borderRadius: 2,
        border: "2px dashed",
        borderColor: dragActive ? "primary.main" : "divider",
        bgcolor: dragActive ? "action.hover" : "background.default",
        textAlign: "center",
        color: disabled ? "text.disabled" : "text.secondary",
        cursor: disabled ? "default" : "pointer",
        transition: "border-color 0.2s, background-color 0.2s",
        "&:hover": disabled
          ? {}
          : { borderColor: "primary.main", bgcolor: "action.hover" },
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        hidden
        onChange={handleChange}
      />
      <Icon sx={{ fontSize: 36, mb: 0.5, color: "inherit", opacity: 0.7 }} />
      <Typography variant="body2" color="inherit">
        {label}
      </Typography>
    </Box>
  );
}
