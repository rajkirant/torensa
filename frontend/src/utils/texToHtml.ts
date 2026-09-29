import katex from "katex";
import type * as Ast from "@unified-latex/unified-latex-types";
import { parseAlignEnvironment } from "@unified-latex/unified-latex-util-align";
import { expandUnicodeLigatures } from "@unified-latex/unified-latex-util-ligatures";
import { getParser } from "@unified-latex/unified-latex-util-parse";
import { printRaw } from "@unified-latex/unified-latex-util-print-raw";

/**
 * A tolerant LaTeX -> HTML renderer for previewing documents in the browser.
 *
 * It is not a TeX engine: it understands the structure most papers use
 * (title block, sections, lists, tables, floats, math, citations and
 * cross-references) and degrades gracefully on anything else instead of
 * failing, so documents written for classes such as acmart or IEEEtran still
 * render. Math is typeset with KaTeX.
 */

export type TexRenderResult = {
  /** Body HTML (without <html>/<head>). */
  html: string;
  /** Plain-text document title, if the source sets one. */
  title: string;
  /** Human-readable notes about content the preview could not show. */
  notes: string[];
  /** Page geometry derived from \documentclass options and geometry. */
  layout: DocLayout;
  /** TikZ pictures to compile; the HTML holds a placeholder for each. */
  tikz: TikzJob[];
};

/** A TikZ picture ready for TikZJax (see tikzRender.ts). */
export type TikzJob = {
  key: string;
  source: string;
  dataset: { tikzLibraries?: string; texPackages?: string; addToPreamble?: string };
};

// Packages TikZJax can load in addition to tikz and xcolor.
const TIKZJAX_PACKAGES = new Set([
  "amsbsy", "amsfonts", "amsgen", "amsmath", "amsopn", "amssymb", "amstext",
  "array", "etoolbox", "hf-tikz", "pgfplots", "tikz-3dplot", "tikz-cd", "xparse",
]);

/** Page geometry in TeX points (1in = 72pt). */
export type DocLayout = {
  /** Lower-case class name, e.g. "acmart", "ieeetran", "article". */
  docClass: string;
  /** Font family preset used for the page view. */
  family: "acm" | "times" | "cm";
  columns: 1 | 2;
  paperWidth: number;
  paperHeight: number;
  marginLeft: number;
  marginTop: number;
  textWidth: number;
  textHeight: number;
  columnSep: number;
  fontSize: number;
  baselineSkip: number;
};

const PAPER_SIZES: Record<string, [number, number]> = {
  letterpaper: [612, 792],
  a4paper: [595.28, 841.89],
  a5paper: [419.53, 595.28],
  b5paper: [498.9, 708.66],
  legalpaper: [612, 1008],
  executivepaper: [522, 756],
};

function lengthToPt(value: string): number | null {
  const match = value.trim().match(/^(-?[\d.]+)\s*(pt|bp|in|cm|mm|pc|em)?$/);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2] ?? "pt";
  const factor: Record<string, number> = {
    pt: 1, bp: 72 / 72.27, in: 72, cm: 72 / 2.54, mm: 72 / 25.4, pc: 12, em: 10,
  };
  return Number.isFinite(n) ? n * factor[unit] : null;
}

function parseKeyValues(options: string) {
  const map = new Map<string, string>();
  for (const part of options.split(",")) {
    const [key, ...rest] = part.split("=");
    if (key.trim()) map.set(key.trim(), rest.join("=").trim());
  }
  return map;
}

/**
 * Approximates the page geometry LaTeX would use, from the document class,
 * its options and the geometry package. Values are in points.
 */
export function detectLayout(source: string): DocLayout {
  const cls = source.match(
    /\\documentclass\s*(?:\[([^\]]*)\])?\s*\{\s*([^}\s]+)\s*\}/,
  );
  const docClass = (cls?.[2] ?? "article").toLowerCase();
  const options = (cls?.[1] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const has = (name: string) => options.includes(name);
  const sizeOption = options.find((o) => /^(9|10|11|12)pt$/.test(o));
  const paperOption = options.find((o) => o in PAPER_SIZES);

  let layout: DocLayout;
  if (docClass === "acmart") {
    const twoColumn = ["sigconf", "sigplan", "acmtog"].some(has);
    layout = twoColumn
      ? {
          docClass, family: "acm", columns: 2,
          paperWidth: 612, paperHeight: 792, marginLeft: 53.5, marginTop: 75,
          textWidth: 506, textHeight: 645, columnSep: 24,
          fontSize: 9, baselineSkip: 11,
        }
      : {
          docClass, family: "acm", columns: 1,
          paperWidth: 612, paperHeight: 792, marginLeft: 90, marginTop: 80,
          textWidth: 432, textHeight: 620, columnSep: 0,
          fontSize: 10, baselineSkip: 12.5,
        };
  } else if (docClass === "ieeetran") {
    const size = sizeOption ? Number.parseInt(sizeOption, 10) : 10;
    layout = {
      docClass, family: "times", columns: has("onecolumn") ? 1 : 2,
      paperWidth: 612, paperHeight: 792, marginLeft: 48, marginTop: 54,
      textWidth: 516, textHeight: 682, columnSep: 14.4,
      fontSize: size, baselineSkip: size * 1.2,
    };
  } else {
    // Standard classes (article, report, book) and a sensible default for
    // anything else.
    const size = sizeOption ? Number.parseInt(sizeOption, 10) : 10;
    const baseline = { 9: 11, 10: 12, 11: 13.6, 12: 14.5 }[size] ?? 12;
    const [paperWidth, paperHeight] =
      PAPER_SIZES[paperOption ?? (docClass === "llncs" ? "a4paper" : "letterpaper")];
    const twoColumn = has("twocolumn");
    const single = { 9: 345, 10: 345, 11: 360, 12: 390 }[size] ?? 345;
    const textWidth = twoColumn
      ? Math.min(paperWidth - 144, 2 * single)
      : Math.min(paperWidth - 144, single);
    const textHeight = Math.floor((paperHeight - 252) / baseline) * baseline;
    layout = {
      docClass, family: "cm", columns: twoColumn ? 2 : 1,
      paperWidth, paperHeight,
      marginLeft: (paperWidth - textWidth) / 2,
      marginTop: (paperHeight - textHeight) / 2 - 12,
      textWidth, textHeight, columnSep: twoColumn ? 10 : 0,
      fontSize: size, baselineSkip: baseline,
    };
  }

  // The geometry package overrides the class defaults.
  const geometry =
    source.match(/\\usepackage\s*\[([^\]]*)\]\s*\{geometry\}/)?.[1] ??
    source.match(/\\geometry\s*\{([^}]*)\}/)?.[1];
  if (geometry) {
    const kv = parseKeyValues(geometry);
    const len = (key: string) => {
      const value = kv.get(key);
      return value ? lengthToPt(value) : null;
    };
    const paper = [...kv.keys()].find((k) => k in PAPER_SIZES);
    if (paper) [layout.paperWidth, layout.paperHeight] = PAPER_SIZES[paper];
    const margin = len("margin");
    const hmargin = len("hmargin") ?? margin;
    const vmargin = len("vmargin") ?? margin;
    const left = len("left") ?? len("lmargin") ?? hmargin;
    const right = len("right") ?? len("rmargin") ?? hmargin ?? left;
    const top = len("top") ?? len("tmargin") ?? vmargin;
    const bottom = len("bottom") ?? len("bmargin") ?? vmargin ?? top;
    if (left != null && right != null) {
      layout.marginLeft = left;
      layout.textWidth = layout.paperWidth - left - right;
    }
    if (top != null && bottom != null) {
      layout.marginTop = top;
      layout.textHeight = layout.paperHeight - top - bottom;
    }
  }
  if (/^\s*\\twocolumn\b/m.test(source)) layout.columns = 2;
  if (layout.columns === 2 && !layout.columnSep) layout.columnSep = 10;
  return layout;
}

// Signatures for macros the default parser does not know, so their arguments
// are attached instead of being left as loose groups.
const EXTRA_MACROS: Record<string, { signature: string }> = {
  ccsdesc: { signature: "o m" },
  keywords: { signature: "m" },
  settopmatter: { signature: "m" },
  affiliation: { signature: "o m" },
  institution: { signature: "m" },
  department: { signature: "m" },
  streetaddress: { signature: "m" },
  city: { signature: "m" },
  state: { signature: "m" },
  country: { signature: "m" },
  postcode: { signature: "m" },
  email: { signature: "m" },
  orcid: { signature: "m" },
  additionalaffiliation: { signature: "m" },
  acmConference: { signature: "o m m m" },
  acmBooktitle: { signature: "m" },
  acmYear: { signature: "m" },
  acmDOI: { signature: "m" },
  acmISBN: { signature: "m" },
  acmPrice: { signature: "m" },
  acmJournal: { signature: "m" },
  acmVolume: { signature: "m" },
  acmNumber: { signature: "m" },
  acmArticle: { signature: "m" },
  acmMonth: { signature: "m" },
  acmSubmissionID: { signature: "m" },
  copyrightyear: { signature: "m" },
  setcopyright: { signature: "m" },
  Description: { signature: "o m" },
  citep: { signature: "o o m" },
  citet: { signature: "o o m" },
  citealp: { signature: "o o m" },
  citeauthor: { signature: "m" },
  citeyear: { signature: "m" },
  autoref: { signature: "m" },
  cref: { signature: "m" },
  Cref: { signature: "m" },
  eqref: { signature: "m" },
  usetikzlibrary: { signature: "m" },
  tikzset: { signature: "m" },
  cmidrule: { signature: "o d() m" },
  multirow: { signature: "o m o m m" },
  textcolor: { signature: "o m m" },
  colorbox: { signature: "o m m" },
  IEEEauthorblockN: { signature: "m" },
  IEEEauthorblockA: { signature: "m" },
  IEEEkeywords: { signature: "" },
  subfloat: { signature: "o o m" },
};

const SIZE_DECLARATIONS: Record<string, string> = {
  tiny: "0.6em",
  scriptsize: "0.7em",
  footnotesize: "0.8em",
  small: "0.9em",
  normalsize: "1em",
  large: "1.2em",
  Large: "1.44em",
  LARGE: "1.73em",
  huge: "2.07em",
  Huge: "2.49em",
};

const STYLE_DECLARATIONS: Record<string, string> = {
  bfseries: "font-weight:bold",
  bf: "font-weight:bold",
  itshape: "font-style:italic",
  it: "font-style:italic",
  em: "font-style:italic",
  slshape: "font-style:oblique",
  sl: "font-style:oblique",
  ttfamily: "font-family:var(--tex-mono)",
  tt: "font-family:var(--tex-mono)",
  sffamily: "font-family:var(--tex-sans)",
  sf: "font-family:var(--tex-sans)",
  rmfamily: "font-family:var(--tex-serif)",
  rm: "font-family:var(--tex-serif)",
  scshape: "font-variant:small-caps",
  sc: "font-variant:small-caps",
  upshape: "font-style:normal",
  mdseries: "font-weight:normal",
  normalfont: "font-weight:normal;font-style:normal",
  centering: "display:block;text-align:center",
  raggedright: "display:block;text-align:left",
  raggedleft: "display:block;text-align:right",
};

const TEXT_WRAPPERS: Record<string, [string, string]> = {
  textbf: ["<strong>", "</strong>"],
  textit: ["<em>", "</em>"],
  emph: ["<em>", "</em>"],
  textsl: ["<em>", "</em>"],
  texttt: ["<code>", "</code>"],
  underline: ["<u>", "</u>"],
  uline: ["<u>", "</u>"],
  textsc: ['<span style="font-variant:small-caps">', "</span>"],
  textsf: ['<span style="font-family:var(--tex-sans)">', "</span>"],
  textrm: ["<span>", "</span>"],
  textup: ["<span>", "</span>"],
  textmd: ["<span>", "</span>"],
  textnormal: ["<span>", "</span>"],
  mbox: ["<span>", "</span>"],
  hbox: ["<span>", "</span>"],
  makebox: ["<span>", "</span>"],
  fbox: ['<span class="tex-fbox">', "</span>"],
  framebox: ['<span class="tex-fbox">', "</span>"],
  textsuperscript: ["<sup>", "</sup>"],
  textsubscript: ["<sub>", "</sub>"],
  enquote: ["“", "”"],
  IEEEauthorblockN: ['<span class="tex-author-name">', "</span>"],
  IEEEauthorblockA: ['<span class="tex-affiliation">', "</span>"],
};

const SYMBOLS: Record<string, string> = {
  LaTeX: "L<sup class=\"tex-a\">a</sup>T<sub class=\"tex-e\">e</sub>X",
  LaTeXe: "L<sup class=\"tex-a\">a</sup>T<sub class=\"tex-e\">e</sub>X 2<sub>ε</sub>",
  TeX: "T<sub class=\"tex-e\">e</sub>X",
  BibTeX: "BibT<sub class=\"tex-e\">e</sub>X",
  ldots: "…",
  dots: "…",
  textellipsis: "…",
  S: "§",
  P: "¶",
  copyright: "©",
  textcopyright: "©",
  textregistered: "®",
  texttrademark: "™",
  dag: "†",
  ddag: "‡",
  textbackslash: "\\",
  textasciitilde: "~",
  textasciicircum: "^",
  textbar: "|",
  textless: "&lt;",
  textgreater: "&gt;",
  textendash: "–",
  textemdash: "—",
  textquoteleft: "‘",
  textquoteright: "’",
  textquotedblleft: "“",
  textquotedblright: "”",
  textdegree: "°",
  textbullet: "•",
  euro: "€",
  pounds: "£",
  textdollar: "$",
  "%": "%",
  $: "$",
  "&": "&amp;",
  "#": "#",
  _: "_",
  "{": "{",
  "}": "}",
  " ": " ",
  ",": " ",
  ";": " ",
  ":": " ",
  thinspace: " ",
  enspace: " ",
  quad: " ",
  qquad: "  ",
  slash: "/",
  checkmark: "✓",
  ss: "ß",
  ae: "æ",
  AE: "Æ",
  oe: "œ",
  OE: "Œ",
  aa: "å",
  AA: "Å",
  o: "ø",
  O: "Ø",
  l: "ł",
  L: "Ł",
  i: "ı",
};

// Commands that only affect layout, metadata or the PDF and have no visible
// counterpart in the preview.
const IGNORED_MACROS = new Set([
  "documentclass", "usepackage", "RequirePackage", "usetikzlibrary", "tikzset",
  "settopmatter", "pagestyle", "thispagestyle", "pagenumbering", "setlength",
  "addtolength", "setcounter", "addtocounter", "stepcounter", "vspace", "vskip",
  "noindent", "indent", "newpage", "clearpage", "cleardoublepage", "pagebreak",
  "nopagebreak", "linebreak", "nolinebreak", "vfill", "protect", "relax", "null",
  "ignorespaces", "makeatletter", "makeatother", "bibliographystyle",
  "acmConference", "acmBooktitle", "acmYear", "acmDOI", "acmISBN", "acmPrice",
  "acmJournal", "acmVolume", "acmNumber", "acmArticle", "acmMonth",
  "acmSubmissionID", "copyrightyear", "setcopyright", "Description",
  "toprule", "midrule", "bottomrule", "hline", "cline", "cmidrule", "centerline",
  "graphicspath", "hypersetup", "urlstyle", "geometry", "onecolumn", "twocolumn",
  "sloppy", "fussy", "frenchspacing", "raggedbottom", "flushbottom",
  "nocite", "hyphenation", "newtheorem", "theoremstyle", "newenvironment",
  "renewenvironment", "DeclareMathOperator", "definecolor", "captionsetup",
  "tabcolsep", "arraystretch", "shortauthors", "shorttitle", "authorsaddresses",
  "footnotetextcopyrightpermission", "IEEEoverridecommandlockouts",
  "IEEEpeerreviewmaketitle", "IEEEauthorrefmark", "balance", "label",
  "@", "/", "-", "leavevmode", "par@", "phantom", "hphantom", "vphantom",
  "smallskip", "medskip", "bigskip", "listoffigures", "listoftables",
]);

const THEOREM_ENVS: Record<string, string> = {
  theorem: "Theorem",
  lemma: "Lemma",
  proposition: "Proposition",
  corollary: "Corollary",
  definition: "Definition",
  example: "Example",
  remark: "Remark",
  conjecture: "Conjecture",
  claim: "Claim",
  assumption: "Assumption",
  observation: "Observation",
  hypothesis: "Hypothesis",
  problem: "Problem",
  question: "Question",
  note: "Note",
  fact: "Fact",
};

const NUMBERED_MATH_ENVS = new Set([
  "equation", "align", "gather", "multline", "eqnarray", "flalign", "alignat",
]);

const SECTION_LEVELS: Record<string, number> = {
  part: -1,
  chapter: 0,
  section: 1,
  subsection: 2,
  subsubsection: 3,
  paragraph: 4,
  subparagraph: 5,
};

const LABEL_KIND_NAMES: Record<string, string> = {
  chapter: "Chapter",
  section: "Section",
  equation: "Equation",
  figure: "Figure",
  table: "Table",
  theorem: "Theorem",
  item: "Item",
};

type UserMacro = { nargs: number; body: string };
type LabelTarget = { num: string; kind: string };

const PLACEHOLDER = "\u0000";
const PARBREAK = '<span class="tex-par"></span>';
// Rendered fragments that are blocks of their own rather than paragraph text.
const BLOCK_START = new RegExp(
  `^\\s*(<(h[1-6]|figure|div|ul|ol|dl|section|blockquote|pre|table|header|hr|p)\\b|${"\u0000"}CCS)`,
);
const MAX_EXPANSION_DEPTH = 20;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSafeUrl(url: string) {
  return /^(https?:|mailto:)/i.test(url.trim());
}

function toRoman(num: number) {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [value, symbol] of map) {
    while (num >= value) {
      out += symbol;
      num -= value;
    }
  }
  return out;
}

function toAlpha(num: number) {
  let out = "";
  while (num > 0) {
    const rem = (num - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    num = Math.floor((num - 1) / 26);
  }
  return out;
}

/** Environment name; the parser sometimes stores it as a string node. */
function envName(node: { env: unknown }): string {
  const env = node.env as string | { content?: unknown };
  if (typeof env === "string") return env;
  return typeof env?.content === "string" ? env.content : "";
}

function argsOf(node: Ast.Macro | Ast.Environment): Ast.Argument[] {
  return node.args ?? [];
}

/** Contents of the `{...}` arguments of a macro, in order. */
function requiredArgs(node: Ast.Macro | Ast.Environment): Ast.Node[][] {
  return argsOf(node)
    .filter((arg) => arg.openMark === "{")
    .map((arg) => arg.content);
}

function optionalArg(node: Ast.Macro | Ast.Environment): Ast.Node[] | null {
  const arg = argsOf(node).find(
    (a) => a.openMark === "[" && a.content.length > 0,
  );
  return arg ? arg.content : null;
}

function lastRequiredArg(node: Ast.Macro | Ast.Environment): Ast.Node[] {
  const req = requiredArgs(node);
  return req.length ? req[req.length - 1] : [];
}

/** Content the parser attached as an unmarked trailing argument (e.g. \item bodies). */
function trailingContent(node: Ast.Macro): Ast.Node[] {
  const args = argsOf(node);
  const last = args[args.length - 1];
  if (last && last.openMark === "" && last.content.length > 0) {
    return last.content;
  }
  return [];
}

function isStarred(node: Ast.Macro) {
  return argsOf(node).some(
    (arg) =>
      arg.openMark === "" &&
      arg.content.length === 1 &&
      arg.content[0].type === "string" &&
      arg.content[0].content === "*",
  );
}

function rawText(nodes: Ast.Node[] | null | undefined): string {
  if (!nodes) return "";
  return printRaw(nodes).trim();
}

function isBlank(nodes: Ast.Node[]) {
  return nodes.every(
    (n) =>
      n.type === "whitespace" ||
      n.type === "parbreak" ||
      n.type === "comment" ||
      (n.type === "string" && n.content.trim() === ""),
  );
}

// Stand-in for an escaped \& so the ligature pass cannot turn it into a
// column separator inside tables.
const ESCAPED_AMP = "\uE000";

/**
 * Prepares a parsed tree for rendering: keeps the space after control symbols
 * such as \& or \% (the ligature pass would drop it), protects \&, and turns
 * accents and ligatures (\"u, --, ``) into Unicode.
 */
function prepareTree(tree: Ast.Root) {
  const visit = (nodes: Ast.Node[]) => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === "macro") {
        if (/^[&%$#_{}]$/.test(node.content) && nodes[i + 1]?.type === "whitespace") {
          nodes[i + 1] = { type: "string", content: " " };
        }
        if (node.content === "&") {
          nodes[i] = { type: "string", content: ESCAPED_AMP };
          continue;
        }
        node.args?.forEach((arg) => visit(arg.content));
      } else if (node.type === "environment" || node.type === "group") {
        visit(node.content);
        if (node.type === "environment") node.args?.forEach((arg) => visit(arg.content));
      }
    }
  };
  visit(tree.content);
  expandUnicodeLigatures(tree);
}

/** Finds \newcommand-style definitions up front so the parser knows their arity. */
function scanUserMacroSignatures(source: string) {
  const signatures: Record<string, { signature: string }> = {};
  const pattern =
    /\\(?:re)?(?:newcommand|providecommand|DeclareRobustCommand)\*?\s*\{?\s*\\([A-Za-z@]+)\s*\}?\s*(?:\[(\d)\])?/g;
  for (const match of source.matchAll(pattern)) {
    const nargs = Number(match[2] ?? 0);
    if (nargs > 0) {
      signatures[match[1]] = { signature: Array(nargs).fill("m").join(" ") };
    }
  }
  return signatures;
}

class TexRenderer {
  private parser: ReturnType<typeof getParser>;
  private userMacros = new Map<string, UserMacro>();
  private katexMacros: Record<string, string> = {};
  private labels = new Map<string, LabelTarget>();
  private lastTarget: LabelTarget = { num: "", kind: "section" };
  private counters = {
    chapter: 0,
    section: 0,
    subsection: 0,
    subsubsection: 0,
    equation: 0,
    figure: 0,
    table: 0,
    theorem: 0,
  };
  private appendix = false;
  private hasChapters = false;
  private floatStack: string[] = [];
  private bibNumbers = new Map<string, string>();
  private citeFallback = new Map<string, number>();
  private footnotes: string[] = [];
  private ccsConcepts: { path: string[]; weight: number }[] = [];
  private ccsPlaced = false;
  private titleHtml = "";
  private titleText = "";
  private authors: string[] = [];
  private dateHtml: string | null = null;
  private hasMaketitle = false;
  private inPreamble = false;
  private expansionDepth = 0;
  private notes = new Map<string, number>();
  private unknownMacros = new Set<string>();
  private docClass: string;
  private source: string;
  private tikzJobs: TikzJob[] = [];
  private tikzLibraries = new Set<string>();
  private tikzPackages = new Map<string, string>();
  private tikzPreamble: string[] = [];
  private macroDefinitions = new Map<string, string>();

  constructor(parser: ReturnType<typeof getParser>, docClass: string, source: string) {
    this.parser = parser;
    this.docClass = docClass;
    this.source = source;
  }

  /** The node's original source text (before ligature and accent processing). */
  private sourceOf(node: Ast.Node): string {
    const pos = (node as { position?: { start: { offset: number }; end: { offset: number } } })
      .position;
    return pos ? this.source.slice(pos.start.offset, pos.end.offset) : printRaw(node);
  }

  /** Records preamble commands TikZ pictures may depend on. */
  private recordTikzContext(node: Ast.Macro): boolean {
    const name = node.content;
    if (name === "usetikzlibrary") {
      rawText(lastRequiredArg(node))
        .split(",")
        .map((lib) => lib.trim())
        .filter(Boolean)
        .forEach((lib) => this.tikzLibraries.add(lib));
      return true;
    }
    if (name === "usepackage" || name === "RequirePackage") {
      const options = rawText(optionalArg(node));
      for (const pkg of rawText(lastRequiredArg(node)).split(",")) {
        const trimmed = pkg.trim();
        if (TIKZJAX_PACKAGES.has(trimmed)) this.tikzPackages.set(trimmed, options);
      }
      return true;
    }
    if (["tikzset", "tikzstyle", "definecolor", "pgfplotsset", "colorlet"].includes(name)) {
      this.tikzPreamble.push(this.sourceOf(node));
      return true;
    }
    return false;
  }

  private renderTikz(node: Ast.Environment, env: string) {
    const source = this.sourceOf(node);
    const packages = Object.fromEntries(this.tikzPackages);
    if (env === "tikzcd") packages["tikz-cd"] = packages["tikz-cd"] ?? "";
    // Include user macros the picture uses.
    const macros = [...this.macroDefinitions]
      .filter(([name]) => new RegExp(`\\\\${name}(?![A-Za-z])`).test(source))
      .map(([, def]) => def);
    const dataset: TikzJob["dataset"] = {};
    if (this.tikzLibraries.size) dataset.tikzLibraries = [...this.tikzLibraries].join(",");
    if (Object.keys(packages).length) dataset.texPackages = JSON.stringify(packages);
    const preamble = [...this.tikzPreamble, ...macros].join("\n");
    if (preamble) dataset.addToPreamble = preamble;
    const index = this.tikzJobs.length;
    this.tikzJobs.push({ key: JSON.stringify([source, dataset]), source, dataset });
    return `<div class="tex-tikz" data-tikz="${index}"></div>`;
  }

  render(root: Ast.Root): Omit<TexRenderResult, "layout"> {
    const docEnv = root.content.find(
      (n): n is Ast.Environment =>
        n.type === "environment" && envName(n) === "document",
    );
    let body: string;
    if (docEnv) {
      const preamble = root.content.slice(0, root.content.indexOf(docEnv));
      this.hasChapters = /\\chapter\b/.test(printRaw(docEnv.content));
      this.inPreamble = true;
      this.renderNodes(preamble);
      this.inPreamble = false;
      body = this.renderBlocks(docEnv.content);
    } else {
      this.hasChapters = /\\chapter\b/.test(printRaw(root.content));
      body = this.renderBlocks(root.content);
    }

    let html = "";
    if (this.hasMaketitle) html += this.renderTitleBlock();
    html += body;
    if (this.ccsConcepts.length && !this.ccsPlaced) {
      html += this.renderCcs();
    }
    if (this.footnotes.length) {
      html +=
        '<hr class="tex-fn-rule">' +
        this.footnotes
          .map(
            (note, i) =>
              `<div class="tex-footnote"><sup>${i + 1}</sup> ${note}</div>`,
          )
          .join("");
    }
    html = this.resolvePlaceholders(html);

    const notes: string[] = [];
    for (const [note, count] of this.notes) {
      notes.push(count > 1 ? `${note} (${count})` : note);
    }
    if (this.unknownMacros.size) {
      const names = [...this.unknownMacros].slice(0, 12).map((n) => `\\${n}`);
      notes.push(
        `Unknown commands shown as plain text: ${names.join(", ")}${
          this.unknownMacros.size > names.length ? ", …" : ""
        }`,
      );
    }
    return { html, title: this.titleText, notes, tikz: this.tikzJobs };
  }

  private note(message: string) {
    this.notes.set(message, (this.notes.get(message) ?? 0) + 1);
  }

  // ---------------------------------------------------------------- nodes

  /**
   * Renders content that forms paragraphs: runs of inline content become
   * <p> blocks, split at blank lines and around block-level output.
   */
  private renderBlocks(nodes: Ast.Node[]): string {
    let out = "";
    let para = "";
    let noIndent = false;
    const flush = () => {
      const text = para.split(PARBREAK).join("");
      if (text.replace(/&nbsp;/g, "").trim()) {
        out += `<p${noIndent ? ' class="tex-noindent"' : ""}>${text.trim()}</p>`;
      }
      para = "";
      noIndent = false;
    };
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === "parbreak") {
        flush();
        continue;
      }
      if (node.type === "macro" && !node.args?.length) {
        const size = SIZE_DECLARATIONS[node.content];
        const style = STYLE_DECLARATIONS[node.content];
        if (size || style) {
          flush();
          const css = size ? `font-size:${size}` : style.replace("display:block;", "");
          return out + `<div style="${css}">${this.renderBlocks(nodes.slice(i + 1))}</div>`;
        }
        if (node.content === "noindent") {
          if (!para.trim()) noIndent = true;
          continue;
        }
      }
      let html = this.renderNode(node);
      if (html.startsWith(PARBREAK)) {
        flush();
        html = html.slice(PARBREAK.length);
      }
      if (BLOCK_START.test(html)) {
        const continuesParagraph =
          para.trim() !== "" && /^\s*<div class="tex-display"/.test(html);
        flush();
        out += html;
        // Text right after display math continues the same paragraph.
        if (continuesParagraph) noIndent = true;
      } else {
        para += html;
      }
    }
    flush();
    return out;
  }

  private renderNodes(nodes: Ast.Node[]): string {
    let out = "";
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === "macro" && !node.args?.length) {
        // Declarations such as {\small ...} or \centering apply to the rest
        // of the current group.
        const size = SIZE_DECLARATIONS[node.content];
        const style = STYLE_DECLARATIONS[node.content];
        if (size || style) {
          const rest = this.renderNodes(nodes.slice(i + 1));
          const css = size ? `font-size:${size}` : style;
          return out + `<span style="${css}">${rest}</span>`;
        }
      }
      out += this.renderNode(node);
    }
    return out;
  }

  private renderNode(node: Ast.Node): string {
    switch (node.type) {
      case "string":
        return node.content === "~"
          ? "&nbsp;"
          : esc(node.content).replace(new RegExp(ESCAPED_AMP, "g"), "&amp;");
      case "whitespace":
        return " ";
      case "parbreak":
        return PARBREAK;
      case "comment":
        return "";
      case "group":
        return this.renderNodes(node.content);
      case "inlinemath":
        return this.math(printRaw(node.content), false);
      case "displaymath":
        return this.displayMath(printRaw(node.content), false);
      case "mathenv":
        return this.renderMathEnv(envName(node), printRaw(node.content));
      case "verb":
        return `<code>${esc(node.content)}</code>`;
      case "verbatim":
        return `<pre class="tex-verbatim">${esc(node.content)}</pre>`;
      case "environment":
        return this.renderEnvironment(node);
      case "macro":
        return this.renderMacro(node);
      default:
        return "";
    }
  }

  // ----------------------------------------------------------------- math

  private math(tex: string, displayMode: boolean) {
    try {
      return katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
        strict: "ignore",
        trust: false,
        macros: { ...this.katexMacros },
      });
    } catch {
      return `<code class="tex-error">${esc(tex)}</code>`;
    }
  }

  private extractLabels(tex: string) {
    const labels: string[] = [];
    const cleaned = tex.replace(/\\label\s*\{([^}]*)\}/g, (_m, key: string) => {
      labels.push(key.trim());
      return "";
    });
    return { cleaned, labels };
  }

  private displayMath(tex: string, numbered: boolean) {
    const { cleaned, labels } = this.extractLabels(tex);
    let body = cleaned;
    const suppressed = /\\(nonumber|notag)\b/.test(body);
    body = body.replace(/\\(nonumber|notag)\b/g, "");
    if (numbered && !suppressed && !/\\tag\*?\s*\{/.test(body)) {
      const num = String(++this.counters.equation);
      this.lastTarget = { num, kind: "equation" };
      body += `\\tag{${num}}`;
    }
    for (const key of labels) this.labels.set(key, this.lastTarget);
    return `<div class="tex-display">${this.math(body, true)}</div>`;
  }

  private renderMathEnv(env: string, content: string) {
    const base = env.replace(/\*$/, "");
    const numbered = !env.endsWith("*") && NUMBERED_MATH_ENVS.has(base);
    let body = content;
    if (["align", "flalign", "alignat", "eqnarray"].includes(base)) {
      if (base === "alignat") body = body.replace(/^\s*\{[^}]*\}/, "");
      body = `\\begin{aligned}${body}\\end{aligned}`;
    } else if (base === "gather" || base === "multline") {
      body = `\\begin{gathered}${body}\\end{gathered}`;
    } else if (base === "math") {
      return this.math(body, false);
    }
    return this.displayMath(body, numbered);
  }

  // --------------------------------------------------------------- macros

  private renderMacro(node: Ast.Macro): string {
    const name = node.content;

    const user = this.userMacros.get(name);
    if (user) return this.expandUserMacro(node, user);

    if (name in SYMBOLS) return SYMBOLS[name];
    if (name in TEXT_WRAPPERS) {
      const [open, close] = TEXT_WRAPPERS[name];
      return open + this.renderNodes(lastRequiredArg(node)) + close;
    }
    if (name in SECTION_LEVELS) return this.renderSection(node);
    if (this.recordTikzContext(node)) return "";
    if (IGNORED_MACROS.has(name)) {
      if (name === "label") this.recordLabel(node);
      return "";
    }

    switch (name) {
      case "newcommand":
      case "renewcommand":
      case "providecommand":
      case "DeclareRobustCommand":
      case "def":
        this.defineMacro(node);
        return "";
      case "title":
        this.titleHtml = this.renderNodes(lastRequiredArg(node));
        this.titleText = rawText(lastRequiredArg(node))
          .replace(/\\[a-zA-Z]+\*?/g, "")
          .replace(/[{}]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        return "";
      case "author": {
        const html = this.renderNodes(lastRequiredArg(node));
        this.authors.push(...html.split(/<span class="tex-and"><\/span>/));
        return "";
      }
      case "and":
        return '<span class="tex-and"></span>';
      case "affiliation":
      case "additionalaffiliation":
        this.appendToLastAuthor(
          `<span class="tex-affiliation">${this.renderNodes(lastRequiredArg(node))}</span>`,
        );
        return "";
      case "email":
        this.appendToLastAuthor(
          `<span class="tex-email">${this.renderNodes(lastRequiredArg(node))}</span>`,
        );
        return "";
      case "institution":
      case "department":
      case "streetaddress":
      case "city":
      case "state":
      case "country":
      case "postcode":
        return `<span class="tex-aff-part">${this.renderNodes(lastRequiredArg(node))}</span>`;
      case "orcid":
        return "";
      case "thanks":
        return this.footnote(lastRequiredArg(node));
      case "date":
        this.dateHtml = this.renderNodes(lastRequiredArg(node));
        return "";
      case "maketitle":
        this.hasMaketitle = true;
        return "";
      case "today":
        return esc(
          new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        );
      case "keywords": {
        const keywords = this.renderNodes(lastRequiredArg(node));
        return this.docClass === "acmart"
          ? `<h2 class="tex-meta-head">Keywords</h2><p class="tex-keywords tex-noindent">${keywords}</p>`
          : `<p class="tex-keywords tex-noindent"><strong>Keywords:</strong> ${keywords}</p>`;
      }
      case "ccsdesc": {
        const path = rawText(lastRequiredArg(node))
          .split(/[~\u00a0]/)
          .map((part) => part.trim())
          .filter(Boolean);
        const weight = Number(rawText(optionalArg(node))) || 0;
        this.ccsConcepts.push({ path, weight });
        if (this.ccsPlaced) return "";
        this.ccsPlaced = true;
        return `${PLACEHOLDER}CCS${PLACEHOLDER}`;
      }
      case "appendix":
        this.appendix = true;
        this.counters.section = 0;
        this.counters.chapter = 0;
        return "";
      case "\\":
      case "newline":
      case "cr":
        return "<br>";
      case "par":
        return PARBREAK;
      case "hfill":
      case "hspace":
        return " ";
      case "item":
        return `<span class="tex-bullet">•</span> ${this.renderNodes(trailingContent(node))}`;
      case "footnote":
        return this.footnote(lastRequiredArg(node));
      case "footnotemark":
      case "footnotetext":
        return "";
      case "caption":
        return this.renderCaption(node);
      case "ref":
      case "pageref":
      case "autoref":
      case "cref":
      case "Cref":
      case "eqref": {
        const keys = rawText(lastRequiredArg(node));
        return `${PLACEHOLDER}REF:${name}:${keys}${PLACEHOLDER}`;
      }
      case "cite":
      case "citep":
      case "citet":
      case "citealp":
      case "citeauthor":
      case "citeyear":
      case "parencite":
      case "textcite":
      case "autocite": {
        const keys = rawText(lastRequiredArg(node))
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
        for (const key of keys) {
          if (!this.citeFallback.has(key)) {
            this.citeFallback.set(key, this.citeFallback.size + 1);
          }
        }
        const noteText = esc(rawText(optionalArg(node)));
        return `${PLACEHOLDER}CITE:${keys.join(",")}|${noteText}${PLACEHOLDER}`;
      }
      case "bibliography":
      case "printbibliography":
      case "addbibresource":
        if (name !== "addbibresource") {
          this.note("BibTeX bibliography (\\bibliography) is not included");
        }
        return "";
      case "url":
      case "nolinkurl": {
        const url = rawText(lastRequiredArg(node));
        return isSafeUrl(url) && name === "url"
          ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><code>${esc(url)}</code></a>`
          : `<code>${esc(url)}</code>`;
      }
      case "href": {
        const [target, text] = requiredArgs(node);
        const url = rawText(target);
        const label = this.renderNodes(text ?? []);
        return isSafeUrl(url)
          ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
          : label;
      }
      case "textcolor": {
        const [color, text] = requiredArgs(node);
        const c = rawText(color);
        const safe = /^[a-zA-Z]+$/.test(c) ? c : "inherit";
        return `<span style="color:${safe}">${this.renderNodes(text ?? [])}</span>`;
      }
      case "colorbox": {
        const [color, text] = requiredArgs(node);
        const c = rawText(color);
        const safe = /^[a-zA-Z]+$/.test(c) ? c : "transparent";
        return `<span style="background:${safe}">${this.renderNodes(text ?? [])}</span>`;
      }
      case "includegraphics": {
        const file = rawText(lastRequiredArg(node));
        this.note("Images (\\includegraphics) are shown as placeholders");
        return `<span class="tex-placeholder">Image: ${esc(file)}</span>`;
      }
      case "resizebox": {
        const width = rawText(requiredArgs(node)[0]);
        const inner = this.renderNodes(lastRequiredArg(node));
        return /^\\(columnwidth|linewidth|textwidth|hsize)$/.test(width)
          ? `<div class="tex-fullwidth">${inner}</div>`
          : inner;
      }
      case "scalebox":
      case "rotatebox":
      case "adjustbox":
      case "raisebox":
      case "parbox":
        return this.renderNodes(lastRequiredArg(node));
      case "multicolumn":
      case "multirow":
      case "subfloat":
        return this.renderNodes(lastRequiredArg(node));
      case "tableofcontents":
        this.note("Table of contents is not generated");
        return "";
      case "newblock":
        return " ";
      case "bibitem":
        return "";
      default:
        return this.renderUnknownMacro(node);
    }
  }

  private renderUnknownMacro(node: Ast.Macro) {
    const args = requiredArgs(node);
    const trailing = trailingContent(node);
    if (!this.inPreamble && /^[A-Za-z]+$/.test(node.content)) {
      this.unknownMacros.add(node.content);
    }
    return (
      args.map((arg) => this.renderNodes(arg)).join(" ") +
      this.renderNodes(trailing)
    );
  }

  private appendToLastAuthor(html: string) {
    if (!this.authors.length) this.authors.push("");
    this.authors[this.authors.length - 1] += html;
  }

  private defineMacro(node: Ast.Macro) {
    const req = requiredArgs(node);
    const nameNodes =
      req[0] ??
      argsOf(node).find((a) => a.content.some((n) => n.type === "macro"))
        ?.content ??
      [];
    const nameNode = nameNodes.find(
      (n): n is Ast.Macro => n.type === "macro",
    );
    if (!nameNode || req.length < 2) return;
    const nargsRaw = argsOf(node).find(
      (a) => a.openMark === "[" && /^\d$/.test(rawText(a.content)),
    );
    const nargs = nargsRaw ? Number(rawText(nargsRaw.content)) : 0;
    this.macroDefinitions.set(nameNode.content, this.sourceOf(node));
    const body = printRaw(req[req.length - 1]).replace(
      new RegExp(ESCAPED_AMP, "g"),
      "\\&",
    );
    this.userMacros.set(nameNode.content, { nargs, body });
    this.katexMacros[`\\${nameNode.content}`] = body;
  }

  private expandUserMacro(node: Ast.Macro, macro: UserMacro) {
    if (this.expansionDepth >= MAX_EXPANSION_DEPTH) return "";
    const args = requiredArgs(node);
    const expanded = macro.body.replace(/#(\d)/g, (_m, d: string) =>
      printRaw(args[Number(d) - 1] ?? []),
    );
    const tree = this.parser.parse(expanded);
    prepareTree(tree);
    this.expansionDepth++;
    try {
      return this.renderNodes(tree.content);
    } finally {
      this.expansionDepth--;
    }
  }

  private footnote(content: Ast.Node[]) {
    this.footnotes.push(this.renderNodes(content));
    const n = this.footnotes.length;
    return `<sup class="tex-fnref">${n}</sup>`;
  }

  private recordLabel(node: Ast.Macro) {
    const key = rawText(lastRequiredArg(node));
    if (key) this.labels.set(key, this.lastTarget);
  }

  // ------------------------------------------------------------ sections

  private renderSection(node: Ast.Macro) {
    const name = node.content;
    const level = SECTION_LEVELS[name];
    const starred = isStarred(node);
    const titleHtml = this.renderNodes(lastRequiredArg(node));
    const c = this.counters;
    let num = "";

    if (!starred && level >= 0 && level <= 3) {
      if (level === 0) {
        c.chapter++;
        c.section = c.subsection = c.subsubsection = 0;
        num = this.appendix ? toAlpha(c.chapter) : String(c.chapter);
      } else if (this.docClass === "ieeetran") {
        // IEEE style: I. Section, A. Subsection, 1) Subsubsection.
        if (level === 1) {
          c.section++;
          c.subsection = c.subsubsection = 0;
          num = this.appendix ? toAlpha(c.section) : toRoman(c.section);
        } else if (level === 2) {
          c.subsection++;
          c.subsubsection = 0;
          num = toAlpha(c.subsection);
        } else {
          c.subsubsection++;
          num = String(c.subsubsection);
        }
      } else if (level === 1) {
        c.section++;
        c.subsection = c.subsubsection = 0;
        const sec =
          this.appendix && !this.hasChapters
            ? toAlpha(c.section)
            : String(c.section);
        const chap = this.appendix ? toAlpha(c.chapter) : String(c.chapter);
        num = this.hasChapters ? `${chap}.${sec}` : sec;
      } else if (level === 2) {
        c.subsection++;
        c.subsubsection = 0;
        num = `${this.sectionPrefix()}.${c.subsection}`;
      } else {
        c.subsubsection++;
        num = `${this.sectionPrefix()}.${c.subsection}.${c.subsubsection}`;
      }
      let refNum = num;
      if (this.docClass === "ieeetran" && level >= 2) {
        const sec = this.appendix ? toAlpha(c.section) : toRoman(c.section);
        refNum = level === 2 ? `${sec}-${num}` : `${sec}-${toAlpha(c.subsection)}${num}`;
      }
      this.lastTarget = {
        num: refNum,
        kind: level === 0 ? "chapter" : "section",
      };
    }

    const shown =
      this.docClass === "ieeetran" && num ? (level === 3 ? `${num})` : `${num}.`) : num;
    const numHtml = shown ? `<span class="tex-secnum">${shown}</span>` : "";
    if (level >= 4) {
      return `${PARBREAK}<strong class="tex-runin">${titleHtml}</strong> `;
    }
    if (level === -1) return `<h1 class="tex-part">${titleHtml}</h1>`;
    const tag = ["h2", "h2", "h3", "h4"][level];
    return `<${tag} class="tex-${name}">${numHtml}${titleHtml}</${tag}>`;
  }

  private sectionPrefix() {
    const c = this.counters;
    const sec =
      this.appendix && !this.hasChapters ? toAlpha(c.section) : String(c.section);
    if (!this.hasChapters) return sec;
    const chap = this.appendix ? toAlpha(c.chapter) : String(c.chapter);
    return `${chap}.${sec}`;
  }

  // -------------------------------------------------------- environments

  private renderEnvironment(node: Ast.Environment): string {
    const env = envName(node);
    const base = env.replace(/\*$/, "");

    if (NUMBERED_MATH_ENVS.has(base) || base === "displaymath" || base === "math") {
      return this.renderMathEnv(env, printRaw(node.content));
    }
    if (base in THEOREM_ENVS) return this.renderTheorem(node, base);

    switch (base) {
      case "document":
        return this.renderNodes(node.content);
      case "abstract": {
        const paragraphs = this.renderBlocks(node.content).replace(
          /<p( class="([^"]*)")?>/g,
          (_m, _c, cls: string | undefined) =>
            `<p class="tex-abstract${cls ? ` ${cls}` : ""}">`,
        );
        return `<h2 class="tex-abstract-title">Abstract</h2>${paragraphs}`;
      }
      case "itemize":
      case "enumerate":
      case "description":
      case "compactitem":
      case "compactenum":
        return this.renderList(node);
      case "quote":
      case "quotation":
      case "verse":
        return `<blockquote>${this.renderNodes(node.content)}</blockquote>`;
      case "center":
        return `<div style="text-align:center">${this.renderNodes(node.content)}</div>`;
      case "flushleft":
        return `<div style="text-align:left">${this.renderNodes(node.content)}</div>`;
      case "flushright":
        return `<div style="text-align:right">${this.renderNodes(node.content)}</div>`;
      case "figure":
      case "table":
      case "wrapfigure":
      case "wraptable":
      case "sidewaysfigure":
      case "sidewaystable":
      case "subfigure":
      case "subtable":
        return this.renderFloat(node, base.includes("table") ? "table" : "figure");
      case "tabular":
      case "tabularx":
      case "tabulary":
      case "longtable":
      case "supertabular":
        return this.renderTabular(node);
      case "tikzpicture":
      case "tikzcd":
        return this.renderTikz(node, base);
      case "pgfpicture":
      case "picture":
      case "forest":
        this.note(`${base} pictures are shown as placeholders`);
        return `<div class="tex-placeholder">${esc(base)} picture - not rendered in the preview</div>`;
      case "thebibliography":
        return this.renderBibliography(node);
      case "proof":
        return `<div class="tex-proof"><em>Proof.</em> ${this.renderNodes(
          node.content,
        )} <span class="tex-qed">∎</span></div>`;
      case "lstlisting":
      case "minted":
      case "Verbatim":
      case "verbatim":
      case "alltt":
        return `<pre class="tex-verbatim">${esc(printRaw(node.content))}</pre>`;
      case "CCSXML":
      case "comment":
      case "IEEEkeywords":
        if (base === "IEEEkeywords") {
          return `<p class="tex-keywords tex-noindent"><strong><em>Index Terms</em>\u2014</strong>${this.renderNodes(
            node.content,
          )}</p>`;
        }
        return "";
      case "appendix":
      case "appendices":
        this.appendix = true;
        this.counters.section = 0;
        this.counters.chapter = 0;
        return this.renderNodes(node.content);
      case "minipage":
      case "adjustbox":
      case "small":
      case "footnotesize":
      case "landscape":
      case "acks":
        if (base === "acks") {
          return `<section><h2>Acknowledgments</h2>${this.renderNodes(node.content)}</section>`;
        }
        return `<div>${this.renderNodes(node.content)}</div>`;
      default:
        return `<div class="tex-env-${esc(base)}">${this.renderNodes(node.content)}</div>`;
    }
  }

  private renderTheorem(node: Ast.Environment, base: string) {
    const num = String(++this.counters.theorem);
    this.lastTarget = { num, kind: "theorem" };
    const extra = optionalArg(node);
    const heading = `${THEOREM_ENVS[base]} ${num}${
      extra ? ` (${this.renderNodes(extra)})` : ""
    }.`;
    return `<div class="tex-theorem"><strong>${heading}</strong> <em>${this.renderNodes(
      node.content,
    )}</em></div>`;
  }

  /** Splits list content at each \item. */
  private splitItems(nodes: Ast.Node[]) {
    const items: { label: Ast.Node[] | null; content: Ast.Node[] }[] = [];
    for (const node of nodes) {
      if (node.type === "macro" && node.content === "item") {
        items.push({ label: optionalArg(node), content: [...trailingContent(node)] });
      } else if (items.length) {
        items[items.length - 1].content.push(node);
      }
    }
    return items;
  }

  private renderList(node: Ast.Environment) {
    const base = envName(node).replace(/\*$/, "");
    const items = this.splitItems(node.content);
    if (base === "description") {
      return (
        '<dl class="tex-description">' +
        items
          .map(
            (item) =>
              `<dt>${this.renderNodes(item.label ?? [])}</dt><dd>${this.renderNodes(
                item.content,
              )}</dd>`,
          )
          .join("") +
        "</dl>"
      );
    }
    const ordered = base === "enumerate" || base === "compactenum";
    const tag = ordered ? "ol" : "ul";
    const lis = items
      .map((item, index) => {
        if (ordered) this.lastTarget = { num: String(index + 1), kind: "item" };
        const label = item.label
          ? `<span class="tex-item-label">${this.renderNodes(item.label)}</span> `
          : "";
        const cls = item.label ? ' class="tex-custom-label"' : "";
        return `<li${cls}>${label}${this.renderNodes(item.content)}</li>`;
      })
      .join("");
    return `<${tag}>${lis}</${tag}>`;
  }

  private renderFloat(node: Ast.Environment, kind: "figure" | "table") {
    this.floatStack.push(kind);
    const placement = rawText(optionalArg(node)).replace(/[^htbpH!]/g, "");
    const wide = envName(node).endsWith("*") ? " tex-float-wide" : "";
    try {
      return `<figure class="tex-float tex-${kind}${wide}" data-placement="${placement || "tbp"}">${this.renderNodes(
        node.content,
      )}</figure>`;
    } finally {
      this.floatStack.pop();
    }
  }

  private renderCaption(node: Ast.Macro) {
    const kind = this.floatStack[this.floatStack.length - 1] ?? "figure";
    const key = kind === "table" ? "table" : "figure";
    const num = String(++this.counters[key]);
    this.lastTarget = { num, kind: key };
    const label = key === "table" ? "Table" : "Figure";
    return `<figcaption><strong>${label} ${num}:</strong> ${this.renderNodes(
      lastRequiredArg(node),
    )}</figcaption>`;
  }

  // --------------------------------------------------------------- tables

  private columnAligns(spec: string): string[] {
    let s = spec;
    // Expand *{n}{cols}.
    s = s.replace(/\*\s*\{(\d+)\}\s*\{([^}]*)\}/g, (_m, n: string, cols: string) =>
      cols.repeat(Number(n)),
    );
    // Drop @{..}, !{..}, >{..}, <{..} decorations and widths.
    s = s.replace(/[@!<>]\s*\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, "");
    const aligns: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "l") aligns.push("left");
      else if (ch === "c") aligns.push("center");
      else if (ch === "r") aligns.push("right");
      else if (ch === "X" || ch === "L" || ch === "J") aligns.push("left");
      else if (ch === "C") aligns.push("center");
      else if (ch === "R") aligns.push("right");
      else if (ch === "S") aligns.push("center");
      else if (ch === "p" || ch === "m" || ch === "b") {
        aligns.push("left");
        // Skip the width argument.
        const open = s.indexOf("{", i);
        if (open !== -1) {
          let depth = 0;
          for (let j = open; j < s.length; j++) {
            if (s[j] === "{") depth++;
            else if (s[j] === "}" && --depth === 0) {
              i = j;
              break;
            }
          }
        }
      }
    }
    return aligns;
  }

  private renderTabular(node: Ast.Environment) {
    const req = requiredArgs(node);
    let specNodes = req[req.length - 1] ?? [];
    let content = node.content;
    // Older parses may leave the column spec as a leading group.
    if (!req.length) {
      const first = content.find((n) => n.type !== "whitespace");
      if (first?.type === "group") {
        specNodes = first.content;
        content = content.slice(content.indexOf(first) + 1);
      }
    }
    const aligns = this.columnAligns(printRaw(specNodes));

    const RULES = new Set(["toprule", "midrule", "bottomrule", "hline", "cline", "cmidrule", "specialrule"]);
    const HEAVY = new Set(["toprule", "bottomrule", "specialrule"]);
    const rows = parseAlignEnvironment(content, ["&"], ["\\", "tabularnewline"]);

    type RenderedRow = { cells: string; borderTop: string; borderBottom: string };
    const rendered: RenderedRow[] = [];
    let pendingTop = "";

    for (const row of rows) {
      const cells = row.cells.map((cell) => [...cell]);
      let ruleBeforeContent = "";
      // Pull rule macros out of cells.
      for (const cell of cells) {
        for (let i = cell.length - 1; i >= 0; i--) {
          const n = cell[i];
          if (n.type === "macro" && RULES.has(n.content)) {
            ruleBeforeContent = HEAVY.has(n.content) ? "heavy" : ruleBeforeContent || "light";
            cell.splice(i, 1);
          }
        }
      }
      const empty = cells.every((cell) => isBlank(cell));
      if (empty) {
        if (ruleBeforeContent) {
          if (rendered.length && pendingTop === "") {
            // A rule after the last row closes the table.
            rendered[rendered.length - 1].borderBottom = ruleBeforeContent;
          } else {
            pendingTop = ruleBeforeContent;
          }
        }
        continue;
      }
      const borderTop = ruleBeforeContent || pendingTop;
      pendingTop = "";

      let col = 0;
      const tds = cells
        .map((cell) => {
          const meaningful = cell.filter((n) => !isBlank([n]));
          let span = 1;
          let align = aligns[col] ?? "left";
          let inner: Ast.Node[] = cell;
          if (
            meaningful.length === 1 &&
            meaningful[0].type === "macro" &&
            meaningful[0].content === "multicolumn"
          ) {
            const [n, spec, body] = requiredArgs(meaningful[0]);
            span = Math.max(1, Number(rawText(n)) || 1);
            align = this.columnAligns(rawText(spec))[0] ?? align;
            inner = body ?? [];
          }
          col += span;
          const colspan = span > 1 ? ` colspan="${span}"` : "";
          return `<td${colspan} style="text-align:${align}">${this.renderNodes(inner).trim()}</td>`;
        })
        .join("");
      rendered.push({ cells: tds, borderTop, borderBottom: "" });
    }
    if (pendingTop && rendered.length) {
      rendered[rendered.length - 1].borderBottom = pendingTop;
    }

    const trs = rendered
      .map((row) => {
        const classes = [
          row.borderTop && `tex-rule-top-${row.borderTop}`,
          row.borderBottom && `tex-rule-bottom-${row.borderBottom}`,
        ]
          .filter(Boolean)
          .join(" ");
        return `<tr${classes ? ` class="${classes}"` : ""}>${row.cells}</tr>`;
      })
      .join("");
    return `<div class="tex-table-wrap"><table class="tex-tabular"><tbody>${trs}</tbody></table></div>`;
  }

  // --------------------------------------------------------- bibliography

  private renderBibliography(node: Ast.Environment) {
    const entries: { key: string; label: string; content: Ast.Node[] }[] = [];
    for (const child of node.content) {
      if (child.type === "macro" && child.content === "bibitem") {
        const key = rawText(lastRequiredArg(child));
        const custom = rawText(optionalArg(child));
        entries.push({
          key,
          label: custom || String(entries.length + 1),
          content: [...trailingContent(child)],
        });
      } else if (entries.length) {
        entries[entries.length - 1].content.push(child);
      }
    }
    for (const entry of entries) this.bibNumbers.set(entry.key, entry.label);
    const items = entries
      .map(
        (entry) =>
          `<div class="tex-bibitem"><span class="tex-bib-label">[${esc(
            entry.label,
          )}]</span> ${this.renderNodes(entry.content).split(PARBREAK).join(" ").trim()}</div>`,
      )
      .join("");
    return `<h2 class="tex-bib-title">References</h2>${items}`;
  }

  // ------------------------------------------------------ title and refs

  private renderTitleBlock() {
    const authors = this.authors
      .filter((a) => a.trim())
      .map((a) => `<div class="tex-author">${a}</div>`)
      .join("");
    return (
      '<header class="tex-titleblock">' +
      (this.titleHtml ? `<h1 class="tex-title">${this.titleHtml}</h1>` : "") +
      (authors ? `<div class="tex-authors">${authors}</div>` : "") +
      (this.dateHtml ? `<div class="tex-date">${this.dateHtml}</div>` : "") +
      "</header>"
    );
  }

  /** CCS concepts grouped by top-level concept, as acmart prints them. */
  private renderCcs() {
    const groups = new Map<string, string[]>();
    for (const { path, weight } of this.ccsConcepts) {
      const [top, ...rest] = path;
      if (!top) continue;
      const leaf = rest.map(esc).join(" \u2192 ");
      const styled = leaf
        ? weight >= 500
          ? `<strong>${leaf}</strong>`
          : `<em>${leaf}</em>`
        : "";
      if (!groups.has(top)) groups.set(top, []);
      if (styled) groups.get(top)!.push(styled);
    }
    const text = [...groups]
      .map(
        ([top, leaves]) =>
          `\u2022 <strong>${esc(top)}</strong>${
            leaves.length ? ` \u2192 ${leaves.join("; ")}` : ""
          };`,
      )
      .join(" ");
    return this.docClass === "acmart"
      ? `<h2 class="tex-meta-head">CCS Concepts</h2><p class="tex-ccs tex-noindent">${text}</p>`
      : `<p class="tex-ccs tex-noindent"><strong>CCS Concepts:</strong> ${text}</p>`;
  }

  private resolvePlaceholders(html: string) {
    const pattern = new RegExp(`${PLACEHOLDER}([^${PLACEHOLDER}]*)${PLACEHOLDER}`, "g");
    return html.replace(pattern, (_m, token: string) => {
      if (token === "CCS") return this.renderCcs();
      if (token.startsWith("REF:")) {
        const [, kind, keys] = token.match(/^REF:([^:]+):([\s\S]*)$/) ?? [];
        return keys
          .split(",")
          .map((key) => {
            const target = this.labels.get(key.trim());
            if (!target) return "??";
            const num = target.num || "??";
            if (kind === "eqref") return `(${num})`;
            if (kind === "autoref" || kind === "cref" || kind === "Cref") {
              const word = LABEL_KIND_NAMES[target.kind] ?? "";
              return `${word ? `${word}&nbsp;` : ""}${num}`;
            }
            return num;
          })
          .join(", ");
      }
      if (token.startsWith("CITE:")) {
        const [keys, noteText] = token.slice(5).split("|");
        const nums = keys
          .split(",")
          .filter(Boolean)
          .map((key) => {
            // Without a thebibliography list (e.g. BibTeX), number citations
            // in the order they first appear.
            const num =
              this.bibNumbers.get(key) ??
              (this.bibNumbers.size
                ? "?"
                : String(this.citeFallback.get(key) ?? "?"));
            return esc(num);
          });
        return `[${nums.join(", ")}${noteText ? `, ${noteText}` : ""}]`;
      }
      return "";
    });
  }
}

/** Renders LaTeX source to body HTML. Never throws on unsupported LaTeX. */
export function texToHtml(source: string): TexRenderResult {
  const cleaned = source.replace(new RegExp(`[${PLACEHOLDER}${ESCAPED_AMP}]`, "g"), "");
  const parser = getParser({
    macros: { ...EXTRA_MACROS, ...scanUserMacroSignatures(cleaned) },
  });
  const tree = parser.parse(cleaned);
  prepareTree(tree);
  const layout = detectLayout(cleaned);
  return { ...new TexRenderer(parser, layout.docClass, cleaned).render(tree), layout };
}

