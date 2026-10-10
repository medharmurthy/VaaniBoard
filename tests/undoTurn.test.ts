import {describe,it,expect} from 'vitest';
import {BoardHistory} from '../utils/boardHistory';
describe('complete board turn history',()=>{
 it('undoes Fabric and DOM as a single AI transaction and redoes them',()=>{
  const history=new BoardHistory();const a={canvas:'[]',dom:'{}'};const b={canvas:'["placeholder"]',dom:'{"map":{"code":"mindmap"}}'};
  history.record(a);history.begin(a);history.record({canvas:'intermediate',dom:'partial'});history.commit(b);
  expect(history.undo()).toEqual(a);expect(history.redo()).toEqual(b);
 });
 it('clears redo after a new teacher action',()=>{
  const h=new BoardHistory();h.record({canvas:'a',dom:'a'});h.record({canvas:'b',dom:'b'});h.undo();h.record({canvas:'c',dom:'c'});expect(h.redo()).toBeUndefined();
 });
});