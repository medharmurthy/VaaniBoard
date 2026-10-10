import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { getChapterManifest } from './rag/index';
export const classroomRouter = Router();
classroomRouter.get('/chapters', (_req,res)=> {
  try { const chapters = getChapterManifest(); res.json({chapters,indexed:chapters.length>0}); }
  catch { res.status(503).json({error:'Syllabus index unavailable. Run npm run ingest:syllabus.'}); }
});
classroomRouter.get('/page', (req,res)=> {
  const file = String(req.query.file || '');
  if (!getChapterManifest().some(c=>c.pdfFile === file) || path.basename(file) !== file) return res.status(400).json({error:'Unknown textbook file.'});
  const root = path.resolve('data/syllabus/raw/ncert/class9');
  const target = path.join(root,file);
  if (!fs.existsSync(target)) return res.status(404).json({error:'Textbook PDF is not installed on this server.'});
  return res.set('Cache-Control','private, max-age=3600').type('application/pdf').sendFile(target);
});