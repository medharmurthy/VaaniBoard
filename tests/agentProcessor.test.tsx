import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {renderHook,waitFor,act} from '@testing-library/react';
import {useAgentProcessor} from '../hooks/useAgentProcessor';
import {useStore} from '../store';
import {BoardHistory} from '../utils/boardHistory';
vi.mock('../utils/sounds',()=>({sounds:{play:vi.fn()}}));
describe('event-driven board processing',()=>{
 it('processes a newly enqueued action without relying on a stale rendered queue',async()=>{
  const add=vi.fn();const commit=vi.fn();
  window.fabric={Rect:class{constructor(args:any){Object.assign(this,args);}}};
  const canvas={add,setActiveObject:vi.fn(),requestRenderAll:vi.fn(),getObjects:()=>[],remove:vi.fn()};
  useStore.setState({actionQueue:[],domElements:{},isActing:false,beginAiTransaction:vi.fn(),commitAiTransaction:commit});
  const ref={current:canvas};const {unmount}=renderHook(()=>useAgentProcessor(ref));
  await act(async()=>{useStore.getState().addAction({id:'test',type:'RENDER_HTML',status:'PENDING',payload:{x:10,y:10,width:300,height:300,componentType:'COUNTING_ACTIVITY',config:{max:10},html:''}});});
  await waitFor(()=>expect(add).toHaveBeenCalledTimes(1),{timeout:2000});
  await waitFor(()=>expect(commit).toHaveBeenCalled());
  expect(Object.keys(useStore.getState().domElements)).toHaveLength(1);expect(useStore.getState().actionQueue).toHaveLength(0);
  unmount();
 });
 it('keeps an edit and subsequent widget in one history transaction despite synchronous subscribers',async()=>{
  const history=new BoardHistory();
  const original={note:{id:'note',componentType:'DOCUMENT_PAGE',x:10,y:10,html:'',width:300,height:300,scaleX:1,scaleY:1,rotation:0,zIndex:10,config:{markdown:'Original lesson'}}};
  const snapshot=()=>({canvas:'[]',dom:JSON.stringify(useStore.getState().domElements)});
  const begin=vi.fn(()=>history.begin(snapshot()));const commit=vi.fn(()=>history.commit(snapshot()));
  window.fabric={Rect:class{constructor(args:any){Object.assign(this,args);}}};
  const canvas={add:vi.fn(),setActiveObject:vi.fn(),requestRenderAll:vi.fn(),getObjects:()=>[],remove:vi.fn()};
  useStore.setState({actionQueue:[],domElements:original,isActing:false,beginAiTransaction:begin,commitAiTransaction:commit});
  history.record(snapshot());
  const {unmount}=renderHook(()=>useAgentProcessor({current:canvas}));
  try {
   await act(async()=>{useStore.setState({actionQueue:[
    {id:'edit',type:'EDIT_HTML',status:'PENDING',payload:{objectId:'note',config:{markdown:'Simplified lesson'}}},
    {id:'activity',type:'RENDER_HTML',status:'PENDING',payload:{x:10,y:10,width:300,height:300,componentType:'COUNTING_ACTIVITY',config:{max:5},html:''}},
   ]});});
   await waitFor(()=>expect(commit).toHaveBeenCalledTimes(1),{timeout:4000});
   expect(begin).toHaveBeenCalledTimes(1);expect(Object.keys(useStore.getState().domElements)).toHaveLength(2);
   const undo=history.undo();expect(JSON.parse(undo!.dom)).toEqual(original);
  }finally{unmount();}
 });
});