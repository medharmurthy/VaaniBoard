import {describe,it,expect,vi,afterEach} from 'vitest';
import {Agent,createTool} from '@cline/sdk';
import {DefaultGateway} from '@cline/llms';
import type {AgentModel} from '@cline/shared';
import {z} from 'zod';
import {generateToolContentCline} from '../server/cline/toolContent';

afterEach(()=>{vi.unstubAllEnvs();});
function contentModel(input:any):AgentModel {
 let turn=0;
 return {async *stream(){if(turn++===0){yield {type:'tool-call-delta',toolCallId:'content',toolName:'submit_content',input};yield {type:'finish',reason:'tool-calls'};}else{yield {type:'text-delta',text:'Ready.'};yield {type:'finish',reason:'stop'};}}};
}
describe('Cline billing transport and content helpers',()=>{
 it('routes actual SDK function calls only to the Cline gateway with bearer authentication',async()=>{
  const key='test-only-cline-key';let turn=0;let submitted=false;
  const mockedFetch=vi.fn(async(url:any,init:any)=>{
   expect(String(url)).toBe('https://api.cline.bot/api/v1/chat/completions');
   expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${key}`);
   const body=JSON.parse(init.body);expect(body.model).toBe('google/gemini-3.5-flash-lite');
   expect(body.tools.some((t:any)=>t.function.name==='submit_content')).toBe(true);
   const first=turn++===0;
   const delta=first?{tool_calls:[{index:0,id:'call-1',type:'function',function:{name:'submit_content',arguments:'{"markdown":"नमस्ते"}'}}]}:{content:'Ready.'};
   const chunks=[{id:'test',object:'chat.completion.chunk',created:1,model:body.model,choices:[{index:0,delta,finish_reason:null}]},{id:'test',object:'chat.completion.chunk',created:1,model:body.model,choices:[{index:0,delta:{},finish_reason:first?'tool_calls':'stop'}]}];
   return new Response(chunks.map(c=>`data: ${JSON.stringify(c)}\n\n`).join('')+'data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  });
  const gateway=new DefaultGateway({providerConfigs:[{providerId:'cline',apiKey:key,fetch:mockedFetch}]});
  const model=gateway.createAgentModel({providerId:'cline',modelId:'google/gemini-3.5-flash-lite'});
  const tool=createTool({name:'submit_content',description:'Submit teaching content',inputSchema:z.object({markdown:z.string()}),async execute({markdown}){submitted=markdown==='नमस्ते';return {ok:true};}});
  const agent=new Agent({model,tools:[tool],maxIterations:3});const result=await agent.run('Create a greeting');
  expect(result.status).toBe('completed');expect(submitted).toBe(true);expect(mockedFetch).toHaveBeenCalledTimes(2);
 });
 it('returns validated mindmap content through the SDK instead of direct Google generation',async()=>{
  const content={nodes:[{text:'Water',style:'MAIN_TOPIC',parentNodeText:null},{text:'Rain',style:'SUBTOPIC',parentNodeText:'Water'}]};
  expect(await generateToolContentCline({toolId:'mindmap',prompt:'water'},contentModel(content))).toEqual(content);
 });
 it('returns summary markdown and quiz content without executable HTML',async()=>{
  expect(await generateToolContentCline({toolId:'summary',prompt:'summarise'},contentModel({markdown:'# पानी'}))).toBe('# पानी');
  const quiz={title:'Water',questions:[{type:'multiple_choice',question:'Which is liquid?',options:['Water','Stone','Wood','Sand'],correctIndex:0}]};
  expect(await generateToolContentCline({toolId:'quiz',prompt:'water'},contentModel(quiz))).toEqual(quiz);
 });
 it('fails when no structured content is submitted',async()=>{
  const model:AgentModel={async *stream(){yield {type:'text-delta',text:'Not structured.'};yield {type:'finish',reason:'stop'};}};
  await expect(generateToolContentCline({toolId:'summary',prompt:'summarise'},model)).rejects.toThrow(/valid teaching content/);
 });
});