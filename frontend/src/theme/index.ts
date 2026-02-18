import type { Theme } from "@mui/material/styles";

const themeEntries = Object.entries(import.meta.glob("./*.ts", { eager: true }))
  .filter(([path]) => !path.endsWith("theme.d.ts"))
  .map(([path, module]) => {
    const name = path.split("/").pop()!.replace(".ts", "");
    return [name, (module as { default: Theme }).default] as const;
  });

export const themes = Object.fromEntries(themeEntries) as Record<string, Theme>;

export type ThemeName = keyof typeof themes & string;
