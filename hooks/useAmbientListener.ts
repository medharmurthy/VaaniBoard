import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { toast } from '../utils/toast';
import { sounds } from '../utils/sounds';
import { resolveSpeechLanguage } from '../utils/warningLanguage';

export interface HandsFreeCommandResult { matched: boolean; action: string; detail?: string }
export function matchAndExecuteHandsFreeCommand(rawText: string): HandsFreeCommandResult {
  const wake = rawText.match(/^(?:hey\s+)?(?:vaani|वाणी)[,\s]+(?:suno\s+)?(.+)$/i);
  if (!wake) return { matched: false, action: 'UNKNOWN' };
  const command = wake[1].trim();
  useStore.getState().setLastVoiceCommand(command);
  window.dispatchEvent(new CustomEvent('vaani:voice-command', { detail: command }));
  return { matched: true, action: 'AI_ASSISTANT', detail: command };
}
export interface UseAmbientListenerOptions { onTranscriptDetected?: (transcript: string) => void; sliceIntervalMs?: number }

/** Each Sarvam clip is a standalone recording, not an undecodable slice of a WebM stream. */
export function useAmbientListener(options: UseAmbientListenerOptions = {}) {
  const isAmbientActive = useStore(s => s.isHandsFreeListening);
  const [isProcessingSnippet, setProcessing] = useState(false);
  const [interimCaption, setCaption] = useState('');
  const active = useRef(false);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const starting = useRef(false);
  const callbacks = useRef(options); callbacks.current = options;

  const stopAmbient = useCallback(() => {
    active.current = false;
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null; recorder.current = null;
    useStore.getState().setHandsFreeListening(false);
    setProcessing(false); setCaption('');
  }, []);

  const startAmbient = async () => {
    if (starting.current || active.current) return;
    useStore.getState().setWarningLanguage(useStore.getState().language);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.warning('Microphone recording is unavailable. Use text input.'); return;
    }
    starting.current = true;
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true } });
      active.current = true; useStore.getState().setHandsFreeListening(true); sounds.play('mic_on');
      const nextClip = () => {
        if (!active.current || !stream.current) return;
        const chunks: Blob[] = [];
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t));
        const clip = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined); recorder.current = clip;
        clip.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        clip.onstop = async () => {
          if (!active.current) return;
          setProcessing(true);
          try {
            const blob = new Blob(chunks, { type: clip.mimeType || 'audio/webm' });
            if (blob.size > 64) {
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
              });
              request.current = new AbortController();
              const response = await fetch('/api/voice/stt', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base64Audio: base64, language: useStore.getState().language, engine: 'sarvam' }), signal: request.current.signal });
              const result = await response.json();
              if (!response.ok && response.status !== 422) throw new Error(result.error || 'Sarvam speech unavailable.');
              if (active.current && result.text) {
                useStore.getState().setWarningLanguage(resolveSpeechLanguage(result).warningLanguage);
                setCaption(result.text); useStore.getState().setLastVoiceCommand(result.text);
                const matched = matchAndExecuteHandsFreeCommand(result.text);
                if (matched.matched) callbacks.current.onTranscriptDetected?.(matched.detail!);
              }
            }
          } catch (error) {
            if (active.current) { toast.warning(error instanceof Error ? error.message : 'Sarvam speech unavailable.'); stopAmbient(); }
          } finally {
            setProcessing(false);
            if (active.current) nextClip();
          }
        };
        clip.start();
        timer.current = setTimeout(() => { if (clip.state === 'recording') clip.stop(); }, Math.max(2000, Math.min(25000, callbacks.current.sliceIntervalMs || 5000)));
      };
      nextClip();
      toast.info('Sarvam hands-free listening: say “Vaani suno …”. Audio is sent to Sarvam while enabled.');
    } catch { stopAmbient(); toast.warning('Allow microphone permission or use text input.'); }
    finally { starting.current = false; }
  };
  useEffect(() => stopAmbient, [stopAmbient]);
  const toggleAmbient = () => { if (active.current) stopAmbient(); else void startAmbient(); };
  return { isAmbientActive, isProcessingSnippet, interimCaption, startAmbient, stopAmbient, toggleAmbient };
}
export default useAmbientListener;
