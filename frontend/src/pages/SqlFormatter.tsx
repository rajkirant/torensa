import { useState } from "react";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { TransparentButton } from "../components/buttons/TransparentButton";
import FlexWrapRow from "../components/layout/FlexWrapRow";
import useToolStatus from "../hooks/useToolStatus";

// ═══════════════════════════════════════════════════════════════
// SQL Keywords (individual words for casing)
// ═══════════════════════════════════════════════════════════════

const SQL_KEYWORD_SET = new Set([
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "EXISTS",
  "BETWEEN", "LIKE", "ILIKE", "SIMILAR", "IS", "NULL",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "RETURNING", "ON", "CONFLICT", "DO", "NOTHING",
  "CREATE", "ALTER", "DROP", "TABLE", "INDEX", "VIEW",
  "DATABASE", "SCHEMA", "TEMPORARY", "TEMP",
  "MATERIALIZED", "REFRESH", "CONCURRENTLY",
  "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CONSTRAINT",
  "DEFAULT", "CHECK", "UNIQUE", "AUTO_INCREMENT", "CASCADE",
  "AS", "DISTINCT", "ALL", "TOP", "LIMIT", "OFFSET",
  "FETCH", "NEXT", "ROWS", "ONLY",
  "ORDER", "BY", "ASC", "DESC", "GROUP", "HAVING",
  "UNION", "INTERSECT", "EXCEPT",
  "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER",
  "CROSS", "NATURAL", "USING", "LATERAL",
  "WITH", "RECURSIVE", "ANY", "SOME",
  "CASE", "WHEN", "THEN", "ELSE", "END",
  "IF", "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION",
  "TRUNCATE", "REPLACE",
  "OVER", "PARTITION", "WINDOW", "RANGE", "UNBOUNDED",
  "PRECEDING", "FOLLOWING", "CURRENT",
  "ROW", "FIRST", "LAST", "NULLS",
  "BOOLEAN", "INTEGER", "VARCHAR", "TEXT", "DATE", "TIMESTAMP",
  "FLOAT", "DECIMAL", "NUMERIC", "BIGINT", "SMALLINT", "CHAR",
  "BLOB", "SERIAL",
  "COUNT", "SUM", "AVG", "MIN", "MAX",
  "ROW_NUMBER", "RANK", "DENSE_RANK", "NTILE", "PERCENT_RANK",
  "LAG", "LEAD",
  "COALESCE", "NULLIF", "CAST", "EXTRACT", "DATE_TRUNC", "ROUND",
  "CURRENT_DATE", "CURRENT_TIMESTAMP", "CURRENT_TIME",
  "GRANT", "REVOKE", "EXPLAIN", "ANALYZE", "VERBOSE",
  "UNNEST", "ARRAY", "TRUE", "FALSE",
]);

/** Keywords that behave like function names (no space before opening paren). */
const FUNC_KEYWORD_SET = new Set([
  "COUNT", "SUM", "AVG", "MIN", "MAX",
  "ROW_NUMBER", "RANK", "DENSE_RANK", "NTILE", "PERCENT_RANK",
  "LAG", "LEAD",
  "COALESCE", "NULLIF", "CAST", "EXTRACT", "DATE_TRUNC", "ROUND",
  "UNNEST", "ARRAY",
  "TRIM", "UPPER", "LOWER", "LENGTH", "SUBSTRING", "REPLACE",
  "CONCAT", "ABS", "CEIL", "FLOOR", "POWER", "SQRT", "MOD",
  "IF", "IIF",
]);

// ═══════════════════════════════════════════════════════════════
// Tokenizer
// ═══════════════════════════════════════════════════════════════

function tokenize(sql: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < sql.length) {
    // Whitespace → single space token
    if (/\s/.test(sql[i])) {
      while (i < sql.length && /\s/.test(sql[i])) i++;
      tokens.push(" ");
      continue;
    }

    // Single-line comment: -- ...
    if (sql[i] === "-" && sql[i + 1] === "-") {
      let end = i;
      while (end < sql.length && sql[end] !== "\n") end++;
      tokens.push(sql.slice(i, end));
      i = end;
      continue;
    }

    // Multi-line comment: /* ... */
    if (sql[i] === "/" && sql[i + 1] === "*") {
      let end = sql.indexOf("*/", i + 2);
      if (end === -1) end = sql.length;
      else end += 2;
      tokens.push(sql.slice(i, end));
      i = end;
      continue;
    }

    // String literal: 'text' or "text"
    if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i];
      let end = i + 1;
      while (end < sql.length) {
        if (sql[end] === quote) {
          if (sql[end + 1] === quote) {
            end += 2;
          } else {
            end++;
            break;
          }
        } else {
          end++;
        }
      }
      tokens.push(sql.slice(i, end));
      i = end;
      continue;
    }

    // Backtick-quoted identifier
    if (sql[i] === "`") {
      let end = sql.indexOf("`", i + 1);
      if (end === -1) end = sql.length;
      else end++;
      tokens.push(sql.slice(i, end));
      i = end;
      continue;
    }

    // Punctuation
    if ("(),;".includes(sql[i])) {
      tokens.push(sql[i]);
      i++;
      continue;
    }

    // Operators (including :: for PostgreSQL casts)
    if ("=<>!+-*/%&|^~:".includes(sql[i])) {
      let end = i + 1;
      while (end < sql.length && "=<>!+-*/%&|^~:".includes(sql[end])) end++;
      tokens.push(sql.slice(i, end));
      i = end;
      continue;
    }

    // Dot
    if (sql[i] === ".") {
      tokens.push(".");
      i++;
      continue;
    }

    // Word (identifier or keyword)
    if (/[\w@#$]/.test(sql[i])) {
      let end = i;
      while (end < sql.length && /[\w@#$]/.test(sql[end])) end++;
      tokens.push(sql.slice(i, end));
      i = end;
      continue;
    }

    // Anything else
    tokens.push(sql[i]);
    i++;
  }

  return tokens;
}

function isStringOrComment(token: string): boolean {
  return (
    token.startsWith("'") ||
    token.startsWith('"') ||
    token.startsWith("--") ||
    token.startsWith("/*") ||
    token.startsWith("`")
  );
}

// ═══════════════════════════════════════════════════════════════
// Compound Keyword Merger
// ═══════════════════════════════════════════════════════════════

/** Sorted longest first for greedy matching. */
const COMPOUNDS: string[][] = [
  // 3-word
  ["FULL", "OUTER", "JOIN"],
  ["LEFT", "OUTER", "JOIN"],
  ["RIGHT", "OUTER", "JOIN"],
  ["IS", "NOT", "NULL"],
  // 2-word
  ["ORDER", "BY"],
  ["GROUP", "BY"],
  ["PARTITION", "BY"],
  ["INSERT", "INTO"],
  ["DELETE", "FROM"],
  ["CREATE", "TABLE"],
  ["ALTER", "TABLE"],
  ["DROP", "TABLE"],
  ["UNION", "ALL"],
  ["LEFT", "JOIN"],
  ["RIGHT", "JOIN"],
  ["INNER", "JOIN"],
  ["CROSS", "JOIN"],
  ["FULL", "JOIN"],
  ["NATURAL", "JOIN"],
  ["NOT", "IN"],
  ["NOT", "EXISTS"],
  ["NOT", "BETWEEN"],
  ["NOT", "LIKE"],
  ["NOT", "ILIKE"],
  ["ROWS", "BETWEEN"],
  ["RANGE", "BETWEEN"],
  ["UNBOUNDED", "PRECEDING"],
  ["UNBOUNDED", "FOLLOWING"],
  ["CURRENT", "ROW"],
];

function tryMatchCompound(
  tokens: string[],
  start: number,
  compound: string[],
): number {
  let ti = start;
  let ci = 0;
  while (ci < compound.length && ti < tokens.length) {
    if (tokens[ti] === " ") {
      ti++;
      continue;
    }
    if (tokens[ti].toUpperCase() === compound[ci]) {
      ci++;
      ti++;
    } else {
      return 0;
    }
  }
  return ci === compound.length ? ti - start : 0;
}

function mergeCompounds(tokens: string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i] === " " || isStringOrComment(tokens[i])) {
      result.push(tokens[i]);
      i++;
      continue;
    }
    let matched = false;
    for (const compound of COMPOUNDS) {
      if (tokens[i].toUpperCase() !== compound[0]) continue;
      const consumed = tryMatchCompound(tokens, i, compound);
      if (consumed > 0) {
        result.push(compound.join(" "));
        i += consumed;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result.push(tokens[i]);
      i++;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// Keyword Case Changer
// ═══════════════════════════════════════════════════════════════

function changeKeywordCase(sql: string, toUpper: boolean): string {
  const tokens = tokenize(sql);
  return tokens
    .map((token) => {
      if (isStringOrComment(token)) return token;
      if (SQL_KEYWORD_SET.has(token.toUpperCase())) {
        return toUpper ? token.toUpperCase() : token.toLowerCase();
      }
      return token;
    })
    .join("");
}

// ═══════════════════════════════════════════════════════════════
// Formatter
// ═══════════════════════════════════════════════════════════════

type IndentStyle = "2spaces" | "4spaces" | "tab";
type ParenType = "block" | "window" | "func";

function indentStr(style: IndentStyle): string {
  if (style === "tab") return "\t";
  if (style === "4spaces") return "    ";
  return "  ";
}

const MAJOR_CLAUSE_SET = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "SET",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "VALUES",
  "UPDATE",
  "DELETE",
  "INSERT",
  "RETURNING",
  "FETCH",
  "WITH",
  "ORDER BY",
  "GROUP BY",
  "INSERT INTO",
  "DELETE FROM",
  "CREATE TABLE",
  "ALTER TABLE",
  "DROP TABLE",
  "UNION",
  "UNION ALL",
  "INTERSECT",
  "EXCEPT",
]);

const JOIN_CLAUSE_SET = new Set([
  "JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "CROSS JOIN",
  "FULL JOIN",
  "FULL OUTER JOIN",
  "LEFT OUTER JOIN",
  "RIGHT OUTER JOIN",
  "NATURAL JOIN",
]);

const WINDOW_CLAUSE_SET = new Set([
  "PARTITION BY",
  "ORDER BY",
  "ROWS BETWEEN",
  "RANGE BETWEEN",
]);

function isKw(s: string): boolean {
  const u = s.toUpperCase();
  return (
    SQL_KEYWORD_SET.has(u) ||
    MAJOR_CLAUSE_SET.has(u) ||
    JOIN_CLAUSE_SET.has(u) ||
    WINDOW_CLAUSE_SET.has(u)
  );
}

function formatSql(sql: string, indentStyle: IndentStyle): string {
  const rawTokens = tokenize(sql.trim());
  if (rawTokens.length === 0) return "";

  const merged = mergeCompounds(rawTokens);

  // Clean: strip whitespace, uppercase keywords
  const tokens: string[] = [];
  for (const t of merged) {
    if (t === " ") continue;
    if (isStringOrComment(t)) {
      tokens.push(t);
    } else if (isKw(t)) {
      tokens.push(t.toUpperCase());
    } else {
      tokens.push(t);
    }
  }

  const pad = indentStr(indentStyle);
  const lines: string[] = [];
  let line = "";
  let indent = 0;
  let lineStartedWithClause = false;

  const parenStack: { type: ParenType; baseIndent: number }[] = [];
  let betweenActive = false;
  const caseStack: number[] = [];
  let inCaseWhen = false;

  // ── Helpers ──

  function base(): number {
    return parenStack.length > 0
      ? parenStack[parenStack.length - 1].baseIndent
      : 0;
  }

  function ctxType(): ParenType | null {
    return parenStack.length > 0
      ? parenStack[parenStack.length - 1].type
      : null;
  }

  function flush() {
    const s = line.trim();
    if (s) lines.push(pad.repeat(indent) + s);
    line = "";
    lineStartedWithClause = false;
  }

  function append(token: string) {
    if (!line) {
      line = token;
      return;
    }
    const last = line[line.length - 1];
    const first = token[0];

    // No space around dots
    if (first === "." || last === ".") {
      line += token;
      return;
    }
    // No space before ) , ;
    if (first === ")" || first === "," || first === ";") {
      line += token;
      return;
    }
    // No space after (
    if (last === "(") {
      line += token;
      return;
    }
    // ( — check if function call (no space) vs keyword (space)
    if (first === "(") {
      const lastWord = line.match(/(\w+)\s*$/)?.[1]?.toUpperCase() ?? "";
      if (
        lastWord &&
        (FUNC_KEYWORD_SET.has(lastWord) || !SQL_KEYWORD_SET.has(lastWord))
      ) {
        line += token;
      } else {
        if (last !== " ") line += " ";
        line += token;
      }
      return;
    }
    // Default: add space
    if (last !== " ") line += " ";
    line += token;
  }

  /** Classify what a ( means by looking at context. */
  function classifyParen(index: number): ParenType {
    // Check previous token
    if (index > 0 && tokens[index - 1] === "OVER") return "window";

    // Function keywords (EXTRACT, ROUND, COUNT, etc.) always produce func context
    if (index > 0 && FUNC_KEYWORD_SET.has(tokens[index - 1])) return "func";

    // Non-keyword identifiers followed by ( are function calls
    if (
      index > 0 &&
      /^\w+$/.test(tokens[index - 1]) &&
      !SQL_KEYWORD_SET.has(tokens[index - 1])
    )
      return "func";

    // Look inside for major clause keywords → subquery / CTE body
    let depth = 0;
    for (let j = index; j < tokens.length; j++) {
      const t = tokens[j];
      if (t === "(") depth++;
      if (t === ")") {
        depth--;
        if (depth === 0) break;
      }
      if (depth === 1 && MAJOR_CLAUSE_SET.has(t)) return "block";
    }

    return "func";
  }

  // ── Main loop ──

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const upper = typeof t === "string" ? t.toUpperCase() : t;
    const ct = ctxType();

    // ── Comments ──────────────────────────────────────────
    if (t.startsWith("--") || t.startsWith("/*")) {
      flush();
      lines.push(pad.repeat(indent) + t);
      continue;
    }

    // ── Strings / backtick identifiers ───────────────────
    if (isStringOrComment(t)) {
      append(t);
      continue;
    }

    // ── CASE / WHEN / THEN / ELSE / END ──────────────────
    if (upper === "CASE") {
      append(t);
      caseStack.push(indent);
      continue;
    }
    if (upper === "WHEN" && caseStack.length > 0) {
      flush();
      indent = caseStack[caseStack.length - 1] + 1;
      line = t;
      inCaseWhen = true;
      continue;
    }
    if (upper === "THEN" && caseStack.length > 0) {
      inCaseWhen = false;
      append(t);
      continue;
    }
    if (upper === "ELSE" && caseStack.length > 0) {
      flush();
      inCaseWhen = false;
      indent = caseStack[caseStack.length - 1] + 1;
      line = t;
      continue;
    }
    if (upper === "END" && caseStack.length > 0) {
      flush();
      inCaseWhen = false;
      indent = caseStack.pop()!;
      line = t;
      continue;
    }

    // ── Inside FUNC parens: everything inline ────────────
    if (ct === "func") {
      if (t === "(") {
        const type = classifyParen(i);
        if (type === "block") {
          append("(");
          flush();
          parenStack.push({ type: "block", baseIndent: indent + 1 });
          indent = indent + 1;
        } else {
          parenStack.push({ type, baseIndent: base() });
          append("(");
        }
        continue;
      }
      if (t === ")") {
        const popped = parenStack.pop();
        if (popped?.type === "block") {
          flush();
          indent = popped.baseIndent - 1;
          line = ")";
        } else {
          line += ")";
        }
        continue;
      }
      if (t === ",") {
        line += ", ";
        continue;
      }
      if (t === ";") {
        line += ";";
        flush();
        lines.push("");
        indent = 0;
        parenStack.length = 0;
        caseStack.length = 0;
        betweenActive = false;
        inCaseWhen = false;
        continue;
      }
      append(t);
      continue;
    }

    // ── Inside WINDOW parens ─────────────────────────────
    if (ct === "window") {
      if (WINDOW_CLAUSE_SET.has(upper)) {
        flush();
        indent = base();
        line = t;
        continue;
      }
      if (t === "(") {
        const type = classifyParen(i);
        parenStack.push({ type, baseIndent: indent + 1 });
        append("(");
        continue;
      }
      if (t === ")") {
        flush();
        const popped = parenStack.pop();
        indent = (popped?.baseIndent ?? 1) - 1;
        line = ")";
        continue;
      }
      if (t === ",") {
        line += ",";
        continue;
      }
      append(t);
      continue;
    }

    // ── Major clauses ────────────────────────────────────
    if (MAJOR_CLAUSE_SET.has(upper)) {
      flush();
      indent = base();
      line = t;
      lineStartedWithClause = true;
      continue;
    }

    // ── Join clauses ─────────────────────────────────────
    if (JOIN_CLAUSE_SET.has(upper)) {
      flush();
      indent = base();
      line = t;
      lineStartedWithClause = true;
      continue;
    }

    // ── ON ───────────────────────────────────────────────
    if (upper === "ON" && !inCaseWhen) {
      flush();
      indent = base() + 1;
      line = t;
      continue;
    }

    // ── AND ──────────────────────────────────────────────
    if (upper === "AND") {
      if (betweenActive) {
        betweenActive = false;
        append(t);
        continue;
      }
      if (inCaseWhen) {
        append(t);
        continue;
      }
      flush();
      indent = base() + 1;
      line = t;
      continue;
    }

    // ── OR ───────────────────────────────────────────────
    if (upper === "OR") {
      if (inCaseWhen) {
        append(t);
        continue;
      }
      flush();
      indent = base() + 1;
      line = t;
      continue;
    }

    // ── BETWEEN ──────────────────────────────────────────
    if (upper === "BETWEEN" || upper === "NOT BETWEEN") {
      betweenActive = true;
      append(t);
      continue;
    }

    // ── ( ────────────────────────────────────────────────
    if (t === "(") {
      const type = classifyParen(i);
      if (type === "func") {
        parenStack.push({ type: "func", baseIndent: base() });
        append("(");
      } else {
        append("(");
        flush();
        parenStack.push({ type, baseIndent: indent + 1 });
        indent = indent + 1;
      }
      continue;
    }

    // ── ) ────────────────────────────────────────────────
    if (t === ")") {
      flush();
      const popped = parenStack.pop();
      indent = Math.max(0, (popped?.baseIndent ?? 1) - 1);
      line = ")";
      continue;
    }

    // ── , ────────────────────────────────────────────────
    if (t === ",") {
      line += ",";
      const wasClauseLine = lineStartedWithClause;
      flush();
      if (wasClauseLine) {
        indent = base() + 1;
      }
      // else: indent stays the same (continuation)
      continue;
    }

    // ── ; ────────────────────────────────────────────────
    if (t === ";") {
      line += ";";
      flush();
      lines.push("");
      indent = 0;
      parenStack.length = 0;
      caseStack.length = 0;
      betweenActive = false;
      inCaseWhen = false;
      continue;
    }

    // ── Everything else ──────────────────────────────────
    append(t);
  }

  flush();

  // Remove trailing blank lines
  while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// Minifier
// ═══════════════════════════════════════════════════════════════

function minifySql(sql: string): string {
  const tokens = tokenize(sql.trim());
  const result: string[] = [];

  for (const token of tokens) {
    if (token === " ") {
      if (result.length > 0) {
        const last = result[result.length - 1];
        if (last !== " " && !"(,;".includes(last)) {
          result.push(" ");
        }
      }
      continue;
    }
    if ("(),;".includes(token) && result[result.length - 1] === " ") {
      result.pop();
    }
    result.push(token);
  }

  return result.join("").trim();
}

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

const SAMPLE_SQL = `select u.id, u.name, u.email, o.order_id, o.total_amount
from users u
inner join orders o on u.id = o.user_id
left join payments p on o.order_id = p.order_id
where u.status = 'active' and o.created_at >= '2024-01-01'
and (o.total_amount > 100 or p.method = 'credit_card')
group by u.id, u.name, u.email, o.order_id, o.total_amount
having count(o.order_id) > 2
order by o.total_amount desc
limit 50 offset 10;`;

export default function SqlFormatter() {
  const [sqlText, setSqlText] = useState("");
  const [indentStyle, setIndentStyle] = useState<IndentStyle>("2spaces");
  const { error, success, info, setError, setSuccess, setInfo } =
    useToolStatus();

  const clearAlerts = () => {
    setError();
    setSuccess();
  };

  const handleFormat = () => {
    clearAlerts();
    if (!sqlText.trim()) {
      setInfo("Editor is empty.");
      return;
    }
    setSqlText(formatSql(sqlText, indentStyle));
    setSuccess("SQL formatted.");
  };

  const handleMinify = () => {
    clearAlerts();
    if (!sqlText.trim()) {
      setInfo("Editor is empty.");
      return;
    }
    setSqlText(minifySql(sqlText));
    setSuccess("SQL minified.");
  };

  const handleUppercase = () => {
    clearAlerts();
    if (!sqlText.trim()) {
      setInfo("Editor is empty.");
      return;
    }
    setSqlText(changeKeywordCase(sqlText, true));
    setSuccess("SQL keywords converted to UPPERCASE.");
  };

  const handleLowercase = () => {
    clearAlerts();
    if (!sqlText.trim()) {
      setInfo("Editor is empty.");
      return;
    }
    setSqlText(changeKeywordCase(sqlText, false));
    setSuccess("SQL keywords converted to lowercase.");
  };

  const handleCopy = async () => {
    clearAlerts();
    if (!sqlText.trim()) {
      setInfo("Editor is empty.");
      return;
    }
    try {
      await navigator.clipboard.writeText(sqlText);
      setSuccess("Copied to clipboard.");
    } catch {
      setError("Copy failed. Clipboard permission may be blocked.");
    }
  };

  const handleClear = () => {
    clearAlerts();
    setSqlText("");
  };

  const handleSample = () => {
    clearAlerts();
    setSqlText(SAMPLE_SQL);
    setSuccess("Sample SQL loaded.");
  };

  return (
    <PageContainer maxWidth={960}>
      <Stack spacing={2}>
        <ToolStatusAlerts error={error} success={success} info={info} />

        <FlexWrapRow>
          <TransparentButton label="Format" onClick={handleFormat} />
          <TransparentButton label="Minify" onClick={handleMinify} />
          <TransparentButton
            label="UPPERCASE Keywords"
            onClick={handleUppercase}
          />
          <TransparentButton
            label="lowercase keywords"
            onClick={handleLowercase}
          />
          <TransparentButton label="Load Sample" onClick={handleSample} />
          <TransparentButton label="Copy" onClick={handleCopy} />
          <TransparentButton label="Clear" onClick={handleClear} />
        </FlexWrapRow>

        <FormControl size="small" sx={{ maxWidth: 200 }}>
          <InputLabel>Indent Style</InputLabel>
          <Select
            value={indentStyle}
            label="Indent Style"
            onChange={(e) => setIndentStyle(e.target.value as IndentStyle)}
          >
            <MenuItem value="2spaces">2 Spaces</MenuItem>
            <MenuItem value="4spaces">4 Spaces</MenuItem>
            <MenuItem value="tab">Tab</MenuItem>
          </Select>
        </FormControl>

        <TextField
          value={sqlText}
          onChange={(event) => setSqlText(event.target.value)}
          placeholder="Paste your SQL here, for example: SELECT * FROM users WHERE id = 1;"
          multiline
          fullWidth
          minRows={16}
          InputProps={{
            sx: {
              "& textarea": {
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 13,
                lineHeight: 1.6,
              },
            },
          }}
        />
      </Stack>
    </PageContainer>
  );
}
