import { createTool } from '@cline/sdk';
import { z } from 'zod';
import { tools as declarations, validateFunctionCalls } from '../aiTools';
import { searchSyllabus, getChapterExercises, getChapterManifest } from '../rag/index';
import { generateMathPractice, getNipunTargets } from '../fln/mathPractice';
import { boardToText } from '../../utils/boardToText';
import type { Citation, ClassroomProposal } from '../../types';
import {normalizeMathMarkdown} from '../../utils/mathMarkdown';
import {scienceDiagramSchema,requestedDiagramTemplate,wantsIllustration} from '../../utils/scienceDiagrams';
import {renderToString} from 'katex';
import {normalizeMermaidCode} from '../../utils/mermaidCode';

export const CLASSROOM_COMPONENTS = ['QUIZ_APP', 'LETTER_GAME', 'COUNTING_ACTIVITY', 'EXERCISE_SHEET', 'LABELLED_DIAGRAM', 'DOCUMENT_PAGE', 'MARKDOWN_NOTE', 'QUIZ_MULTIPLE_CHOICE', 'QUIZ_TRUE_FALSE', 'QUIZ_ESSAY', 'QUIZ_DRAG_MATCH', 'FLASHCARD', 'TIMER', 'CALCULATOR', 'MERMAID_DIAGRAM', 'MARKMAP_MINDMAP', 'TODOLIST', 'ATTENDANCE'];
export interface ClassroomContext {
  req: any; calls: { name: string; args: any }[]; citations: Citation[]; proposals: ClassroomProposal[];
  generatedMath?: ReturnType<typeof generateMathPractice>;
  grounded: boolean; requiresGrounding: boolean; proposalOnly: boolean;
}
function jsonSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  const out = { ...schema };
  if (typeof out.type === 'string') out.type = out.type.toLowerCase();
  if (out.properties) out.properties = Object.fromEntries(Object.entries(out.properties).map(([k,v]) => [k,jsonSchema(v)]));
  if (out.items) out.items = jsonSchema(out.items);
  return out;
}
function valueSchema(schema: any): z.ZodType {
  let type: z.ZodType;
  if (schema.enum?.length) type = z.enum(schema.enum);
  else switch (String(schema.type).toLowerCase()) {
    case 'string': type = z.string().max(30000); break;
    case 'number': case 'integer': type = z.number().finite(); break;
    case 'boolean': type = z.boolean(); break;
    case 'array': type = z.array(valueSchema(schema.items || {})).max(100); break;
    case 'object': {
      const required = new Set(schema.required || []);
      type = z.object(Object.fromEntries(Object.entries(schema.properties || {}).map(([k,v]) => [k,required.has(k) ? valueSchema(v) : valueSchema(v).optional()]))); break;
    }
    default: type = z.unknown();
  }
  return type;
}
export function queueBoardCall(ctx: ClassroomContext, name: string, input: any) {
  if (ctx.proposalOnly) throw new Error('Student doubts require propose_board_addition, not a direct board change.');
  if (ctx.requiresGrounding && !ctx.grounded) throw new Error('Call search_syllabus or get_chapter_exercises first; do not invent textbook content.');
  if (ctx.calls.length >= 12) throw new Error('Board action budget reached. Summarise the remaining work.');
  const definition = declarations.find(d => d.name === name);
  if (!definition) throw new Error('Unknown board tool');
  const args = valueSchema(definition.parameters || { type: 'OBJECT' }).parse(input) as any;
  if (name === 'render_mermaid') args.code = normalizeMermaidCode(args.code);
  const prompt=String(ctx.req.prompt||'').split('[USER MESSAGE]:').at(-1)||'';
  if(wantsIllustration(prompt) && (name==='render_mermaid'||name==='render_markmap'||name==='add_component'&&['MERMAID_DIAGRAM','MARKMAP_MINDMAP'].includes(args.componentType))) {
    throw new Error('The teacher requested an illustration, not a flowchart or concept map. Use render_science_diagram with matching anatomy/vector shapes. Do not substitute a flowchart.');
  }
  if (name === 'add_component' || name === 'update_component') {
    const config = typeof args.configJson === 'string' ? JSON.parse(args.configJson) : args.configJson || {};
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Widget config must be a JSON object.');
    if (name === 'add_component' && !CLASSROOM_COMPONENTS.includes(args.componentType)) throw new Error('Use a safe classroom React widget, not generated HTML or JavaScript.');
    config.lang ||= ctx.req.boardLanguage || ctx.req.lang || 'hi';
    const target=ctx.req.domElements?.[args.objectId]||Object.values(ctx.req.domElements||{}).find((el:any)=>el.config?.title===args.componentTitle) as any;
    const component=name==='add_component'?args.componentType:target?.componentType;
    if (component === 'MERMAID_DIAGRAM' && typeof config.code === 'string') config.code = normalizeMermaidCode(config.code);
    if(component==='LABELLED_DIAGRAM') {
      const diagram=name==='update_component'?{...target?.config,...config}:config;
      scienceDiagramSchema.parse(diagram);
      const requested=requestedDiagramTemplate(prompt);
      if(requested && diagram.template!==requested)throw new Error(`This request needs the ${requested} illustration, not ${diagram.template}. Use the matching template.`);
      if(!requested&&wantsIllustration(prompt)&&diagram.template!=='custom')throw new Error('There is no matching built-in illustration for this subject. Use custom vector shapes or explain the limitation; do not substitute an unrelated template.');
      const titled=requestedDiagramTemplate(diagram.title||'');
      if(titled&&diagram.template!==titled)throw new Error('Illustration title and template do not match. Correct the template before publishing.');
    }
    if(['DOCUMENT_PAGE','MARKDOWN_NOTE'].includes(component) && typeof (config.markdown||config.content)==='string') {
      const markdown=normalizeMathMarkdown(config.markdown||config.content);
      for(const match of markdown.matchAll(/\$\$([\s\S]*?)\$\$|(?<!\$)\$([^\n$]+)\$(?!\$)/g)) {
        try{renderToString(match[1]||match[2],{throwOnError:true,strict:false,trust:false});}
        catch{throw new Error('A mathematical expression has invalid LaTeX. Correct it and resubmit using render_math_note. Use \\frac, \\sum and dollar delimiters, not a flowchart.');}
      }
      config.markdown=markdown;
    }
    if (name === 'add_component' && args.componentType === 'QUIZ_APP' && !Array.isArray(config.questions)) throw new Error('QUIZ_APP requires questions.');
    if (name === 'add_component' && args.componentType === 'QUIZ_APP' && ctx.generatedMath) config.questions = ctx.generatedMath;
    if (name === 'add_component' && args.componentType === 'EXERCISE_SHEET') {
      const key = config.chapterKey || ctx.req.activeChapter;
      const exercises = getChapterExercises(key);
      if (!exercises.length) throw new Error('Select an indexed chapter with exercises.');
      config.items = exercises; config.title = exercises[0].chapterTitle; config.lang = 'en';
      config.source = `NCERT Class ${exercises[0].grade} ${exercises[0].subject} — original source text`;
    }
    config.citations = ctx.citations.map(c => ({ id: c.id, chapterTitle: c.chapterTitle, page: c.page, bookCode: c.bookCode }));
    args.configJson = JSON.stringify(config);
  }
  const validation = validateFunctionCalls([{name,args}], ctx.req.canvasObjects || [], ctx.req.domElements || {});
  if (!validation.isValid) throw new Error(validation.errors.join('; '));
  ctx.calls.push({ name, args });
  return { queued: true, position: args.gridPosition || 'existing object' };
}
export function createClassroomTools(ctx: ClassroomContext) {
  const board = declarations.filter(d => !['add_interactive_app', 'click_element', 'drag_all_elements', 'mark_attendance'].includes(d.name)).map(d => createTool({
    name: d.name, description: d.description, inputSchema: jsonSchema(d.parameters || {type:'OBJECT',properties:{}}), executionMode: 'sequential',
    async execute(input: any) { return queueBoardCall(ctx, d.name, input); },
  }));
  const cite = (hits: any[]) => {
    for (const h of hits) if (!ctx.citations.some(c => c.id === h.id)) ctx.citations.push({id:h.id,chapterKey:h.chapterKey,chapterTitle:h.chapterTitle,page:h.page,bookCode:h.bookCode});
    if (hits.length) ctx.grounded = true;
    return hits;
  };
  const knowledge = [
    createTool({name:'render_science_diagram',description:'Draw a labelled vector illustration, not boxes connected as a flowchart. Exact templates: digestive-system (human anatomy), photosynthesis (plant), water-cycle (landscape). For other subjects use custom with safe vector shapes in a 720 × 480 coordinate space: paths, ellipses, circles, rects, lines and labels. Never select an unrelated template. This is a schematic illustration, not a photograph.',
      inputSchema:scienceDiagramSchema,async execute(config){return queueBoardCall(ctx,'add_component',{componentType:'LABELLED_DIAGRAM',gridPosition:'CENTER',configJson:JSON.stringify(config)});} }),
    createTool({name:'render_math_note',description:'Render mathematical formulas and explanations as a readable lesson card with KaTeX. Use inline $...$ or display $$ on separate lines. Fourier series, integrals, fractions and Greek symbols belong here, never in Mermaid or plain canvas text. Provide correct LaTeX and explain variables.',
      inputSchema:z.object({title:z.string().min(1).max(160),markdown:z.string().min(1).max(30000)}),async execute(config){return queueBoardCall(ctx,'add_component',{componentType:'DOCUMENT_PAGE',gridPosition:'CENTER',configJson:JSON.stringify(config)});} }),
    createTool({ name: 'search_syllabus', description: 'Search NCERT Class 9 Science Exploration and Maths Ganita Manjari. Call before curriculum visuals. Missing evidence must be acknowledged.',
      inputSchema: z.object({ query:z.string().min(1).max(300), grade:z.number().int().min(1).max(12).optional(),chapterKey:z.string().optional(),subject:z.string().optional(),k:z.number().int().min(1).max(8).optional() }),
      async execute(input) { return cite(searchSyllabus({...input,chapterKey:input.chapterKey || ctx.req.activeChapter || undefined})); } }),
    createTool({ name:'get_chapter_exercises', description:'Get chapter exercises verbatim, with printed page references. Never generate replacements as textbook exercises.',
      inputSchema:z.object({chapterKey:z.string().optional()}), async execute({chapterKey}) {
        const key = chapterKey || ctx.req.activeChapter;
        if (!key) return { error:'Ask the teacher to select a chapter.', chapters:getChapterManifest() };
        return cite(getChapterExercises(key)).map(h => ({id:h.id,exerciseNo:h.exerciseNo,text:h.text,page:h.page,pdfFile:h.pdfFile,pdfPage:h.pdfPage}));
      } }),
    createTool({name:'get_nipun_targets',description:'Foundational practice scaffolds for Classes 1–3, inspired by NIPUN. Not certified learning-target assessment.',inputSchema:z.object({grade:z.number().int().min(1).max(3),domain:z.enum(['literacy','numeracy']).optional()}),async execute({grade,domain}) {return getNipunTargets(grade,domain);} }),
    createTool({name:'generate_math_practice',description:'Generate mathematically checked primary addition or subtraction questions. Return questions unchanged in QUIZ_APP.',inputSchema:z.object({op:z.enum(['add','sub']),max:z.number().int().min(2).max(100),count:z.number().int().min(1).max(20),lang:z.string().optional()}),async execute(input) {ctx.generatedMath=generateMathPractice({...input,lang:input.lang || ctx.req.boardLanguage});return ctx.generatedMath;} }),
    createTool({name:'get_varnamala',description:'Validated Hindi vowels and consonants for LETTER_GAME. For other scripts use counting or request a reviewed letter set.',inputSchema:z.object({lang:z.string().default('hi')}),async execute({lang}) {return lang === 'hi' ? {swar:['अ','आ','इ','ई','उ','ऊ','ऋ','ए','ऐ','ओ','औ'],vyanjan:['क','ख','ग','घ','ङ','च','छ','ज','झ','ञ','ट','ठ','ड','ढ','ण','त','थ','द','ध','न','प','फ','ब','भ','म','य','र','ल','व','श','ष','स','ह']} : {error:'A reviewed letter set is not available for this language yet.'};} }),
    createTool({name:'get_board_text',description:'Read the semantic board content without OCR.',inputSchema:z.object({}),async execute() {return boardToText(ctx.req.canvasObjects || [],ctx.req.domElements || {},ctx.req.lang);} }),
    createTool({name:'propose_board_addition',description:'Offer a teacher-reviewed answer, analogy, or activity; NEVER publish student doubts directly to the board.',inputSchema:z.object({kind:z.enum(['answer','analogy','simpler_explanation','check_question','misconception','activity']),title:z.string().max(120),body:z.string().max(3000),citations:z.array(z.string()).max(8)}),async execute(input) {
      const known = new Set(ctx.citations.map(c=>c.id));
      const p = {...input,id:crypto.randomUUID(),citations:input.citations.filter(c=>known.has(c))}; ctx.proposals.push(p); return {proposed:true,id:p.id};
    } }),
  ];
  return [...board,...knowledge];
}