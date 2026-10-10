import {describe,it,expect} from 'vitest';
import {SUPPORTED_LANGUAGES,translations} from '../utils/translations';
import {nativeNumber} from '../utils/languages';
describe('India-first language registry',()=>{
 it('offers Indian languages, not Indonesian',()=>{expect(SUPPORTED_LANGUAGES.map(l=>l.code)).toEqual(['hi','en','bn','ta','te','mr','gu','kn','ml','od','pa']);});
 it('every language has usable chrome fallbacks',()=>{for(const l of SUPPORTED_LANGUAGES)for(const key of ['appName','save','settings','whiteboard'])expect(translations[l.code][key]).toBeTruthy();});
 it('uses Bengali and Hindi numerals',()=>{expect(nativeNumber(10,'bn')).toBe('১০');expect(nativeNumber(20,'hi')).toBe('२०');});
});
