import {describe,it,expect,vi,afterEach} from 'vitest';
import {speakText,stopSpeaking} from '../services/speechService';
afterEach(()=>{stopSpeaking();vi.unstubAllGlobals();});
describe('Sarvam-only read-aloud',()=>{
 it('reports Sarvam failures rather than using browser speech',async()=>{
  const browserVoice=vi.fn();vi.stubGlobal('speechSynthesis',{speak:browserVoice});
  const provider=vi.fn(async()=>Response.json({error:'Sarvam unavailable; use captions.'},{status:503}));vi.stubGlobal('fetch',provider);
  await expect(speakText('नमस्ते','hi')).rejects.toThrow('Sarvam unavailable');
  expect(provider).toHaveBeenCalledTimes(1);expect(browserVoice).not.toHaveBeenCalled();
 });
});