import { Agent, createTool } from '@cline/sdk';
import type { AgentModel } from '@cline/shared';
import { z } from 'zod';
import { resolveProvider, type ProviderInput } from './providers';
import { classifyClassroomError, recordClassroomHealth } from './runtimeHealth';

const mindmap = z.object({nodes:z.array(z.object({text:z.string().max(300),style:z.enum(['MAIN_TOPIC','SUBTOPIC','DETAIL']),parentNodeText:z.string().nullable()})).min(1).max(8)});
const quiz = z.object({title:z.string().max(200),questions:z.array(z.discriminatedUnion('type',[
  z.object({type:z.literal('multiple_choice'),question:z.string().max(2000),options:z.array(z.string().max(1000)).length(4),correctIndex:z.number().int().min(0).max(3)}),
  z.object({type:z.literal('essay'),question:z.string().max(2000),expectedAnswer:z.string().max(3000)}),
])).min(1).max(20)});

/** Legacy content helpers use the same selected billing provider, never hidden Google fallback. */
export async function generateToolContentCline(input: ProviderInput & {toolId:'mindmap'|'quiz'|'summary';prompt:string}, model?:AgentModel) {
  const provider = model ? undefined : resolveProvider(input);
  const schema = input.toolId === 'mindmap' ? mindmap : input.toolId === 'quiz' ? quiz : z.object({markdown:z.string().min(1).max(30000)});
  let content: any;
  const tool=createTool({name:'submit_content',description:'Return the requested structured teaching content.',inputSchema:schema,
    async execute(value) {
      if (input.toolId === 'mindmap') {
        const nodes=(value as z.infer<typeof mindmap>).nodes;
        if(nodes.filter(n=>n.style==='MAIN_TOPIC' && n.parentNodeText===null).length!==1 || nodes.some(n=>n.style!=='MAIN_TOPIC' && (!n.parentNodeText || !nodes.some(p=>p.text===n.parentNodeText)))) throw new Error('Mind map needs one root and valid parent links.');
      }
      content=input.toolId==='summary'?(value as {markdown:string}).markdown:value;
      return {accepted:true};
    }});
  const agent=new Agent({...(model?{model}:provider!),tools:[tool],maxIterations:3,
    systemPrompt:`You are an Indian classroom teaching assistant. Produce ${input.toolId} content in the requested language. Use submit_content exactly once, then stop. No executable HTML, pupil personal data or invented textbook citations.`});
  const timeout=setTimeout(()=>agent.abort('Classroom request deadline exceeded'),110000);
  try {
    const result=await agent.run(input.prompt);
    if(result.status!=='completed')throw result.error || new Error('Content generation did not complete.');
    if(content===undefined)throw new Error('Model did not submit valid teaching content.');
    if(provider)recordClassroomHealth(provider);
    return content;
  }catch(error){if(provider)recordClassroomHealth(provider,classifyClassroomError(error,provider.providerId));throw error;}
  finally{clearTimeout(timeout);}
}