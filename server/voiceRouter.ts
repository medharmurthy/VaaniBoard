import { Router, json } from 'express';
import { z } from 'zod';
import { getLanguageProfile, LANGUAGE_PROFILES, SUPPORTED_LANGUAGES } from '../utils/languages';
import { resolveSpeechLanguage } from '../utils/warningLanguage';

export const voiceRouter = Router();
voiceRouter.use(json({ limit: '12mb' }));
const language = z.string().refine(l => !!LANGUAGE_PROFILES[l.split('-')[0]], 'Unsupported Indian language');
voiceRouter.get('/status', (_req, res) => res.json({ provider: 'sarvam', sarvam: !!process.env.SARVAM_API_KEY,
  sttModel: 'saaras:v4', ttsModel: 'bulbul:v3', languages: SUPPORTED_LANGUAGES.map(p => p.code), fallback: 'text' }));
voiceRouter.post('/stt', async (req, res) => {
  const parsed = z.object({
    base64Audio: z.string().max(12_000_000).optional(), audioBase64: z.string().max(12_000_000).optional(),
    language: language.optional(), lang: language.optional(), detectLanguage: z.boolean().default(true), engine: z.literal('sarvam').default('sarvam'),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid speech request.' });
  const input = parsed.data;
  const rawAudio = input.base64Audio || input.audioBase64 || '';
  const mime = rawAudio.match(/^data:(audio\/[A-Za-z0-9.+-]+)(?:;codecs=[^;]+)?;base64,/)?.[1] || 'audio/webm';
  if (!['audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/x-wav','audio/ogg','audio/flac','audio/aac'].includes(mime)) return res.status(400).json({error:'Unsupported audio format.'});
  const audio = rawAudio.replace(/^data:audio\/[^,]+;base64,/, '');
  if (!audio || !/^[A-Za-z0-9+/\r\n]+={0,2}$/.test(audio)) return res.status(400).json({ error: 'Audio must be base64 encoded.' });
  const data = Buffer.from(audio, 'base64');
  if (data.length < 64 || data.length > 8_000_000) return res.status(413).json({ error: 'Audio must be between 64 bytes and 8 MB.' });
  const p = getLanguageProfile(input.lang || input.language);
  try {
    if (!process.env.SARVAM_API_KEY) return res.status(503).json({ error: 'Set SARVAM_API_KEY in .env. Sarvam is the only speech provider; use text input while unavailable.', code: 'missing_key' });
    const form = new FormData();
    const extension: Record<string,string> = {'audio/mp4':'mp4','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/flac':'flac','audio/aac':'aac'};
    form.set('file', new Blob([data],{type:mime}), `recording.${extension[mime] || 'webm'}`);
    form.set('model', 'saaras:v4'); form.set('mode', 'codemix'); form.set('language_code', input.detectLanguage ? 'unknown' : p.bcp47);
    const response = await fetch('https://api.sarvam.ai/speech-to-text', { method: 'POST', headers: { 'api-subscription-key': process.env.SARVAM_API_KEY }, body: form, signal: AbortSignal.timeout(35000) });
    if (!response.ok) return res.status(response.status === 429 ? 429 : 502).json({ error: 'Speech provider rejected the request. Check the API key, quota, and clip length (maximum 30 seconds).' });
    const result = await response.json();
    if (typeof result.transcript !== 'string' || !result.transcript.trim()) return res.status(422).json({ error: 'No speech recognised.' });
    const text = result.transcript.trim();
    const language = typeof result.language_code === 'string' ? result.language_code : null;
    return res.json({ text, language, ...resolveSpeechLanguage({ language, text }), engine: 'sarvam' });
  } catch { return res.status(502).json({ error: 'Speech service unavailable. Retry or use text input.' }); }
});
voiceRouter.post('/tts', async (req, res) => {
  const parsed = z.object({ text: z.string().trim().min(1).max(2500), lang: language.default('hi') }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Speech text must contain 1–2500 characters.' });
  const p = getLanguageProfile(parsed.data.lang);
  if (!process.env.SARVAM_API_KEY) return res.status(503).json({ error: 'SARVAM_API_KEY is missing. Read the on-screen text instead.' });
  try {
    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'api-subscription-key': process.env.SARVAM_API_KEY },
      body: JSON.stringify({ text: parsed.data.text, language_code: p.bcp47, model: 'bulbul:v3', speaker: 'shubh', speech_sample_rate: 22050 }), signal: AbortSignal.timeout(35000),
    });
    if (!response.ok) return res.status(502).json({ error: 'Voice generation failed. Check quota and credentials.' });
    const body = await response.json();
    if (!Array.isArray(body.audios) || body.audios.length !== 1 || typeof body.audios[0] !== 'string') return res.status(502).json({ error: 'Expected one complete audio segment; retry with shorter text.' });
    const bytes = Buffer.from(body.audios[0], 'base64');
    if (!bytes.length || bytes.length > 10_000_000) return res.status(502).json({ error: 'Invalid voice audio.' });
    res.set('Cache-Control', 'no-store').type('audio/wav').send(bytes);
  } catch { res.status(502).json({ error: 'Voice service unavailable.' }); }
});