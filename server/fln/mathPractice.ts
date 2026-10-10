import { nativeNumber } from '../../utils/languages';
export function generateMathPractice({ op = 'add', max = 20, count = 10, lang = 'hi', seed = 42 }: { op?: 'add' | 'sub'; max?: number; count?: number; grade?: number; lang?: string; seed?: number }) {
  max = Math.max(2, Math.min(100, Math.floor(max))); count = Math.max(1, Math.min(20, Math.floor(count)));
  let state = seed >>> 0;
  const random = (limit: number) => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state % limit; };
  return Array.from({ length: count }, () => {
    const a = random(max + 1); const b = op === 'sub' ? random(a + 1) : random(max - a + 1);
    const answer = op === 'sub' ? a - b : a + b;
    const values = new Set([answer]);
    // Enumerated bounded distractors, no infinite loop for small ranges.
    for (const value of [answer + 1, answer - 1, answer + 2, answer - 2, answer + 3, answer + 4]) if (value >= 0 && values.size < 4) values.add(value);
    const options = [...values];
    for (let i = options.length - 1; i > 0; i--) { const j = random(i + 1); [options[i], options[j]] = [options[j], options[i]]; }
    return { type: 'multiple_choice', question: `${nativeNumber(a, lang)} ${op === 'sub' ? '−' : '+'} ${nativeNumber(b, lang)} = ?`,
      options: options.map(n => nativeNumber(n, lang)), correctIndex: options.indexOf(answer), expectedAnswer: String(answer), operands: [a, b] };
  });
}
/** Pedagogical scaffolds, not a claim of certification or official Lakshya measurement. */
export function getNipunTargets(grade = 2, domain = 'numeracy') {
  return [{ code: `FLN.${Math.max(1, Math.min(3, grade))}.${domain}`, grade, domain,
    text: domain === 'literacy' ? 'Recognise letters and sounds; practise oral language with familiar words.' : 'Count concrete objects and practise small-number addition and subtraction.',
    source: 'NIPUN Bharat inspired foundational practice; official grade targets require teacher review.' }];
}