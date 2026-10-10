import type { SupportedLanguage } from '../types';
import { LANGUAGE_PROFILES } from './languages';

function supportedCode(value: unknown): SupportedLanguage | undefined {
  if (typeof value !== 'string') return undefined;
  const code = value.toLowerCase().split(/[-_]/)[0] as SupportedLanguage;
  return LANGUAGE_PROFILES[code] ? code : undefined;
}

/** Sarvam REST reports one language. Script evidence is a conservative local heuristic,
 * not an exhaustive detector (Roman Hinglish and Hindi/Marathi share scripts). */
export function resolveSpeechLanguage(metadata: { language?: unknown; detectedLanguages?: unknown; text?: unknown }) {
  const primary = supportedCode(metadata.language);
  const declared = Array.isArray(metadata.detectedLanguages) ? metadata.detectedLanguages : [];
  const languages = new Set<SupportedLanguage>(declared.map(supportedCode).filter((code): code is SupportedLanguage => !!code));
  if (primary) languages.add(primary);
  const text = typeof metadata.text === 'string' ? metadata.text : '';
  const scripts: [RegExp, SupportedLanguage][] = [
    [/\p{Script=Devanagari}/u, primary === 'mr' ? 'mr' : 'hi'],
    [/\p{Script=Bengali}/u, 'bn'], [/\p{Script=Tamil}/u, 'ta'],
    [/\p{Script=Telugu}/u, 'te'], [/\p{Script=Gujarati}/u, 'gu'],
    [/\p{Script=Kannada}/u, 'kn'], [/\p{Script=Malayalam}/u, 'ml'],
    [/\p{Script=Oriya}/u, 'od'], [/\p{Script=Gurmukhi}/u, 'pa'],
  ];
  let hasIndicScript = false;
  for (const [pattern, code] of scripts) if (pattern.test(text)) { hasIndicScript = true; languages.add(code); }
  if (hasIndicScript && /\b[A-Za-z]{2,}\b/.test(text)) languages.add('en');
  const unsupported = declared.some(code => !supportedCode(code));
  const warningLanguage: SupportedLanguage = !primary || unsupported || languages.size !== 1 ? 'en' : primary;
  return { warningLanguage, detectedLanguages: [...languages], languageDetection: 'provider+script-heuristic' as const };
}

const english = {
  microphone: 'Allow microphone permission, or use text input.',
  noSpeech: 'No speech recognised. Retry or type your command.',
  speechUnavailable: 'Speech service unavailable. Retry or use text input.',
  genericError: 'Something went wrong. See the details below.',
  diagramError: 'Could not render this diagram.',
  openEditor: 'Open editor', retry: 'Try again', editCode: 'Edit Mermaid code',
  preview: 'Preview', zoomOut: 'Zoom out', zoomIn: 'Zoom in', copyCode: 'Copy Mermaid code', downloadSvg: 'Download SVG',
};
type WarningKey = keyof typeof english;
// Human-readable local UI messages; no translation network request or credentials.
const messages: Partial<Record<SupportedLanguage, Partial<Record<WarningKey, string>>>> = {
  hi: { microphone: 'माइक्रोफ़ोन की अनुमति दें या लिखकर निर्देश दें।', noSpeech: 'आवाज़ समझ नहीं आई। फिर बोलें या लिखें।', speechUnavailable: 'आवाज़ सेवा उपलब्ध नहीं है। फिर कोशिश करें या लिखें।', genericError: 'समस्या हुई। नीचे विवरण देखें।', diagramError: 'यह आरेख नहीं बन सका।', openEditor: 'संपादक खोलें', retry: 'फिर कोशिश करें', editCode: 'Mermaid कोड बदलें', preview: 'पूर्वावलोकन', zoomOut: 'छोटा करें', zoomIn: 'बड़ा करें', copyCode: 'Mermaid कोड कॉपी करें', downloadSvg: 'SVG डाउनलोड करें' },
  bn: { microphone: 'মাইক্রোফোনের অনুমতি দিন অথবা লিখুন।', noSpeech: 'কথা বোঝা যায়নি। আবার বলুন অথবা লিখুন।', speechUnavailable: 'ভয়েস পরিষেবা উপলব্ধ নেই। আবার চেষ্টা করুন অথবা লিখুন।', genericError: 'সমস্যা হয়েছে। নিচের বিবরণ দেখুন।', diagramError: 'এই চিত্রটি তৈরি করা যায়নি।', openEditor: 'সম্পাদক খুলুন', retry: 'আবার চেষ্টা করুন' },
  ta: { microphone: 'மைக்ரோஃபோன் அனுமதி அளிக்கவும் அல்லது தட்டச்சு செய்யவும்.', noSpeech: 'பேச்சைப் புரிந்துகொள்ள முடியவில்லை. மீண்டும் பேசவும் அல்லது தட்டச்சு செய்யவும்.', speechUnavailable: 'குரல் சேவை கிடைக்கவில்லை. மீண்டும் முயலவும் அல்லது தட்டச்சு செய்யவும்.', genericError: 'பிழை ஏற்பட்டது. கீழே உள்ள விவரங்களைப் பார்க்கவும்.', diagramError: 'இந்த வரைபடத்தை உருவாக்க முடியவில்லை.', openEditor: 'திருத்தியைத் திறக்கவும்', retry: 'மீண்டும் முயலவும்' },
  te: { microphone: 'మైక్రోఫోన్ అనుమతి ఇవ్వండి లేదా టైప్ చేయండి.', noSpeech: 'మాట అర్థం కాలేదు. మళ్లీ మాట్లాడండి లేదా టైప్ చేయండి.', speechUnavailable: 'వాయిస్ సేవ అందుబాటులో లేదు. మళ్లీ ప్రయత్నించండి లేదా టైప్ చేయండి.', genericError: 'సమస్య ఏర్పడింది. దిగువ వివరాలు చూడండి.', diagramError: 'ఈ రేఖాచిత్రాన్ని రూపొందించలేకపోయాము.', openEditor: 'ఎడిటర్ తెరవండి', retry: 'మళ్లీ ప్రయత్నించండి' },
  mr: { microphone: 'मायक्रोफोनची परवानगी द्या किंवा टाइप करा.', noSpeech: 'आवाज समजला नाही. पुन्हा बोला किंवा टाइप करा.', speechUnavailable: 'आवाज सेवा उपलब्ध नाही. पुन्हा प्रयत्न करा किंवा टाइप करा.', genericError: 'समस्या आली. खाली तपशील पहा.', diagramError: 'हा आकृतीबंध तयार करता आला नाही.', openEditor: 'संपादक उघडा', retry: 'पुन्हा प्रयत्न करा' },
  gu: { microphone: 'માઇક્રોફોનની પરવાનગી આપો અથવા ટાઇપ કરો.', noSpeech: 'વાણી સમજાઈ નહીં. ફરી બોલો અથવા ટાઇપ કરો.', speechUnavailable: 'વૉઇસ સેવા ઉપલબ્ધ નથી. ફરી પ્રયાસ કરો અથવા ટાઇપ કરો.', genericError: 'સમસ્યા આવી. નીચે વિગતો જુઓ.', diagramError: 'આ આકૃતિ બનાવી શકાઈ નથી.', openEditor: 'સંપાદક ખોલો', retry: 'ફરી પ્રયાસ કરો' },
  kn: { microphone: 'ಮೈಕ್ರೋಫೋನ್ ಅನುಮತಿ ನೀಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.', noSpeech: 'ಮಾತು ಅರ್ಥವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಮಾತನಾಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.', speechUnavailable: 'ಧ್ವನಿ ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.', genericError: 'ಸಮಸ್ಯೆ ಉಂಟಾಗಿದೆ. ಕೆಳಗಿನ ವಿವರಗಳನ್ನು ನೋಡಿ.', diagramError: 'ಈ ರೇಖಾಚಿತ್ರವನ್ನು ರಚಿಸಲಾಗಲಿಲ್ಲ.', openEditor: 'ಸಂಪಾದಕ ತೆರೆಯಿರಿ', retry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' },
  ml: { microphone: 'മൈക്രോഫോൺ അനുമതി നൽകുക അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക.', noSpeech: 'സംസാരം മനസ്സിലായില്ല. വീണ്ടും സംസാരിക്കുക അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക.', speechUnavailable: 'ശബ്ദ സേവനം ലഭ്യമല്ല. വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക.', genericError: 'പ്രശ്നം സംഭവിച്ചു. താഴെയുള്ള വിവരങ്ങൾ കാണുക.', diagramError: 'ഈ ചിത്രം തയ്യാറാക്കാനായില്ല.', openEditor: 'എഡിറ്റർ തുറക്കുക', retry: 'വീണ്ടും ശ്രമിക്കുക' },
  od: { microphone: 'ମାଇକ୍ରୋଫୋନ୍ ଅନୁମତି ଦିଅନ୍ତୁ କିମ୍ବା ଲେଖନ୍ତୁ।', noSpeech: 'କଥା ବୁଝି ହେଲା ନାହିଁ। ପୁଣି କୁହନ୍ତୁ କିମ୍ବା ଲେଖନ୍ତୁ।', speechUnavailable: 'ଭଏସ୍ ସେବା ଉପଲବ୍ଧ ନାହିଁ। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ କିମ୍ବା ଲେଖନ୍ତୁ।', genericError: 'ସମସ୍ୟା ହୋଇଛି। ତଳେ ବିବରଣୀ ଦେଖନ୍ତୁ।', diagramError: 'ଏହି ଚିତ୍ର ତିଆରି ହୋଇପାରିଲା ନାହିଁ।', openEditor: 'ସମ୍ପାଦକ ଖୋଲନ୍ତୁ', retry: 'ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ' },
  pa: { microphone: 'ਮਾਈਕ੍ਰੋਫੋਨ ਦੀ ਇਜਾਜ਼ਤ ਦਿਓ ਜਾਂ ਟਾਈਪ ਕਰੋ।', noSpeech: 'ਬੋਲ ਸਮਝ ਨਹੀਂ ਆਏ। ਦੁਬਾਰਾ ਬੋਲੋ ਜਾਂ ਟਾਈਪ ਕਰੋ।', speechUnavailable: 'ਆਵਾਜ਼ ਸੇਵਾ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ਟਾਈਪ ਕਰੋ।', genericError: 'ਸਮੱਸਿਆ ਆਈ ਹੈ। ਹੇਠਾਂ ਵੇਰਵੇ ਦੇਖੋ।', diagramError: 'ਇਹ ਚਿੱਤਰ ਨਹੀਂ ਬਣ ਸਕਿਆ।', openEditor: 'ਸੰਪਾਦਕ ਖੋਲ੍ਹੋ', retry: 'ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ' },
};

export function warningText(key: WarningKey, language: SupportedLanguage = 'en'): string {
  return messages[language]?.[key] || english[key];
}

/** Known warnings receive a local summary; unfamiliar technical details stay intact in English. */
export function localizeWarning(message: string, language: SupportedLanguage = 'en'): string {
  if (language === 'en' || message === 'Uploading and transcribing audio…') return message;
  const key: WarningKey = /microphone|recording is unavailable|recorded audio/i.test(message) ? 'microphone'
    : /no speech|no voice/i.test(message) ? 'noSpeech'
    : /sarvam|speech|voice service|read-aloud|audio playback/i.test(message) ? 'speechUnavailable'
    : /mermaid|render.*diagram/i.test(message) ? 'diagramError' : 'genericError';
  return `${warningText(key, language)}\n${message}`;
}