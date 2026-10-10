import {describe,it,expect,vi,afterEach} from 'vitest';
import express from 'express';
import type {Server} from 'node:http';
import {voiceRouter} from '../server/voiceRouter';
let server:Server;
async function appUrl(){const app=express();app.use('/voice',voiceRouter);server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address() as any;return `http://127.0.0.1:${address.port}/voice`;}
afterEach(async()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));});
describe('voice capability and limits',()=>{
 it('rejects removed Assamese language before contacting a provider',async()=>{const base=await appUrl();const r=await fetch(base+'/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'test',lang:'as'})});expect(r.status).toBe(400);});
 it('explains missing credentials and validates audio before provider calls',async()=>{vi.stubEnv('SARVAM_API_KEY','');const base=await appUrl();const r=await fetch(base+'/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'hello',lang:'en'})});expect(r.status).toBe(503);const a=await fetch(base+'/stt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base64Audio:'invalid',language:'hi'})});expect(a.status).toBe(413);});
 it('uses Sarvam STT with Hindi code-mixing and preserves the input codec',async()=>{
  vi.stubEnv('SARVAM_API_KEY','test-only-placeholder');const base=await appUrl();const clientFetch=globalThis.fetch;
  const provider=vi.fn(async(_url:any,init:any)=>{
   expect(init.headers['api-subscription-key']).toBe('test-only-placeholder');
   const form=init.body as FormData;expect(form.get('model')).toBe('saaras:v4');expect(form.get('mode')).toBe('codemix');expect(form.get('language_code')).toBe('unknown');
   expect((form.get('file') as File).type).toBe('audio/mp4');expect((form.get('file') as File).name).toBe('recording.mp4');
   return Response.json({transcript:'बोर्ड पर quiz बनाओ',language_code:'hi-IN'});
  });vi.stubGlobal('fetch',provider);
  const response=await clientFetch(base+'/stt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base64Audio:`data:audio/mp4;base64,${Buffer.alloc(128,1).toString('base64')}`,language:'hi',engine:'sarvam'})});
   expect(response.status).toBe(200);expect(await response.json()).toMatchObject({engine:'sarvam',language:'hi-IN',warningLanguage:'en',detectedLanguages:['hi','en'],languageDetection:'provider+script-heuristic'});expect(provider).toHaveBeenCalledTimes(1);
 });
 it('preserves detected Tamil independently of the selected Hindi UI language',async()=>{
  vi.stubEnv('SARVAM_API_KEY','test-only-placeholder');const base=await appUrl();const clientFetch=globalThis.fetch;
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({transcript:'வரைபடம்',language_code:'ta-IN'})));
  const response=await clientFetch(base+'/stt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base64Audio:Buffer.alloc(128,1).toString('base64'),language:'hi'})});
  expect(await response.json()).toMatchObject({language:'ta-IN',warningLanguage:'ta',detectedLanguages:['ta']});
 });
 it('uses English if provider omits its language metadata',async()=>{
  vi.stubEnv('SARVAM_API_KEY','test-only-placeholder');const base=await appUrl();const clientFetch=globalThis.fetch;
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({transcript:'बोर्ड बनाओ'})));
  const response=await clientFetch(base+'/stt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base64Audio:Buffer.alloc(128,1).toString('base64'),language:'hi'})});
  expect(await response.json()).toMatchObject({language:null,warningLanguage:'en'});
 });
 it('rejects alternate speech providers and advertises Sarvam only',async()=>{
  const base=await appUrl();const status=await (await fetch(base+'/status')).json();expect(status.provider).toBe('sarvam');expect(status.languages).toHaveLength(11);expect(status.languages).not.toContain('as');
  const response=await fetch(base+'/stt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base64Audio:Buffer.alloc(128,1).toString('base64'),language:'hi',engine:'whisper'})});expect(response.status).toBe(400);
 });
 it('returns a provider failure without leaking credentials or switching engines',async()=>{
  vi.stubEnv('SARVAM_API_KEY','test-only-placeholder');const base=await appUrl();const clientFetch=globalThis.fetch;
  const provider=vi.fn(async()=>new Response('credential-shaped private provider error',{status:401}));vi.stubGlobal('fetch',provider);
  const response=await clientFetch(base+'/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'नमस्ते',lang:'hi'})});
  expect(response.status).toBe(502);expect(await response.text()).not.toContain('private provider error');expect(provider).toHaveBeenCalledTimes(1);
 });
});