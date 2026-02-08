import type { ChangeEvent, ReactNode, Ref } from "react";
import Button, { type ButtonProps } from "@mui/material/Button";

type FilePickerButtonProps = Omit<ButtonProps, "children" | "component"> & {
  label: ReactNode;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFilesSelected: (files: FileList | null) => void;
  inputRef?: Ref<HTMLInputElement>;
  resetAfterSelect?: boolean;
};

export default function FilePickerButton({
  label,
  accept,
  multiple = false,
  disabled = false,
  onFilesSelected,
  inputRef,
  resetAfterSelect = false,
  ...buttonProps
}: FilePickerButtonProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFilesSelected(event.target.files);

    if (resetAfterSelect) {
      event.target.value = "";
    }
  };

  return (
    <Button component="label" disabled={disabled} {...buttonProps}>
      {label}
      <input
        ref={inputRef}
        hidden
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
      />
    </Button>
  );
}
