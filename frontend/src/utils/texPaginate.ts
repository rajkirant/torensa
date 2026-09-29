import type { DocLayout } from "./texToHtml";

/**
 * Lays the rendered document out on fixed-size pages, like the PDF LaTeX
 * would produce: the title block spans the text width on page 1, the rest
 * flows through one or two columns per page. Paragraphs and lists are split
 * at line boundaries when a column fills up, figures and tables float to the
 * top of the next column, and headings are kept with the text after them.
 *
 * Runs against the preview iframe's document (same origin, no scripts inside
 * the frame). Returns the number of pages.
 */

const PX_PER_PT = 96 / 72;
const PAGE_GAP_PX = 16;

type Column = { el: HTMLElement; limit: number };

const px = (pt: number) => pt * PX_PER_PT;

function isHeading(el: Element) {
  return /^H[1-6]$/.test(el.tagName);
}

function isFloat(el: Element) {
  return el.tagName === "FIGURE";
}

function isSplittableText(el: Element) {
  return el.tagName === "P" || el.classList.contains("tex-bibitem");
}

function isList(el: Element) {
  return el.tagName === "UL" || el.tagName === "OL";
}

/** Text nodes and atomic inline elements (math, images) in document order. */
function collectAtoms(root: Node, out: Node[] = []): Node[] {
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) out.push(child);
    } else if (child instanceof Element) {
      if (
        child.classList.contains("katex") ||
        child.tagName === "IMG" ||
        child.tagName === "SUP" ||
        child.tagName === "BR"
      ) {
        out.push(child);
      } else {
        collectAtoms(child, out);
      }
    }
  }
  return out;
}

/**
 * Bottom of the line box a character sits on. Character rects cover only the
 * glyph's content area, so half the leading is added to reach the line box.
 */
function charBottom(doc: Document, node: Text, index: number, lineHeight: number) {
  const range = doc.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + 1);
  const rects = range.getClientRects();
  if (!rects.length) return -Infinity;
  return Math.max(
    ...Array.from(rects, (r) => r.bottom + Math.max(0, (lineHeight - r.height) / 2)),
  );
}

/**
 * Finds where to split `block` so that everything before the split ends above
 * `limit` (a client Y coordinate). The split is placed at the start of the
 * first line that crosses the limit. Returns null if not even one line fits.
 */
function findSplitPoint(
  doc: Document,
  block: Element,
  limit: number,
): { node: Node; offset: number } | "before" | null {
  const lineHeight = Number.parseFloat(getComputedStyle(block).lineHeight) || 0;
  for (const atom of collectAtoms(block)) {
    if (atom.nodeType === Node.TEXT_NODE) {
      const text = atom as Text;
      const range = doc.createRange();
      range.selectNodeContents(text);
      const rects = Array.from(range.getClientRects());
      const lineBottom = (r: DOMRect) => r.bottom + Math.max(0, (lineHeight - r.height) / 2);
      if (!rects.length || rects.every((r) => lineBottom(r) <= limit + 0.5)) continue;
      // Binary search the first character whose line overflows.
      let lo = 0;
      let hi = text.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (charBottom(doc, text, mid, lineHeight) > limit + 0.5) hi = mid;
        else lo = mid + 1;
      }
      // Move the split back to the start of the word it falls in.
      let offset = lo;
      while (offset > 0 && !/\s/.test(text.data[offset - 1])) offset--;
      return { node: text, offset };
    }
    const el = atom as Element;
    if (el.getBoundingClientRect().bottom > limit + 0.5) {
      return { node: el, offset: -1 };
    }
  }
  return "before";
}

/** True if the split point is at the very start of the block's content. */
function isAtStart(block: Element, node: Node, offset: number) {
  const range = block.ownerDocument.createRange();
  range.setStart(block, 0);
  if (offset < 0) range.setEndBefore(node);
  else range.setEnd(node, offset);
  return range.toString().trim() === "" && !range.cloneContents().querySelector(".katex, img");
}

/**
 * Splits a paragraph-like block so the first part ends above `limit`.
 * Returns the remainder, or null if nothing fits.
 */
function splitText(block: HTMLElement, limit: number): HTMLElement | null {
  const doc = block.ownerDocument;
  const point = findSplitPoint(doc, block, limit);
  if (point === null || point === "before") return null;
  if (isAtStart(block, point.node, point.offset)) return null;
  const range = doc.createRange();
  if (point.offset < 0) range.setStartBefore(point.node);
  else range.setStart(point.node, point.offset);
  range.setEnd(block, block.childNodes.length);
  const rest = block.cloneNode(false) as HTMLElement;
  rest.appendChild(range.extractContents());
  rest.classList.add("tex-cont");
  block.classList.add("tex-split");
  return rest;
}

/** Splits a list between (or inside) items. Returns the remainder list. */
function splitList(list: HTMLElement, limit: number): HTMLElement | null {
  const items = Array.from(list.children) as HTMLElement[];
  const index = items.findIndex(
    (li) => li.getBoundingClientRect().bottom > limit + 0.5,
  );
  if (index < 0) return null;
  const rest = list.cloneNode(false) as HTMLElement;
  const partial = splitText(items[index], limit);
  const moved = partial ? items.slice(index + 1) : items.slice(index);
  if (!partial && index === 0) return null;
  if (partial) {
    partial.classList.add("tex-cont-item");
    rest.appendChild(partial);
  }
  for (const li of moved) rest.appendChild(li);
  if (list.tagName === "OL") {
    const start = Number(list.getAttribute("start") ?? "1");
    rest.setAttribute("start", String(start + index));
  }
  rest.classList.add("tex-cont");
  return rest.children.length ? rest : null;
}

/** Shrinks wide tables and equations to the column width. */
function fitWidth(block: HTMLElement, width: number) {
  const targets = block.matches(".tex-table-wrap, .tex-display")
    ? [block]
    : Array.from(block.querySelectorAll<HTMLElement>(".tex-table-wrap, .tex-display"));
  for (const el of targets) {
    const inner = (el.firstElementChild as HTMLElement | null) ?? el;
    const natural = inner.scrollWidth;
    if (natural > width + 1) {
      el.style.zoom = String(Math.max(0.5, width / natural));
    }
  }
}

export function paginate(doc: Document, layout: DocLayout): number {
  const body = doc.body;
  const blocks = Array.from(body.children) as HTMLElement[];
  const titleBlock = blocks.find((el) => el.classList.contains("tex-titleblock"));
  const flow = blocks.filter((el) => el !== titleBlock);
  body.replaceChildren();
  body.classList.add("tex-paged");

  const pageStyle = doc.createElement("style");
  pageStyle.textContent = `@page{size:${layout.paperWidth}pt ${layout.paperHeight}pt;margin:0}`;
  doc.head.appendChild(pageStyle);

  const cols = layout.columns;
  const colWidth = (layout.textWidth - layout.columnSep * (cols - 1)) / cols;
  const lineHeight = px(layout.baselineSkip);
  const pages: HTMLElement[] = [];
  let columns: Column[] = [];
  let colIndex = 0;

  const newPage = () => {
    const page = doc.createElement("div");
    page.className = "tex-page";
    page.style.width = `${layout.paperWidth}pt`;
    page.style.height = `${layout.paperHeight}pt`;
    const inner = doc.createElement("div");
    inner.className = "tex-page-body";
    inner.style.left = `${layout.marginLeft}pt`;
    inner.style.top = `${layout.marginTop}pt`;
    inner.style.width = `${layout.textWidth}pt`;
    inner.style.height = `${layout.textHeight}pt`;
    page.appendChild(inner);
    const number = doc.createElement("div");
    number.className = "tex-page-number";
    number.textContent = String(pages.length + 1);
    number.style.top = `${layout.marginTop + layout.textHeight + 24}pt`;
    page.appendChild(number);
    body.appendChild(page);
    pages.push(page);

    let available = px(layout.textHeight);
    if (pages.length === 1 && titleBlock) {
      inner.appendChild(titleBlock);
      available -= titleBlock.getBoundingClientRect().height + lineHeight;
    }
    const row = doc.createElement("div");
    row.className = "tex-columns";
    row.style.gap = `${layout.columnSep}pt`;
    inner.appendChild(row);
    columns = [];
    for (let i = 0; i < cols; i++) {
      const col = doc.createElement("div");
      col.className = "tex-column";
      col.style.width = `${colWidth}pt`;
      col.style.height = `${Math.max(lineHeight, available)}px`;
      row.appendChild(col);
      columns.push({ el: col, limit: 0 });
    }
    for (const c of columns) c.limit = c.el.getBoundingClientRect().top + available;
    colIndex = 0;
  };

  const current = () => columns[colIndex];
  const nextColumn = () => {
    if (colIndex + 1 < columns.length) colIndex++;
    else newPage();
  };
  const bottomOf = (el: Element) => el.getBoundingClientRect().bottom;
  const fits = (el: HTMLElement) => bottomOf(el) <= current().limit + 0.5;

  newPage();
  const queue = [...flow];
  const deferred: HTMLElement[] = [];
  let guard = 0;

  while ((queue.length || deferred.length) && guard++ < 20000) {
    const col = current();
    // Floats waiting for a new column go to its top.
    if (!col.el.childElementCount && deferred.length) {
      const float = deferred.shift()!;
      col.el.appendChild(float);
      fitWidth(float, px(colWidth));
      if (!fits(float) && col.el.childElementCount > 1) {
        float.remove();
        deferred.unshift(float);
        nextColumn();
      }
      continue;
    }
    const block = queue.shift();
    if (!block) {
      // Only floats remain; flush them into fresh columns.
      nextColumn();
      continue;
    }
    col.el.appendChild(block);
    fitWidth(block, px(colWidth));

    if (fits(block)) {
      // Keep headings with at least two lines of what follows.
      if (
        isHeading(block) &&
        queue.length &&
        col.el.childElementCount > 1 &&
        col.limit - bottomOf(block) < lineHeight * 2
      ) {
        block.remove();
        queue.unshift(block);
        nextColumn();
      }
      continue;
    }

    const alone = col.el.childElementCount === 1;
    if (isFloat(block)) {
      block.remove();
      if (alone) {
        // Too tall for any column: place it anyway.
        col.el.appendChild(block);
        nextColumn();
      } else if (/[hH]/.test(block.dataset.placement ?? "") ) {
        queue.unshift(block);
        nextColumn();
      } else {
        deferred.push(block);
      }
      continue;
    }

    let rest: HTMLElement | null = null;
    if (isSplittableText(block)) {
      rest = splitText(block, col.limit);
      // Re-flowing the first part can change its line breaks; split again
      // if it still overflows.
      for (let i = 0; rest && i < 3 && !fits(block); i++) {
        const more = splitText(block, col.limit);
        if (!more) break;
        more.append(...Array.from(rest.childNodes));
        rest = more;
      }
    } else if (isList(block)) {
      rest = splitList(block, col.limit);
    }

    if (rest) {
      queue.unshift(rest);
      nextColumn();
      continue;
    }

    if (alone) {
      // Nothing fits in an empty column (e.g. a very tall table): keep it.
      nextColumn();
      continue;
    }

    block.remove();
    queue.unshift(block);
    // Don't leave a heading stranded at the bottom of the column.
    const previous = col.el.lastElementChild;
    if (previous && isHeading(previous) && col.el.childElementCount > 1) {
      previous.remove();
      queue.unshift(previous as HTMLElement);
    }
    nextColumn();
  }

  // Drop a trailing empty page.
  const last = pages[pages.length - 1];
  if (pages.length > 1 && !last.querySelector(".tex-column > *")) {
    last.remove();
    pages.pop();
  }
  return pages.length;
}

/** Scales the pages to fit the frame's width. */
export function fitPagesToWidth(doc: Document, layout: DocLayout) {
  const frameWidth = doc.defaultView?.innerWidth ?? 0;
  const pageWidth = px(layout.paperWidth) + PAGE_GAP_PX * 2;
  const zoom = frameWidth > 0 ? Math.min(1.5, frameWidth / pageWidth) : 1;
  doc.documentElement.style.zoom = String(zoom);
}
