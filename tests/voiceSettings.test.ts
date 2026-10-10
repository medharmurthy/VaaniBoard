import {describe,it,expect} from 'vitest';
import {useStore} from '../store';
import {SUPPORTED_LANGUAGES} from '../utils/languages';
describe('voice settings defaults',()=>{
 it('defaults to Sarvam recognition',()=>{expect(useStore.getState().transcribeMode).toBe('sarvam');});
 it('keeps all active language choices within Sarvam TTS coverage',()=>{
  expect(SUPPORTED_LANGUAGES.map(p=>p.code)).toEqual(['hi','en','bn','ta','te','mr','gu','kn','ml','od','pa']);
  expect(SUPPORTED_LANGUAGES.every(p=>p.sarvamTts)).toBe(true);
 });
});