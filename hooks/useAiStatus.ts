import { useState, useEffect } from 'react';
import { CONFIG } from '../constants';
import { useStore } from '../store';

export interface AiStatus {
  mode: 'cline' | 'gemini' | 'ollama' | 'vertex' | 'sarvam' | 'unavailable';
  model: string;
  online: boolean;
  verified?: boolean;
  message?: string;
  reason?: string;
  checkedAt?: number;
  ollamaStatus?: { online: boolean; hasModel: boolean; models: string[]; activeModel?: string };
  geminiStatus?: { online: boolean; reason: string };
  vertexStatus?: { online: boolean; reason: string };
}

export const useAiStatus = () => {
  const { aiPreference, geminiApiKey, ollamaBaseUrl, selectedOllamaModel, selectedVertexModel, selectedGeminiModel } = useStore();
  const [status, setStatus] = useState<AiStatus>({
    mode: 'unavailable',
    model: '',
    online: false
  });

  useEffect(() => {
    let alive = true;
    let latestRequest = 0;
    const fetchStatus = async () => {
      const request = ++latestRequest;
      try {
        const apiUrl = (import.meta as any).env.VITE_API_URL || '';
        const res = await fetch(`${apiUrl}/api/ai/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiPreference, geminiApiKey, ollamaBaseUrl, selectedOllamaModel, selectedVertexModel, selectedGeminiModel })
        });

        if (res.ok) {
          const data = await res.json();
          if (alive && request === latestRequest) setStatus({ ...data, checkedAt: Date.now() });
        } else {
          if (alive && request === latestRequest) setStatus(s => ({ ...s, online: false, mode: 'unavailable', reason: `http_${res.status}`, checkedAt: Date.now() }));
        }
      } catch (e) {
        if (alive && request === latestRequest) setStatus(s => ({ ...s, online: false, mode: 'unavailable', reason: 'network', checkedAt: Date.now() }));
      }
    };

    fetchStatus();
    window.addEventListener('online', fetchStatus);
    window.addEventListener('offline', fetchStatus);
    window.addEventListener('vaani:ai-health-changed', fetchStatus);
    const interval = setInterval(fetchStatus, CONFIG.ui.aiStatusPollIntervalMs);
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener('online', fetchStatus);
      window.removeEventListener('offline', fetchStatus);
      window.removeEventListener('vaani:ai-health-changed', fetchStatus);
    };
  }, [aiPreference, selectedOllamaModel, selectedGeminiModel, selectedVertexModel, geminiApiKey, ollamaBaseUrl]);

  return status;
};
