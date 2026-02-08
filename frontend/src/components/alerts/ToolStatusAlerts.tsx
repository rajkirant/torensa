import type { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import type { SxProps, Theme } from "@mui/material/styles";

type ToolStatusSeverity = "error" | "success" | "info" | "warning";

type ToolStatusAlertsProps = {
  error?: ReactNode;
  success?: ReactNode;
  info?: ReactNode;
  warning?: ReactNode;
  sx?: SxProps<Theme>;
  slotSx?: Partial<Record<ToolStatusSeverity, SxProps<Theme>>>;
  order?: ToolStatusSeverity[];
};

const hasMessage = (value: ReactNode | undefined) =>
  value !== null && value !== undefined && value !== "";

export default function ToolStatusAlerts({
  error,
  success,
  info,
  warning,
  sx,
  slotSx,
  order = ["error", "success", "info", "warning"],
}: ToolStatusAlertsProps) {
  const messages: Record<ToolStatusSeverity, ReactNode | undefined> = {
    error,
    success,
    info,
    warning,
  };

  return (
    <>
      {order.map((severity) => {
        const message = messages[severity];
        if (!hasMessage(message)) return null;

        return (
          <Alert
            key={severity}
            severity={severity}
            sx={[sx, slotSx?.[severity]]}
          >
            {message}
          </Alert>
        );
      })}
    </>
  );
}
