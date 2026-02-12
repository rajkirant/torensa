import Button, { type ButtonProps } from "@mui/material/Button";

type TransparentButtonProps = ButtonProps & {
  label: string;
};

export function TransparentButton({ label, sx, ...props }: TransparentButtonProps) {
  return (
    <Button variant="outlined" sx={[{ textTransform: "none" }, ...(Array.isArray(sx) ? sx : [sx])]} {...props}>
      {label}
    </Button>
  );
}
