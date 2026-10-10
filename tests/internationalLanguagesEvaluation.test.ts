import {describe,it,expect} from 'vitest';
import {SUPPORTED_LANGUAGES,getLanguageProfile} from '../utils/languages';
import {normalizeIndicText,detectBoardLanguage} from '../utils/indicNormalize';
import {matchReflex} from '../utils/reflexGrammar';
describe('Indic script and command evaluation',()=>{
 it('offers only languages with Sarvam read-aloud support',()=>{expect(SUPPORTED_LANGUAGES).toHaveLength(11);for(const p of SUPPORTED_LANGUAGES)expect(p.sarvamTts).toBe(true);expect(SUPPORTED_LANGUAGES.some(p=>String(p.code)==='as')).toBe(false);});
 it('has a native label and locale for each profile',()=>{for(const l of SUPPORTED_LANGUAGES){expect(l.nativeName).toBeTruthy();expect(l.bcp47).toMatch(/-IN$/);}});
 it('normalises digits and recognises language override',()=>{expect(normalizeIndicText('२० ১০')).toBe('20 10');expect(detectBoardLanguage('Hindi mein counting banao')).toBe('hi');});
 it('handles requested reflexes and passes compound prompts through',()=>{expect(matchReflex('Pichhla action undo karo.')).toEqual({id:'UNDO'});expect(matchReflex('Board par jo likha hai, use mujhe bolkar batao.')).toEqual({id:'READ_BOARD'});expect(matchReflex('undo karo aur quiz banao')).toBeNull();});
});
