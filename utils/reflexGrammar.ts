import { normalizeIndicText } from './indicNormalize';
export type ReflexId = 'UNDO' | 'REDO' | 'READ_BOARD' | 'STOP_SPEAK' | 'ZOOM_IN' | 'ZOOM_OUT' | 'TIMER' | 'ACCEPT_PROPOSAL' | 'REJECT_PROPOSAL';
export function matchReflex(input: string): { id: ReflexId; seconds?: number } | null {
  const t = normalizeIndicText(input);
  // Compound requests belong to the agent; never silently discard the second operation.
  if (/\b(and|aur|then)\b|और|তারপর/.test(t)) return null;
  if (/^(?:undo(?: karo)?|(?:pichh?la|pichhle) (?:action|kaam|step)?\s*(?:undo karo|hatao|mitao|wapas karo)|पिछला (?:action|काम|कदम) (?:undo करो|हटाओ|मिटाओ)|শেষ কাজ undo করো)$/.test(t)) return { id: 'UNDO' };
  if (/^(?:redo(?: karo)?|dobara karo|फिर से करो)$/.test(t)) return { id: 'REDO' };
  if (/^(?:read (?:the )?board|board (?:par|pe) jo likha hai (?:use )?(?:mujhe )?bolkar batao|board (?:padho|padh ke sunao)|board पर जो लिखा है उसे मुझे बोलकर बताओ|board पर जो लिखा है (?:पढ़कर|बोलकर) (?:सुनाओ|बताओ))$/.test(t)) return { id: 'READ_BOARD' };
  if (/^(?:ruko|bas|stop(?: speaking)?|रुको|बस)$/.test(t)) return { id: 'STOP_SPEAK' };
  if (/^(?:zoom in|board bada karo|बड़ा करो)$/.test(t)) return { id: 'ZOOM_IN' };
  if (/^(?:zoom out|board chhota karo|छोटा करो)$/.test(t)) return { id: 'ZOOM_OUT' };
  if (/^(?:haan(?: board (?:pe|par) daalo)?|yes(?: add (?:it )?to (?:the )?board)?|हाँ(?: board पर डालो)?|approve)$/.test(t)) return { id: 'ACCEPT_PROPOSAL' };
  if (/^(?:nahin|nahi|नहीं|reject|no)$/.test(t)) return { id: 'REJECT_PROPOSAL' };
  const timer = t.match(/^(?:timer\s+)?(\d+)\s*(?:minute|min|मिनट)(?:\s*(?:ka )?timer)?(?:\s*(?:lagao|start|का लगाओ|लगाओ))?$/);
  if (timer && Number(timer[1]) > 0 && Number(timer[1]) <= 180) return { id: 'TIMER', seconds: Number(timer[1]) * 60 };
  return null;
}