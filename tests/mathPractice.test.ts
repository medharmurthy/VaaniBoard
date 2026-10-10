import {describe,it,expect} from 'vitest';
import {generateMathPractice} from '../server/fln/mathPractice';
import {normalizeIndicText} from '../utils/indicNormalize';
describe('deterministic arithmetic',()=>{
 it('computes bounded addition and subtraction correctly across 1000 questions',()=>{
  for(let seed=0;seed<50;seed++)for(const op of ['add','sub'] as const)for(const q of generateMathPractice({op,max:20,count:10,seed,lang:'hi'})){
   const [a,b]=q.operands;const answer=op==='add'?a+b:a-b;
   expect(answer).toBeGreaterThanOrEqual(0);expect(answer).toBeLessThanOrEqual(20);
   expect(normalizeIndicText(q.options[q.correctIndex])).toBe(String(answer));expect(new Set(q.options).size).toBe(4);
  }
 });
});