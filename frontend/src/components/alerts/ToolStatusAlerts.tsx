import type { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import type { SxProps, Theme } from "@mui/material/styles";
import type { AlertColor } from "@mui/material/Alert";

type ToolStatusSeverity = "error" | "success" | "info" | "warning";

type ToolStatusAlertsProps = {
  error?: ReactNode;
  success?: ReactNode;
  info?: ReactNode;
  warning?: ReactNode;
  sx?: SxProps<Theme>;
  slotSx?: Partial<Record<ToolStatusSeverity, SxProps<Theme>>>;
  slotIcon?: Partial<Record<ToolStatusSeverity, ReactNode>>;
  slotColor?: Partial<Record<ToolStatusSeverity, AlertColor>>;
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
  slotIcon,
  slotColor,
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
            color={slotColor?.[severity]}
            icon={slotIcon?.[severity]}
            sx={[sx, slotSx?.[severity]]}
          >
            {message}
          </Alert>
        );
      })}
    </>
  );
}
