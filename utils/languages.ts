import type { SupportedLanguage } from '../types';

export interface LanguageProfile {
  code: SupportedLanguage; name: string; nativeName: string; bcp47: string;
  font: string; numberingSystem: string; dir: 'ltr' | 'rtl';
  flag: string; isUN: boolean; sarvamTts: boolean;
}
const rows: [SupportedLanguage, string, string, string, string, boolean][] = [
  ['hi', 'Hindi / Hinglish', 'हिन्दी', 'Devanagari', 'deva', true],
  ['en', 'English', 'English', '', 'latn', true],
  ['bn', 'Bengali', 'বাংলা', 'Bengali', 'beng', true],
  ['ta', 'Tamil', 'தமிழ்', 'Tamil', 'tamldec', true],
  ['te', 'Telugu', 'తెలుగు', 'Telugu', 'telu', true],
  ['mr', 'Marathi', 'मराठी', 'Devanagari', 'deva', true],
  ['gu', 'Gujarati', 'ગુજરાતી', 'Gujarati', 'gujr', true],
  ['kn', 'Kannada', 'ಕನ್ನಡ', 'Kannada', 'knda', true],
  ['ml', 'Malayalam', 'മലയാളം', 'Malayalam', 'mlym', true],
  ['od', 'Odia', 'ଓଡ଼ିଆ', 'Oriya', 'orya', true],
  ['pa', 'Punjabi', 'ਪੰਜਾਬੀ', 'Gurmukhi', 'guru', true],
];
export const SUPPORTED_LANGUAGES: LanguageProfile[] = rows.map(([code, name, nativeName, script, numberingSystem, sarvamTts]) => ({
  code, name, nativeName, bcp47: `${code}-IN`, font: script ? `"Noto Sans ${script}", sans-serif` : 'Inter, sans-serif',
  numberingSystem, sarvamTts, dir: 'ltr', flag: '🇮🇳', isUN: false,
}));
export const LANGUAGE_PROFILES = Object.fromEntries(SUPPORTED_LANGUAGES.map(p => [p.code, p])) as Record<SupportedLanguage, LanguageProfile>;
export function getLanguageProfile(code?: string): LanguageProfile {
  return LANGUAGE_PROFILES[code?.split('-')[0] as SupportedLanguage] || LANGUAGE_PROFILES.hi;
}
export function nativeNumber(value: number, lang: string = 'hi'): string {
  const p = getLanguageProfile(lang);
  return new Intl.NumberFormat(p.bcp47, { useGrouping: false, numberingSystem: p.numberingSystem }).format(value);
}