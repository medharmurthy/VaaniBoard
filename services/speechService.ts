import { getLanguageProfile } from '../utils/languages';
let currentAudio: HTMLAudioElement | null = null;
let controller: AbortController | null = null;
let generation = 0;
export function stopSpeaking(): void {
  generation++;
  controller?.abort(); controller = null;
  currentAudio?.pause(); currentAudio = null;
  window.dispatchEvent(new Event('vaani:stop-speaking'));
}
export async function speakText(text: string, lang = 'hi'): Promise<void> {
  stopSpeaking();
  const version = generation;
  const p = getLanguageProfile(lang);
  const sentences = text.match(/[^।.!?]+[।.!?]?/g) || [text];
  const chunks: string[] = [];
  for (const sentence of sentences) {
    for (let start = 0; start < sentence.length; start += 1800) chunks.push(sentence.slice(start, start + 1800));
  }
  for (const chunk of chunks) {
    if (version !== generation || !chunk.trim()) return;
    controller = new AbortController();
    let objectUrl: string | undefined;
    try {
      const response = await fetch('/api/voice/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunk, lang: p.code }), signal: controller.signal,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Sarvam voice unavailable. Read the on-screen text instead.');
      }
      objectUrl = URL.createObjectURL(await response.blob());
      await new Promise<void>((resolve, reject) => {
        const audio = new Audio(objectUrl); currentAudio = audio;
        audio.onended = () => resolve(); audio.onerror = () => reject(new Error('Audio playback failed'));
        audio.onpause = () => { if (version !== generation) resolve(); };
        audio.play().catch(reject);
      });
    } catch (error) {
      if (version !== generation) return;
      throw error instanceof Error ? error : new Error(`${p.name} Sarvam speech is unavailable. Read the on-screen text instead.`);
    } finally { if (objectUrl) URL.revokeObjectURL(objectUrl); currentAudio = null; }
  }
}