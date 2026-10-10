/** Fix serialized math commands, while preserving valid matrix/aligned row breaks. */
function normalizeLatex(math: string): string {
  const environment = /(?<!\\)\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/;
  return math.trim().split(/((?<!\\)\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\})/g).map(part => {
    // In a valid environment, \\ followed by a letter starts a new row; it is
    // not necessarily an over-escaped command. Leave those bodies untouched.
    if (environment.test(part)) return part;
    return part.replace(/\\{2,}(?=[a-zA-Z,!;:])/g, '\\');
  }).join('');
}

function displayMath(math: string): string {
  return `\n\n$$\n${normalizeLatex(math)}\n$$\n\n`;
}

function normalizeProse(value: string): string {
  // Match all math forms in one pass, avoiding a second conversion of generated
  // dollar delimiters. Escaped currency and code are not mathematical content.
  const math = /(?<!\\)(?:\\{1,2}\[([\s\S]*?)\\{1,2}\]|\\{1,2}\(([^\n]*?)\\{1,2}\)|\$\$([\s\S]*?)\$\$|(?<!\$)\$([^\n$]+?)(?<!\\)\$(?!\$))/g;
  let cursor = 0;
  let result = '';
  const prose = (text: string) => text.replace(/\\n(?![a-zA-Z])/g, '\n');
  for (const match of value.matchAll(math)) {
    result += prose(value.slice(cursor, match.index));
    const display = match[1] ?? match[3];
    cursor = match.index! + match[0].length;
    if (display !== undefined) {
      // Existing blank-line boundaries must not grow when server and renderer
      // both normalize the same note. Keep longer intentional paragraph gaps.
      result = result.replace(/\n{1,2}$/, '') + displayMath(display);
      if (value.slice(cursor).startsWith('\n\n')) cursor += 2;
      else if (value[cursor] === '\n') cursor++;
    } else result += `$${normalizeLatex(match[2] ?? match[4])}$`;
  }
  return result + prose(value.slice(cursor));
}

/** Normalize model math delimiters without touching code or commands such as \nu. */
export function normalizeMathMarkdown(value: string): string {
  // Protect backtick/tilde fences and variable-length inline code spans. Only
  // explicitly labelled math fences are converted into display equations.
  const code = /((?:^|\n)[ \t]*(?:`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]*(?:`{3,}|~{3,})[ \t]*(?=\n|$)|`+[^`\n]*`+)/g;
  return value.split(code).map(part => {
    const fence = part.match(/^\n?[ \t]*(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n[ \t]*\1[ \t]*$/);
    if (fence) return /^(?:math|latex|tex)\s*$/i.test(fence[2]) ? displayMath(fence[3]) : part;
    if (/^`/.test(part)) return part;
    return normalizeProse(part);
  }).join('');
}