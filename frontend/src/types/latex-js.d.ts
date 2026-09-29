declare module "latex.js" {
  export class HtmlGenerator {
    constructor(options?: {
      hyphenate?: boolean;
      languagePatterns?: unknown;
      documentClass?: string;
      styles?: string[];
    });
    reset(): void;
    htmlDocument(baseURL?: string): Document;
    domFragment(): DocumentFragment;
  }

  export class SyntaxError extends Error {
    location?: {
      start: { line: number; column: number; offset: number };
      end: { line: number; column: number; offset: number };
    };
  }

  export function parse(
    latex: string,
    options: { generator: HtmlGenerator },
  ): HtmlGenerator;
}
