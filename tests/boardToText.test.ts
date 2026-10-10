import {describe,it,expect} from 'vitest';
import {boardToText} from '../utils/boardToText';
describe('semantic read-aloud',()=>{
 it('orders text and widgets and omits placeholder duplicates',()=>{
  const result=boardToText([{id:'one',text:'Title',left:10,top:5},{id:'map',isDomPlaceholder:true}],{map:{x:30,y:10,componentType:'MERMAID_DIAGRAM',config:{code:'mindmap\n root((जल चक्र))\n वर्षा'}}});
  expect(result).toHaveLength(2);expect(result[0].text).toBe('Title');expect(result[1].text).toContain('जल चक्र');
 });
});