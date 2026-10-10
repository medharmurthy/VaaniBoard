import {describe,it,expect} from 'vitest';
import {approveClassroomProposal} from '../services/classroomActions';
import {useStore} from '../store';
describe('teacher approval boundary',()=>{
 it('publishes nothing until approval, then queues a declarative widget',()=>{
  useStore.setState({actionQueue:[],proposals:[{id:'p',kind:'answer',title:'Answer',body:'Original teaching explanation.',citations:[]}],citations:[]});
  expect(useStore.getState().actionQueue).toHaveLength(0);expect(approveClassroomProposal('p')).toBe(true);
  expect(useStore.getState().actionQueue[0].payload.componentType).toBe('DOCUMENT_PAGE');expect(useStore.getState().proposals).toHaveLength(0);
 });
 it('rejects executable app proposals',()=>{
  useStore.setState({actionQueue:[],proposals:[{id:'unsafe',kind:'activity',title:'App',body:'',citations:[],boardCall:{name:'add_component',args:{componentType:'INTERACTIVE_APP'}}}]});
  expect(approveClassroomProposal('unsafe')).toBe(false);expect(useStore.getState().actionQueue).toHaveLength(0);
 });
});