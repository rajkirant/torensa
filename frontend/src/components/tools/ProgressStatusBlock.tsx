import { type ReactNode } from "react";
import LinearProgress from "@mui/material/LinearProgress";
import Stack, { type StackProps } from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

type ProgressStatusBlockProps = StackProps & {
  done?: number;
  total?: number;
  label?: ReactNode;
};

export default function ProgressStatusBlock({
  done,
  total,
  label,
  ...props
}: ProgressStatusBlockProps) {
  const hasProgress =
    typeof done === "number" && typeof total === "number" && total > 0;

  const progressValue = hasProgress ? (done / total) * 100 : undefined;
  const resolvedLabel = label ?? (hasProgress ? `${done}/${total}` : null);

  return (
    <Stack spacing={0.75} {...props}>
      <LinearProgress
        variant={hasProgress ? "determinate" : "indeterminate"}
        value={progressValue}
      />
      {resolvedLabel ? (
        <Typography variant="caption" color="text.secondary">
          {resolvedLabel}
        </Typography>
      ) : null}
    </Stack>
  );
}
