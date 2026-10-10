import {describe,it,expect} from 'vitest';
import {resolveLocalClassroomCommand} from '../server/cline/localClassroomCommands';
import {matchReflex} from '../utils/reflexGrammar';
describe('brief command routing',()=>{
 it.each([
  ['Hindi mein Swar aur Vyanjan sikhane ke liye ek interactive game banao.','LETTER_GAME'],
  ['Class 2 ke bachchon ke liye 20 tak addition ka quiz banao.','QUIZ_APP'],
  ['Hindi mein ek simple counting activity banao.','COUNTING_ACTIVITY'],
 ])('%s uses a deterministic classroom activity',(prompt,type)=>{expect(resolveLocalClassroomCommand({prompt,lang:'hi'})!.functionCalls[0].args.componentType).toBe(type);});
 it.each(['Board pe water cycle ka mind map banao.','Explain photosynthesis in simple Hindi with a labelled diagram.','Is lesson ko NIPUN mode mein convert karo.'])('%s goes to the agent',prompt=>{expect(resolveLocalClassroomCommand({prompt})).toBeNull();});
 it('read and undo stay local without invoking the AI',()=>{expect(matchReflex('Board par jo likha hai, use mujhe bolkar batao.')?.id).toBe('READ_BOARD');expect(matchReflex('Pichhla action undo karo.')?.id).toBe('UNDO');});
 it('student doubts cannot bypass teacher-review agent policy',()=>{expect(resolveLocalClassroomCommand({prompt:'Ek bachche ka sawaal hai addition ka quiz banao'})).toBeNull();});
});