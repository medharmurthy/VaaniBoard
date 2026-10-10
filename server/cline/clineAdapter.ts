import { Agent } from '@cline/sdk';
import type { AgentModel } from '@cline/shared';
import { resolveProvider } from './providers';
import { createClassroomTools, type ClassroomContext } from './classroomTools';
import { getLanguageProfile } from '../../utils/languages';
import { classifyClassroomError, recordClassroomHealth } from './runtimeHealth';

export async function generateAgentActionsCline(req: any, model?: AgentModel) {
  // Never expose student rosters, generated application scripts, or attachment data URLs to the model.
  const rosterPresent=Object.values(req.domElements || {}).some((el:any)=>el.componentType === 'ATTENDANCE');
  req = {...req,canvasImageBase64:rosterPresent?undefined:req.canvasImageBase64,domElements:Object.fromEntries(Object.entries(req.domElements || {}).map(([id,el]:[string,any])=>[id,
    el.componentType === 'ATTENDANCE' ? {componentType:'ATTENDANCE',config:{title:'Attendance',studentCount:el.config?.students?.length||0}}
      : ['INTERACTIVE_APP','APP_BUILDER','STEM_SIMULATION'].includes(el.componentType) ? {componentType:el.componentType,config:{title:el.config?.title}} : el]))};
  const ctx: ClassroomContext = {req,calls:[],proposals:[],citations:[],grounded:false,
    requiresGrounding:!!req.activeChapter || /chapter|exercise|syllabus|ncert|textbook|abhyas|kitaab|अध्याय|अभ्यास/.test(req.prompt.toLowerCase()),
    proposalOnly:/student|doubt|bachch?e.*(?:sawaal|sawal)|puch raha|छात्र|सवाल|शंका|help me explain|example do/i.test(req.prompt)};
  const provider = model ? {providerId:'test',modelId:'test'} : resolveProvider(req);
  const tools = createClassroomTools(ctx);
  const policy = `You are Vaani Board, a teacher-controlled Indian classroom assistant. Use only provided tools. Never run shell commands or fetch the web.
Teacher input may be Hindi, Roman Hindi/Hinglish, English, or an Indian language. Reply in ${getLanguageProfile(req.lang).name}.
Board content MUST use ${getLanguageProfile(req.boardLanguage || req.lang).nativeName} in its native script. Scientific terms bilingual on first use. Keep explanations short and grade appropriate.
Active chapter: ${req.activeChapter || 'none'}. NCERT demo corpus is Class 9, not primary. Source grade and learner grade differ: never pass Class 9 as a NIPUN target. For FLN use learner Class 1–3.
Curriculum requests must call search_syllabus/get_chapter_exercises FIRST; use page citations from returned evidence. If none matches, ask for a chapter or say not in corpus; never invent textbook content. Exercise sheets reproduce source text; translations must be labelled translations.
For primary arithmetic ALWAYS use generate_math_practice, then QUIZ_APP. For Hindi vowels/consonants use get_varnamala then LETTER_GAME. Counting uses COUNTING_ACTIVITY in the selected supported Sarvam language.
MERMAID: Use one diagram declaration, balanced shapes and clear short labels. Quote flowchart labels containing punctuation, parentheses, formulas or reserved words, for example A["Apply: x = (-b ± √Δ) / 2a"]. Keep Unicode labels intact. Do not wrap the code in explanatory prose. Avoid dense layouts; use TD for steps and LR only for short processes.
VISUAL SELECTION: A mind map is a concept hierarchy: use render_mermaid with mindmap syntax. A flowchart is a process made of boxes: use it ONLY when the teacher asks for a flowchart/process chart. A diagram/picture of a physical object, anatomy or science scene must use render_science_diagram (labelled vector illustration), NOT Mermaid boxes. Digestive system uses digestive-system, plants making food use photosynthesis, water cycle uses water-cycle. Never use photosynthesis as a fallback for a different topic. Other topics use custom with geometrically meaningful vector paths/shapes and labels, not a flowchart. No image-generation/photo service is configured: be honest that the result is an educational illustration, not a generated photograph. If you cannot represent the topic, explain the limitation instead of substituting another subject.
MATH: Formula requests (including Fourier series) use render_math_note with a title, valid LaTeX and concise variable explanations. Use $...$ inline, and $$ on separate lines for display equations. Preserve backslashes in JSON strings (escape them correctly). Never put LaTeX in add_text_label, Mermaid, or a code block. Distinguish the series and coefficient conventions (period 2π versus 2L); do not mix them. Validate formulas through the tool before finishing.
Student doubts and teacher explanation assistance ONLY use propose_board_addition. No board mutation until teacher approves. No pupil personal data. For sensitive medical, abuse or self-harm topics, give a private teacher safeguarding suggestion, never classroom visuals.
For NIPUN mode: read board, keep existing teacher work; simplify document text with update_component and add one oral activity and one deterministic counting/letter/math activity. Do not claim official NIPUN certification. Selected lesson mode: ${req.lessonMode || 'standard'}.
Board snapshot: ${JSON.stringify(req.domElements || {}).slice(0,20000)}. Canvas objects: ${JSON.stringify(req.canvasObjects || []).slice(0,16000)}.
Max 12 board actions. Stop when requested material is queued and summarise in 1–3 sentences. No arbitrary HTML/JS apps.`;
  const agent = new Agent({ ...(model ? {model} : provider), systemPrompt: policy, tools,
    maxIterations: Math.min(8, Math.max(2, Number(process.env.CLINE_MAX_ITERATIONS) || 6)), toolExecution:'sequential',
    hooks: {
      beforeTool: ({tool}) => {
        const board = !['search_syllabus','get_chapter_exercises','get_nipun_targets','generate_math_practice','get_varnamala','get_board_text','propose_board_addition'].includes(tool.name);
        if (board && ctx.proposalOnly) return {skip:true,reason:'This is a teacher-review request. Use propose_board_addition.'};
        if (board && ctx.requiresGrounding && !ctx.grounded) return {skip:true,reason:'Search the syllabus before publishing curriculum content.'};
        if (board && ctx.calls.length>=12) return {skip:true,stop:true,reason:'Board action budget exhausted.'};
      },
    },
    initialMessages:(req.history || []).slice(-8).map((m:any)=>({id:crypto.randomUUID(),role:m.role === 'model' ? 'assistant' : 'user',createdAt:Date.now(),content:[{type:'text',text:String(m.text).slice(0,4000)}]})),
  });
  const events: string[] = [];
  const unsubscribe = agent.subscribe(e => { if (e.type === 'run-finished') events.push(e.type); else if (e.type === 'tool-started' || e.type === 'tool-finished') events.push(`${e.type}:${e.toolCall.toolName}`); });
  const cancel = () => agent.abort('Teacher cancelled');
  req.signal?.addEventListener('abort',cancel,{once:true});
  const timeout = setTimeout(()=>agent.abort('Classroom request deadline exceeded'),110000);
  try {
    if (req.signal?.aborted) throw new Error('Request cancelled');
    const images = provider.providerId === 'cline' || provider.providerId === 'gemini' || provider.providerId === 'vertex'
      ? [req.highResInputImage, req.canvasImageBase64].filter((s:any)=>typeof s==='string' && s.length<8_000_000 && /^data:image\/(png|jpeg|webp);base64,/.test(s)).slice(0,2) : [];
    const result = await agent.run({id:crypto.randomUUID(),role:'user',createdAt:Date.now(),content:[
      {type:'text',text:req.prompt},...images.map((image:string)=>({type:'image' as const,image})),
    ]});
    if (result.status !== 'completed') throw result.error || new Error(result.status === 'aborted' ? 'Request cancelled.' : 'Agent could not complete the lesson. Retry with a shorter command.');
    if (!model) recordClassroomHealth(provider as ReturnType<typeof resolveProvider>);
    return {functionCalls:ctx.calls,textResponse:result.outputText,proposals:ctx.proposals,citations:ctx.citations,
      usageMetadata:{promptTokenCount:result.usage.inputTokens,candidatesTokenCount:result.usage.outputTokens},
      agentIterations:result.iterations,provider:provider.providerId,model:provider.modelId,engine:'cline',events};
  } catch (error) {
    if (!model && !req.signal?.aborted) recordClassroomHealth(provider as ReturnType<typeof resolveProvider>, classifyClassroomError(error, provider.providerId));
    throw error;
  } finally {clearTimeout(timeout); unsubscribe(); req.signal?.removeEventListener('abort',cancel);}
}