import {describe,it,expect,vi,afterEach} from 'vitest';
import {resolveProvider} from '../server/cline/providers';
import {GEMINI_MODEL} from '../constants';
afterEach(()=>vi.unstubAllEnvs());
describe('strict provider choice',()=>{
 it('never switches explicit offline choice to cloud even if keys exist',()=>{vi.stubEnv('GEMINI_API_KEY','test-only-not-a-key');expect(resolveProvider({aiPreference:'ollama'}).providerId).toBe('ollama');});
 it('requires server configuration for remote Ollama endpoints',()=>{vi.stubEnv('OLLAMA_BASE_URL','http://localhost:11434');expect(()=>resolveProvider({aiPreference:'ollama',ollamaBaseUrl:'http://169.254.169.254'})).toThrow(/administrator/);});
 it('fails clearly for missing Sarvam credentials',()=>{vi.stubEnv('SARVAM_API_KEY','');expect(()=>resolveProvider({aiPreference:'sarvam'})).toThrow(/SARVAM_API_KEY/);});
 it('defaults to the researched low-cost stable Gemini model',()=>{
  vi.stubEnv('GEMINI_API_KEY','test-only-placeholder');vi.stubEnv('GEMINI_MODEL','');vi.stubEnv('CLINE_MODEL','');
  const provider=resolveProvider({aiPreference:'gemini'});expect(GEMINI_MODEL).toBe('gemini-3.5-flash-lite');expect(provider.modelId).toBe(GEMINI_MODEL);
 });
 it('keeps a server key authoritative over stale shared-browser credentials',()=>{
  vi.stubEnv('GEMINI_API_KEY','server-test-placeholder');
  expect(resolveProvider({aiPreference:'gemini',geminiApiKey:'old-browser-placeholder'}).apiKey).toBe('server-test-placeholder');
 });
 it('uses Cline credits with a namespaced model and server-only credentials',()=>{
  vi.stubEnv('CLINE_API_KEY','server-test-only');vi.stubEnv('CLINE_MODEL','');
  const p=resolveProvider({aiPreference:'cline',geminiApiKey:'browser-key'});
  expect(p.providerId).toBe('cline');expect(p.modelId).toBe('google/gemini-3.5-flash-lite');expect(p.apiKey).toBe('server-test-only');
 });
 it('does not fall back to Google when the selected Cline key is missing',()=>{
  vi.stubEnv('CLINE_API_KEY','');vi.stubEnv('GEMINI_API_KEY','test-only');
  expect(()=>resolveProvider({aiPreference:'cline'})).toThrow(/CLINE_API_KEY/);
 });
 it('follows the configured Cline provider in auto mode',()=>{
  vi.stubEnv('CLINE_PROVIDER','cline');vi.stubEnv('CLINE_API_KEY','test-only');
  expect(resolveProvider({aiPreference:'auto'}).providerId).toBe('cline');
 });
 it('prefers available Cline credits when no provider is configured',()=>{
  vi.stubEnv('CLINE_PROVIDER','auto');vi.stubEnv('CLINE_API_KEY','test-only');
  expect(resolveProvider({aiPreference:'auto'}).providerId).toBe('cline');
 });
 it('does not reuse a gateway model identifier for direct providers',()=>{
  vi.stubEnv('CLINE_MODEL','google/gemini-3.5-flash-lite');vi.stubEnv('GEMINI_API_KEY','test-only');vi.stubEnv('GEMINI_MODEL','gemini-3.5-flash-lite');
  expect(resolveProvider({aiPreference:'gemini'}).modelId).toBe('gemini-3.5-flash-lite');
  expect(resolveProvider({aiPreference:'ollama',selectedOllamaModel:'local-test'}).modelId).not.toContain('google/');
 });
});