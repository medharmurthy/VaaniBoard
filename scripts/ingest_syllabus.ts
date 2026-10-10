import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import type { SyllabusIndex, SyllabusChunk, ChapterManifest } from '../server/rag/index';

const books = [
  { code: 'iesc1', subject: 'SCIENCE', titles: ['Exploration: Entering the World of Secondary Science','Cell: The Building Block of Life','Tissues in Action','Describing Motion Around Us','Exploring Mixtures and their Separation','How Forces Affect Motion','Work, Energy, and Simple Machines','Journey Inside the Atom','Atomic Foundations of Matter','Sound Waves: Characteristics and Applications','Reproduction: How Life Continues','Patterns in Life: Diversity and Classification','Earth as a System: Energy, Matter, and Life'], starts: [1,8,28,48,72,94,116,140,162,184,208,228,252] },
  { code: 'iemh1', subject: 'MATHS', titles: ['Orienting Yourself: The Use of Coordinates','Introduction to Linear Polynomials','The World of Numbers','Exploring Algebraic Identities',"I'm Up and Down, and Round and Round",'Measuring Space: Perimeter and Area','The Mathematics of Maybe: Introduction to Probability','Predicting What Comes Next: Exploring Sequences and Progressions'], starts: [1,16,41,68,92,118,155,174] },
];
const raw = path.resolve('data/syllabus/raw/ncert/class9');
const out = path.resolve(process.env.SYLLABUS_INDEX_DIR || 'data/syllabus/index');
const index: SyllabusIndex = { chapters: [], chunks: [] };

async function readPdf(file: string): Promise<Buffer> {
  const destination = path.join(raw, file);
  try { const b = await fs.readFile(destination); if (b.subarray(0, 4).toString() === '%PDF') return b; } catch {}
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`https://ncert.nic.in/textbook/pdf/${file}`, { signal: AbortSignal.timeout(90000) });
      if (!response.ok) throw new Error(`NCERT HTTP ${response.status}`);
      const b = Buffer.from(await response.arrayBuffer());
      if (b.subarray(0, 4).toString() !== '%PDF') throw new Error('NCERT returned a non-PDF response');
      await fs.writeFile(destination, b); return b;
    } catch (e) { if (attempt === 2) throw e; await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); }
  }
  throw new Error('Unable to download textbook');
}
function clean(text: string): string {
  return text.normalize('NFC').split('\n').filter(line => !/\.indd|^-- \d+ of \d+ --/.test(line))
    .join('\n').replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
function addChunk(manifest: ChapterManifest, text: string, kind: SyllabusChunk['kind'], page: number, pdfPage: number, exerciseNo?: string): void {
  if (!text.trim()) return;
  index.chunks.push({ id: `${manifest.key}-${kind}-p${page}-${index.chunks.length}`, chapterKey: manifest.key,
    chapterTitle: manifest.title, chapterNo: manifest.chapterNo, bookCode: manifest.bookCode, grade: 9, subject: manifest.subject,
    lang: 'en', page, pdfPage, pdfFile: manifest.pdfFile, kind, text: text.trim(), exerciseNo });
}
await fs.mkdir(raw, { recursive: true }); await fs.mkdir(out, { recursive: true });
for (const book of books) for (let n = 1; n <= book.titles.length; n++) {
  const file = `${book.code}${String(n).padStart(2, '0')}.pdf`;
  const parser = new PDFParse({ data: await readPdf(file) });
  try {
    const result = await parser.getText();
    const pages = result.pages;
    const start = book.starts[n - 1];
    const manifest: ChapterManifest = { key: `ncert-c9-${book.subject === 'SCIENCE' ? 'sci' : 'maths'}-ch${String(n).padStart(2, '0')}`,
      title: book.titles[n - 1], grade: 9, subject: book.subject, chapterNo: n, bookCode: book.code, lang: 'en',
      pdfFile: file, pages: [start, book.starts[n] ? book.starts[n] - 1 : start + pages.length - 1] };
    index.chapters.push(manifest);
    let exerciseMode = false; let answerKey = false; let question = ''; let questionNo = ''; let questionPage = start; let questionPdfPage = 1;
    const flush = () => { if (question) addChunk(manifest, question, 'exercise', questionPage, questionPdfPage, questionNo); question = ''; };
    for (const [offset, pdfPage] of pages.entries()) {
      const printedPage = start + offset; const pdfNumber = offset + 1;
      let text = clean(pdfPage.text);
      if (/\bAnswer Key\b/.test(text)) { flush(); answerKey = true; exerciseMode = false; }
      if (answerKey) { addChunk(manifest, text, 'answer_key', printedPage, pdfNumber); continue; }
      // Remove running headers without altering the original question sentences.
      text = text.split('\n').filter(l => !/^\d{1,3}$/.test(l.trim()) && l.trim() !== manifest.title && !/^(Exploration\s*\||Ganita Manjari\s*\|)/.test(l)).join('\n');
      const marker = text.match(/Revise,\s*Reflect,\s*Refine|End\s*-?\s*of\s*-?\s*chapter\s+Exercises|Exercise\s+Set\s+\d+\.\d+/i);
      const body = marker ? text.slice(0, marker.index) : (!exerciseMode ? text : '');
      for (let pos = 0; pos < body.length; pos += 700) addChunk(manifest, body.slice(pos, pos + 850), 'content', printedPage, pdfNumber);
      if (marker) { flush(); exerciseMode = true; text = text.slice(marker.index! + marker[0].length); }
      const journey = text.search(/The Journey Beyond/im);
      if (journey >= 0 && exerciseMode) {
        // Two-column pages extract project sidebar BEFORE the continuing exercise questions.
        // Keep numbered exercise continuations after the sidebar; do not cut Q14–16 away.
        const before = text.slice(0,journey);
        const after = text.slice(journey).match(/^\s*\*?\d{1,2}\.\s+[\s\S]*/m)?.[0] || '';
        text = before + '\n' + after;
      }
      text = text.split(/The Quest Continues|^Summary\b|^Points to Ponder\b/im)[0];
      if (exerciseMode) {
        for (const line of text.split('\n')) {
          const q = line.match(/^\s*\*?(\d{1,2})\.\s+(.*)$/);
          if (q) { flush(); questionNo = q[1]; questionPage = printedPage; questionPdfPage = pdfNumber; question = `${q[1]}. ${q[2]}`; }
          else if (question) question += `\n${line}`;
        }
      }
      if (journey >= 0) { flush(); exerciseMode = false; }
    }
    flush();
    console.log(`${file}: ${pages.length} pages indexed`);
  } finally { await parser.destroy(); }
}
await fs.writeFile(path.join(out, 'index.json'), JSON.stringify(index));
console.log(`Indexed ${index.chapters.length} chapters, ${index.chunks.length} chunks. Copyrighted PDFs/index remain local (gitignored).`);