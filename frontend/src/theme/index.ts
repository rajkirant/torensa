import type { Theme } from "@mui/material/styles";
import type { SvgIconComponent } from "@mui/icons-material";

type ThemeModule = { default: Theme; icon?: SvgIconComponent };

const themeEntries = Object.entries(
  import.meta.glob<ThemeModule>("./*.ts", { eager: true })
).filter(([path]) => !path.endsWith("theme.d.ts"));

export const themes = Object.fromEntries(
  themeEntries.map(([path, mod]) => [
    path.split("/").pop()!.replace(".ts", ""),
    mod.default,
  ])
) as Record<string, Theme>;

export const themeIconComponents = Object.fromEntries(
  themeEntries
    .filter(([, mod]) => mod.icon)
    .map(([path, mod]) => [
      path.split("/").pop()!.replace(".ts", ""),
      mod.icon!,
    ])
) as Record<string, SvgIconComponent>;

export type ThemeName = keyof typeof themes & string;
