import Box, { type BoxProps } from "@mui/material/Box";

type FlexWrapRowProps = BoxProps & {
  gap?: number | string;
};

export default function FlexWrapRow({
  children,
  gap = 1,
  sx,
  ...props
}: FlexWrapRowProps) {
  return (
    <Box
      sx={[{ display: "flex", gap, flexWrap: "wrap" }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...props}
    >
      {children}
    </Box>
  );
}
