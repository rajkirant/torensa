import { useRef, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import type { SvgIconComponent } from "@mui/icons-material";

type FileDropZoneProps = {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFilesSelected: (files: FileList | null) => void;
  onClear?: () => void;
  clearLabel?: ReactNode;
  clearDisabled?: boolean;
  label?: ReactNode;
  icon?: SvgIconComponent;
};

export default function FileDropZone({
  accept,
  multiple = false,
  disabled = false,
  onFilesSelected,
  onClear,
  clearLabel = "Clear",
  clearDisabled = false,
  label = "Drag & drop files here, or tap to browse",
  icon: Icon = CloudUploadIcon,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const isClearDisabled = disabled || clearDisabled;

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

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isClearDisabled) return;
    if (inputRef.current) inputRef.current.value = "";
    onClear?.();
  };

  return (
    <Box
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={(theme) => ({
        p: 3,
        position: "relative",
        borderRadius: 2,
        border: "2px dashed",
        borderColor: dragActive ? "primary.main" : "divider",
        bgcolor: dragActive ? theme.dropzone.active : theme.dropzone.background,
        textAlign: "center",
        color: disabled ? "text.disabled" : "text.secondary",
        cursor: disabled ? "default" : "pointer",
        transition: "border-color 0.2s, background-color 0.2s",
        "&:hover": disabled
          ? {}
          : { borderColor: "primary.main", bgcolor: theme.dropzone.active },
      })}
    >
      {onClear && (
        <Button
          size="small"
          variant="text"
          color="inherit"
          disabled={isClearDisabled}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={handleClear}
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            minWidth: 0,
            px: 1,
            textTransform: "none",
            bgcolor: "action.hover",
            border: "1px solid",
            borderColor: "divider",
            "&:hover": {
              bgcolor: "action.selected",
            },
          }}
        >
          {clearLabel}
        </Button>
      )}
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
