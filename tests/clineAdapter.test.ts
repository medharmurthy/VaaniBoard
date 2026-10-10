import {describe,it,expect,vi,afterEach} from 'vitest';
import type {AgentModel} from '@cline/shared';
import {generateAgentActionsCline} from '../server/cline/clineAdapter';
import {createClassroomTools,queueBoardCall,type ClassroomContext} from '../server/cline/classroomTools';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let fixtureDir: string | undefined;
afterEach(()=>{vi.unstubAllEnvs();if(fixtureDir)fs.rmSync(fixtureDir,{recursive:true,force:true});fixtureDir=undefined;});
function fakeTools(turns: {name:string;args:any}[][]): AgentModel {
  let turn=0;
  return {async *stream(){
    const calls=turns[turn++];
    if(calls){for(const [i,c] of calls.entries())yield {type:'tool-call-delta',toolCallId:`${turn}-${i}`,toolName:c.name,input:c.args};yield {type:'finish',reason:'tool-calls'};}
    else {yield {type:'text-delta',text:'Lesson ready.'};yield {type:'finish',reason:'stop'};}
  }};
}
const widget=(componentType:string,config:any)=>({name:'add_component',args:{componentType,gridPosition:'CENTER',configJson:JSON.stringify(config)}});

describe('Cline SDK classroom runtime',()=>{
  it('executes an actual SDK loop with a fake model and publishes typed board actions',async()=>{
    let turn=0;
    const model:AgentModel={async *stream(){
      if(turn++===0){
        yield {type:'tool-call-delta',toolCallId:'one',toolName:'add_component',input:{componentType:'COUNTING_ACTIVITY',gridPosition:'CENTER',configJson:JSON.stringify({lang:'hi',max:10})}};
        yield {type:'finish',reason:'tool-calls'};
      }else{yield {type:'text-delta',text:'Counting activity ready.'};yield {type:'finish',reason:'stop'};}
    }};
    const result=await generateAgentActionsCline({prompt:'Hindi mein counting activity banao',lang:'hi',boardLanguage:'hi',canvasObjects:[],domElements:{}},model);
    expect(result.engine).toBe('cline');expect(result.functionCalls[0].name).toBe('add_component');
    expect(JSON.parse(result.functionCalls[0].args.configJson).lang).toBe('hi');expect(turn).toBe(2);
    expect(result.events).toContain('tool-started:add_component');
  });
  it('grounding gate prevents curriculum mutation without evidence',()=>{
    const ctx:ClassroomContext={req:{},calls:[],citations:[],proposals:[],grounded:false,requiresGrounding:true,proposalOnly:false};
    expect(()=>queueBoardCall(ctx,'add_component',{componentType:'DOCUMENT_PAGE',gridPosition:'CENTER',configJson:'{}'})).toThrow(/search_syllabus/);
    expect(ctx.calls).toHaveLength(0);
  });
  it('student doubts cannot directly modify the shared board',()=>{
    const ctx:ClassroomContext={req:{},calls:[],citations:[],proposals:[],grounded:true,requiresGrounding:false,proposalOnly:true};
    expect(()=>queueBoardCall(ctx,'add_text_label',{text:'answer'})).toThrow(/propose_board_addition/);
    expect(createClassroomTools(ctx).some(t=>t.name==='run_commands')).toBe(false);
    expect(createClassroomTools(ctx).some(t=>t.name==='add_interactive_app')).toBe(false);
  });
  it('queues a mind map and photosynthesis diagram in a fake-model lesson',async()=>{
    const model=fakeTools([[widget('MERMAID_DIAGRAM',{code:'mindmap\n  root((Water))\n    Rain\n    Evaporation'}),widget('LABELLED_DIAGRAM',{template:'photosynthesis',lang:'hi'})]]);
    const r=await generateAgentActionsCline({prompt:'Create a water mind map and photosynthesis diagram',lang:'hi'},model);
    expect(r.functionCalls).toHaveLength(2);expect(r.events).toContain('tool-finished:add_component');
    expect(r.functionCalls.map(c=>c.args.componentType)).toEqual(['MERMAID_DIAGRAM','LABELLED_DIAGRAM']);
  });
  it('grounds a student doubt in retrieved evidence and returns only a teacher proposal',async()=>{
    fixtureDir=fs.mkdtempSync(path.join(os.tmpdir(),'vaani-rag-test-'));
    fs.writeFileSync(path.join(fixtureDir,'index.json'),JSON.stringify({chapters:[],chunks:[{id:'source-cell',chapterKey:'test-cell',chapterTitle:'Cells',chapterNo:1,bookCode:'test',grade:9,subject:'SCIENCE',lang:'en',page:12,pdfPage:1,pdfFile:'fixture.pdf',kind:'content',text:'Original fixture: osmosis is water moving across a membrane.'}]}));
    vi.stubEnv('SYLLABUS_INDEX_DIR',fixtureDir);
    const model=fakeTools([[{name:'search_syllabus',args:{query:'osmosis',chapterKey:'test-cell'}}],[{name:'propose_board_addition',args:{kind:'answer',title:'Osmosis',body:'Water moves through a membrane.',citations:['source-cell','invented']}}]]);
    const r=await generateAgentActionsCline({prompt:'A student doubt about NCERT osmosis',lang:'hi',activeChapter:'test-cell'},model);
    expect(r.functionCalls).toEqual([]);expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0].citations).toEqual(['source-cell']);expect(r.citations[0].page).toBe(12);
  });
  it('simplifies an existing note in NIPUN mode without replacing it, then adds a local activity',async()=>{
    const model=fakeTools([[{name:'get_board_text',args:{}}],[{name:'update_component',args:{objectId:'note',configJson:JSON.stringify({title:'पानी',markdown:'पानी पीने के काम आता है।'})}},widget('COUNTING_ACTIVITY',{lang:'hi',max:5})]]);
    const r=await generateAgentActionsCline({prompt:'Simplify this board for NIPUN Class 2',lang:'hi',lessonMode:'nipun',domElements:{note:{id:'note',componentType:'DOCUMENT_PAGE',config:{markdown:'Water supports living things.'}}}},model);
    expect(r.functionCalls.map(c=>c.name)).toEqual(['update_component','add_component']);
    expect(r.functionCalls[0].args.objectId).toBe('note');
  });
  it('propagates model failure instead of returning an empty successful lesson',async()=>{
    const model:AgentModel={async *stream(){throw new Error('prepayment credits are depleted');}};
    await expect(generateAgentActionsCline({prompt:'Create a lesson',lang:'hi'},model)).rejects.toThrow(/prepayment/);
  });
});