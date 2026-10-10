/** DOM-free normalization shared by the classroom server and the board renderer. */
export interface MermaidParser {
  parse(code: string): Promise<unknown> | unknown;
}

export interface ValidatedMermaidCode {
  code: string;
  repaired: boolean;
  attempts: number;
}

/** Mermaid entities escape quotes without deleting punctuation or Indic text. */
export function quoteMermaidLabel(label: string): string {
  return `"${label.replace(/"/g, '#quot;')}"`;
}

export function needsMermaidLabelQuotes(label: string): boolean {
  // HTML line breaks are valid Mermaid text; do not mistake them for syntax.
  const text = label.replace(/<br\s*\/?\s*>/gi, '');
  return /[()[\]{}"|<>\\]/.test(text) || /^end$/i.test(text.trim());
}

const shapes = [
  ['(((', ')))'], ['([', '])'], ['[[', ']]'], ['[(', ')]'],
  ['{{', '}}'], ['((', '))'], ['[/', '/]'], ['[\\', '\\]'],
  ['[/', '\\]'], ['[\\', '/]'], ['[', ']'], ['(', ')'], ['{', '}'], ['>', ']'],
] as const;
// A hyphen may belong to an ID, but never consume the start of an arrow such
// as A-->B or A-.->B as part of A's name.
const identifier = /^[\p{L}\p{N}_](?:[\p{L}\p{M}\p{N}_]|-(?![-.=>]))*/u;
const idCharacter = /[\p{L}\p{M}\p{N}_-]/u;

function quoteFlowchartLabels(line: string): string {
  if (/^\s*(?:%%|classDef\b|class\b|style\b|linkStyle\b|click\b|subgraph\b)/.test(line)) return line;
  let result = '';
  let cursor = 0;
  while (cursor < line.length) {
    // Comments and quoted/markdown labels must be copied, not reparsed as nodes.
    if (line.startsWith('%%', cursor)) return result + line.slice(cursor);
    // Edge-label text is not a node declaration. Leave it alone instead of
    // accidentally rewriting A[f(x)] when it appears inside |...|.
    if (line[cursor] === '|') {
      const end = line.indexOf('|', cursor + 1);
      if (end < 0) return result + line.slice(cursor);
      result += line.slice(cursor, end + 1);
      cursor = end + 1;
      continue;
    }
    if (line[cursor] === '"') {
      const end = line.indexOf('"', cursor + 1);
      if (end < 0) return result + line.slice(cursor);
      result += line.slice(cursor, end + 1);
      cursor = end + 1;
      continue;
    }
    const match = (!cursor || !idCharacter.test(line[cursor - 1])) && line.slice(cursor).match(identifier);
    if (!match) { result += line[cursor++]; continue; }
    const nodeEnd = cursor + match[0].length;
    let start = nodeEnd;
    while (line[start] === ' ' || line[start] === '\t') start++;
    let replacement: { end: number; value: string } | undefined;
    for (const [open, close] of shapes) {
      if (!line.startsWith(open, start)) continue;
      const labelStart = start + open.length;
      if (line[labelStart] === '"' || line[labelStart] === '`') break;
      let depth = 0;
      for (let end = labelStart; end < line.length; end++) {
        if (depth === 0 && line.startsWith(close, end)) {
          const label = line.slice(labelStart, end);
          replacement = {
            end: end + close.length,
            value: line.slice(cursor, labelStart) + (needsMermaidLabelQuotes(label) ? quoteMermaidLabel(label) : label) + close,
          };
          break;
        }
        // Balance brackets inside labels, e.g. f(x), E[X], or nested set notation.
        if (open[0] !== '>' && line[end] === open[0]) depth++;
        else if (depth && line[end] === close.at(-1)) depth--;
      }
      if (replacement) break;
    }
    if (replacement) {
      result += replacement.value;
      cursor = replacement.end;
    } else {
      result += line.slice(cursor, nodeEnd);
      cursor = nodeEnd;
    }
  }
  return result;
}

export function normalizeMermaidCode(source: string): string {
  let code = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const fence = code.match(/^```(?:mermaid)?[ \t]*\n([\s\S]*?)\n?```$/i);
  if (fence) code = fence[1].trim();
  // Only decode escaped line separators in a one-line serialized diagram. Never
  // globally strip backslashes: they are part of trapezoid and label syntax.
  if (!code.includes('\n') && /^(?:flowchart|graph|mindmap|sequenceDiagram|classDiagram|stateDiagram|erDiagram)\b/.test(code)) {
    code = code.replace(/\\n(?=\s|[\p{L}\p{N}_]|$)/gu, '\n');
  }
  if (!/^\s*(?:(?:%%[^\n]*\n)\s*)*(?:flowchart|graph)\b/.test(code)) return code;
  return code.split('\n').map(quoteFlowchartLabels).join('\n');
}

/** Parse the original first; at most one local repair, never a model request. */
export async function validateMermaidCode(source: string, parser: MermaidParser): Promise<ValidatedMermaidCode> {
  if (!source.trim()) throw new Error('No chart content was provided. Open the editor to add Mermaid code, or request the chart again.');
  let lastError: unknown;
  let attempts = 0;
  const candidates = [...new Set([source, normalizeMermaidCode(source)])];
  for (const code of candidates) {
    attempts++;
    try {
      const parsed = await parser.parse(code);
      if (parsed === false) throw new Error('The Mermaid parser rejected this chart.');
      return { code, repaired: code !== source, attempts };
    } catch (error) { lastError = error; }
  }
  const detail = lastError instanceof Error ? lastError.message : String((lastError as any)?.message || lastError || 'Invalid Mermaid syntax.');
  throw new Error(`The chart could not be parsed after local repair. Open the editor, check brackets and arrows, and quote labels containing formulas (for example A["x = (-b ± √Δ) / 2a"]). ${detail.slice(0, 1200)}`);
}