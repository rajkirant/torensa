const themeEntries = Object.entries(import.meta.glob("./*.ts", { eager: true }))
  .filter(([path]) => !path.endsWith("theme.d.ts"))
  .map(([path, module]) => {
    const name = path.split("/").pop()!.replace(".ts", "");
    return [name, (module as any).default] as const; // <-- const assertion here
  });

export const themes = Object.fromEntries(themeEntries);

export type ThemeName = keyof typeof themes;
