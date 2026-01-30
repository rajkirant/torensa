// components/BusyChip.tsx
import { Chip } from "@mui/material";

type Props = {
  label?: string;
};

export default function BusyChip({ label = "Building..." }: Props) {
  return <Chip size="small" label={label} color="default" variant="outlined" />;
}
