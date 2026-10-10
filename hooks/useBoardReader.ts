import { useCallback, useState } from 'react';
import { useStore } from '../store';
import { boardToText } from '../utils/boardToText';
import { speakText, stopSpeaking } from '../services/speechService';
import { toast } from '../utils/toast';
export function useBoardReader(canvasRef: { current: any }) {
  const [isReading, setReading] = useState(false);
  const stop = useCallback(() => { stopSpeaking(); setReading(false); }, []);
  const readBoard = useCallback(async () => {
    const s = useStore.getState();
    const items = boardToText(canvasRef.current?.getObjects?.() || [], s.domElements, s.language);
    if (!items.length) { toast.info(s.language === 'hi' ? 'बोर्ड खाली है।' : 'The board is empty.'); return; }
    setReading(true);
    // Captions are also the fallback when the requested native voice is absent.
    toast.info(items.map(i => i.text).join('\n').slice(0, 800));
    try { await speakText(items.map(i => i.text).join('. '), s.language); }
    catch (e) { toast.warning(e instanceof Error ? e.message : 'Read-aloud unavailable.'); }
    finally { setReading(false); }
  }, [canvasRef]);
  return { readBoard, stop, isReading };
}