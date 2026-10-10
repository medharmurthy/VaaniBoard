import {describe,it,expect} from 'vitest';
import {rankSyllabus,type SyllabusIndex} from '../server/rag/index';
const base={grade:9,subject:'SCIENCE',lang:'en',page:1,pdfPage:1,pdfFile:'demo.pdf',chapterNo:1,bookCode:'test',kind:'content' as const};
const fixture:SyllabusIndex={chapters:[],chunks:[
  {...base,id:'water',chapterKey:'water',chapterTitle:'Water',text:'Our original teaching note: water moves through evaporation, condensation and rain in the water cycle.'},
  {...base,id:'cell',chapterKey:'cell',chapterTitle:'Cells',text:'Our original teaching note: a cell has a membrane. Osmosis moves water across that membrane.'},
  {...base,id:'wrong',grade:2,chapterKey:'primary',chapterTitle:'Water',text:'water water cycle'},
]};
describe('offline syllabus retrieval',()=>{
 it.each(['water cycle','paani ka chakra','जल चक्र'])('retrieves English evidence for %s',query=>{expect(rankSyllabus(fixture,{query,grade:9})[0].id).toBe('water');});
 it('filters the active chapter before ranking',()=>{expect(rankSyllabus(fixture,{query:'water',chapterKey:'cell'})[0].id).toBe('cell');});
 it('returns no fabricated hits for an absent topic',()=>{expect(rankSyllabus(fixture,{query:'dinosaurs'})).toEqual([]);});
});