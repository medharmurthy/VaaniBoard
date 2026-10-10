import type { SupportedLanguage } from '../types';

export function normalizeIndicText(text: string): string {
  let t = text.normalize('NFC').toLowerCase();
  for (const start of [0x0966, 0x09e6, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0a66, 0x06f0]) {
    t = t.replace(new RegExp(`[${String.fromCharCode(start)}-${String.fromCharCode(start + 9)}]`, 'g'), c => String(c.charCodeAt(0) - start));
  }
  const loanwords: Record<string, string> = { 'माइंड मैप': 'mind map', 'क्विज़': 'quiz', 'क्विज': 'quiz', 'बोर्ड': 'board', 'अंडू': 'undo', 'अनडू': 'undo', 'गेम': 'game', 'डायग्राम': 'diagram', 'टाइमर': 'timer', 'निपुण': 'nipun' };
  for (const [word, replacement] of Object.entries(loanwords)) t = t.replaceAll(word, replacement);
  return t.replace(/[।!?.,]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function detectBoardLanguage(text: string): SupportedLanguage | undefined {
  const t = text.toLowerCase();
  const names: [SupportedLanguage, RegExp][] = [
    ['hi', /(?:hindi|हिंदी|हिन्दी)\s*(?:mein|me|में)/],
    ['bn', /(?:bengali|bangla|বাংলা)\s*(?:mein|me|में|তে)/], ['ta', /(?:tamil|தமிழ்)\s*(?:mein|में|il)/],
    ['te', /(?:telugu|తెలుగు)\s*(?:mein|में|lo)/], ['mr', /(?:marathi|मराठी)\s*(?:mein|में|मध्ये)/],
    ['en', /(?:in english|english mein|अंग्रेज़ी में)/],
  ];
  return names.find(([, re]) => re.test(t))?.[0];
}