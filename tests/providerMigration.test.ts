import {describe,it,expect,vi,afterEach} from 'vitest';
afterEach(()=>{localStorage.clear();vi.resetModules();});
describe('Cline billing browser preference migration',()=>{
 it('migrates a legacy direct-Gemini preference to the server default once',async()=>{
  localStorage.clear();localStorage.setItem('ai_preference','gemini');vi.resetModules();
  const {useStore}=await import('../store');
  expect(useStore.getState().aiPreference).toBe('auto');expect(localStorage.getItem('ai_preference')).toBe('auto');
 });
 it.each(['ollama','cline'])('preserves explicit %s selection',async(preference)=>{
  localStorage.clear();localStorage.setItem('ai_preference',preference);vi.resetModules();
  const {useStore}=await import('../store');expect(useStore.getState().aiPreference).toBe(preference);
 });
 it('respects later explicit direct-Gemini selection after the migration',async()=>{
  localStorage.clear();localStorage.setItem('ai_preference','gemini');localStorage.setItem('vaani_provider_routing_v2','1');vi.resetModules();
  const {useStore}=await import('../store');expect(useStore.getState().aiPreference).toBe('gemini');
 });
});