import fs from 'node:fs';
import path from 'node:path';
import { normalizeIndicText } from '../../utils/indicNormalize';

export interface SyllabusChunk {
  id: string; chapterKey: string; chapterTitle: string; chapterNo: number; bookCode: string;
  grade: number; subject: string; lang: string; page: number; pdfPage: number; pdfFile: string;
  kind: 'content' | 'exercise' | 'answer_key' | 'activity'; text: string; exerciseNo?: string;
}
export interface ChapterManifest {
  key: string; title: string; grade: number; subject: string; chapterNo: number; bookCode: string;
  lang: string; pages: [number, number]; pdfFile: string;
}
export interface SyllabusIndex { chapters: ChapterManifest[]; chunks: SyllabusChunk[] }
const empty: SyllabusIndex = { chapters: [], chunks: [] };
let cached: SyllabusIndex | undefined;
let stamp = -1;
export function loadSyllabusIndex(): SyllabusIndex {
  const file = path.resolve(process.env.SYLLABUS_INDEX_DIR || 'data/syllabus/index', 'index.json');
  if (!fs.existsSync(file)) return empty;
  const mtime = fs.statSync(file).mtimeMs;
  if (cached && stamp === mtime) return cached;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data.chapters) || !Array.isArray(data.chunks)) throw new Error('Syllabus index is invalid. Re-run npm run ingest:syllabus.');
  cached = data; stamp = mtime; return cached!;
}
export function getChapterManifest(): ChapterManifest[] { return loadSyllabusIndex().chapters; }
const glossary: [RegExp, string][] = [
  [/paani|jal|पानी|जल|জল|পানী/g, 'water'], [/chakra|चक्र|চক্ৰ/g, 'cycle'],
  [/koshika|कोशिका|কোষ/g, 'cell'], [/prakash sanshleshan|प्रकाश संश्लेषण|সালোক সংশ্লেষণ/g, 'photosynthesis'],
  [/vashpikaran|वाष्पीकरण/g, 'evaporation'], [/sanghanan|संघनन/g, 'condensation'],
  [/parasaran|परासरण/g, 'osmosis'], [/nirdeshank|निर्देशांक/g, 'coordinates'],
  [/abhyaas|abhyas|अभ्यास|অনুশীলনী/g, 'exercise'], [/rekhiya|रैखिक/g, 'linear'],
];
export function expandSyllabusQuery(query: string): string {
  let q = normalizeIndicText(query);
  for (const [pattern, english] of glossary) q = q.replace(pattern, ` ${english} `);
  return q;
}
function tokens(text: string): string[] {
  return expandSyllabusQuery(text).match(/[\p{L}\p{N}]+/gu)?.filter(t => t.length > 1) || [];
}
/** BM25 over Unicode words; source filters applied before ranking to avoid wrong-class lessons. */
export function rankSyllabus(index: SyllabusIndex, input: { query: string; grade?: number; subject?: string; chapterKey?: string; kind?: string; k?: number }): SyllabusChunk[] {
  const docs = index.chunks.filter(c => c.kind !== 'answer_key' && (!input.grade || c.grade === input.grade)
    && (!input.subject || c.subject.toLowerCase() === input.subject.toLowerCase())
    && (!input.chapterKey || c.chapterKey === input.chapterKey) && (!input.kind || c.kind === input.kind));
  const terms = [...new Set(tokens(input.query))];
  if (!terms.length || !docs.length) return [];
  const bags = docs.map(d => tokens(`${d.chapterTitle} ${d.text}`));
  const average = bags.reduce((n, b) => n + b.length, 0) / bags.length;
  const df = terms.map(t => bags.filter(b => b.includes(t)).length);
  return docs.map((doc, i) => {
    const bag = bags[i];
    const score = terms.reduce((sum, t, j) => {
      const count = bag.filter(x => x === t).length;
      if (!count) return sum;
      const idf = Math.log(1 + (docs.length - df[j] + .5) / (df[j] + .5));
      return sum + idf * count * 2.2 / (count + 1.2 * (.25 + .75 * bag.length / Math.max(1, average)));
    }, 0);
    return { doc, score };
  }).filter(d => d.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(8, input.k || 5))).map(d => d.doc);
}
export function searchSyllabus(input: Parameters<typeof rankSyllabus>[1]): SyllabusChunk[] { return rankSyllabus(loadSyllabusIndex(), input); }
export function getChapterExercises(key: string): SyllabusChunk[] {
  return loadSyllabusIndex().chunks.filter(c => c.chapterKey === key && c.kind === 'exercise');
}