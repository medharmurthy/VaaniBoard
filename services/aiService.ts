import { CanvasObjectData } from "../types";
import { useStore } from "../store";
import { CONFIG } from "../constants";

export interface ViewportBounds {
  width: number;
  height: number;
}

export type AiErrorCode = 'invalid_key' | 'no_internet' | 'rate_limited' | 'model_not_found' | 'local_unavailable' | 'server_error' | 'billing_required' | 'missing_key' | 'provider_error' | 'request_timeout';

export class AiServiceError extends Error {
  code: AiErrorCode;
  retryable: boolean;
  status: number;

  constructor(message: string, code: AiErrorCode = 'server_error', status = 500, retryable = false) {
    super(message);
    this.name = 'AiServiceError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const friendlyMessageForStatus = (status: number, fallback?: string) => {
  if (fallback) return fallback;
  if (status === 401 || status === 403) return 'The API key or AI service permissions are invalid.';
  if (status === 404) return 'The selected AI model was not found.';
  if (status === 429) return 'The AI quota has been reached. Please try again shortly.';
  if (status >= 500) return 'The AI service is unavailable.';
  return 'The AI request could not be processed.';
};

const parseAiError = async (response: Response): Promise<AiServiceError> => {
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    try {
      body = { error: await response.text() };
    } catch {
      body = null;
    }
  }

  const code = (body?.code || (response.status === 429 ? 'rate_limited' : response.status === 404 ? 'model_not_found' : response.status === 401 || response.status === 403 ? 'invalid_key' : 'server_error')) as AiErrorCode;
  const message = friendlyMessageForStatus(response.status, body?.error);
  const retryable = Boolean(body?.retryable ?? (response.status === 429 || response.status >= 500 || response.status === 503));
  return new AiServiceError(message, code, response.status, retryable);
};

const requestJson = async <T>(url: string, init: RequestInit = { method: 'GET' }, retries = CONFIG.ai.request.retryCount): Promise<T> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    // If user already aborted the operation, stop immediately
    if (init.signal?.aborted) {
      throw new DOMException('Request cancelled by the user.', 'AbortError');
    }

    const controller = new AbortController();
    const timeoutMs = 120000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Forward caller's abort signal to local controller
    const onCallerAbort = () => controller.abort();
    if (init.signal) {
      init.signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (init.signal) {
        init.signal.removeEventListener('abort', onCallerAbort);
      }

      if (!response.ok) {
        const error = await parseAiError(response);
        if (/\/api\/ai\/(generate|tool-content)$/.test(url)) window.dispatchEvent(new Event('vaani:ai-health-changed'));
        if (!error.retryable || attempt === retries || init.signal?.aborted) throw error;
        await wait(CONFIG.ai.request.retryBaseDelayMs * Math.pow(2, attempt));
        continue;
      }
      const data = await response.json();
      if (/\/api\/ai\/(generate|tool-content)$/.test(url) && data.engine === 'cline') window.dispatchEvent(new Event('vaani:ai-health-changed'));
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (init.signal) {
        init.signal.removeEventListener('abort', onCallerAbort);
      }

      // If user aborted, throw immediately without retrying
      if (init.signal?.aborted || error.name === 'AbortError' && init.signal?.aborted) {
        throw new DOMException('Permintaan dibatalkan oleh pengguna.', 'AbortError');
      }

      if (error instanceof AiServiceError) throw error;
      
      if (error.name === 'AbortError') {
        throw new AiServiceError(
          'The AI request timed out after 120 seconds. Please try again.',
          'server_error',
          408,
          false
        );
      }

      const networkError = new AiServiceError(
        'Could not connect to the AI service. Check your internet connection or local server.',
        'no_internet',
        0,
        true
      );
      if (attempt === retries || init.signal?.aborted) throw networkError;
      await wait(CONFIG.ai.request.retryBaseDelayMs * Math.pow(2, attempt));
    }
  }

  throw new AiServiceError('The AI request failed after several attempts.', 'server_error', 500, false);
};

export const generateAgentActions = async (
  prompt: string,
  canvasImageBase64: string,
  canvasObjects: CanvasObjectData[],
  viewport: ViewportBounds,
  highResInputImage?: string | null,
  history: { role: 'user' | 'model'; text: string }[] = [],
  pageContext?: { current: number; total: number },
  domElements: Record<string, any> = {},
  intent?: string,
  forceTools?: boolean,
  lessonContext?: {
    subject?: string;
    topic?: string;
    gradeLevel?: string;
    phase?: string;
    existingMindmapNodes?: string[];
    completedSteps?: string[];
  },
  signal?: AbortSignal
) => {
  const { aiPreference, geminiApiKey, ollamaBaseUrl, selectedGeminiModel, selectedOllamaModel, selectedVertexModel, language, boardLanguage, activeChapter, lessonMode } = useStore.getState();
  const apiUrl = (import.meta as any).env.VITE_API_URL || '';
  return requestJson<any>(`${apiUrl}/api/ai/generate`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      canvasImageBase64,
      canvasObjects,
      viewport,
      highResInputImage,
      history,
      pageContext,
      domElements,
      aiPreference,
      geminiApiKey,
      ollamaBaseUrl,
      selectedGeminiModel,
      selectedOllamaModel,
      selectedVertexModel,
      intent,
      forceTools,
      lessonContext,
      lang: language,
      boardLanguage,
      activeChapter,
      lessonMode,
      sessionId: useStore.getState().currentSessionId
    })
  });
};

export const generateToolContent = async (toolId: string, prompt: string): Promise<any> => {
  const { aiPreference, geminiApiKey, ollamaBaseUrl, selectedGeminiModel, selectedOllamaModel, selectedVertexModel } = useStore.getState() as any;
  const apiUrl = (import.meta as any).env.VITE_API_URL || '';
  const data = await requestJson<{ result: any }>(`${apiUrl}/api/ai/tool-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolId, prompt, aiPreference, geminiApiKey, ollamaBaseUrl, selectedGeminiModel, selectedOllamaModel, selectedVertexModel })
  });

  return data.result;
};

// ── Telemetry & Google Sheets Client Helpers ─────────────────────────────────

export interface TelemetryResponse {
  summary: {
    totalRequests: number;
    totalPromptTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCostUsd: number;
    totalCostInr: number;
    avgLatencyMs: number;
    successRate: number;
    providerCounts: Record<string, number>;
    modelCounts: Record<string, number>;
    syncedToSheetCount: number;
    pendingSheetCount: number;
  };
  recentLogs: any[];
  config: {
    googleSheetId?: string;
    googleSheetName?: string;
    googleSheetWebhookUrl?: string;
    autoSync: boolean;
  };
}

export const fetchTelemetryData = async (limit = 100): Promise<TelemetryResponse> => {
  const apiUrl = (import.meta as any).env.VITE_API_URL || '';
  return requestJson<TelemetryResponse>(`${apiUrl}/api/ai/telemetry?limit=${limit}`);
};

export const fetchTelemetryConfig = async (): Promise<{ config: any; appsScriptTemplate: string }> => {
  const apiUrl = (import.meta as any).env.VITE_API_URL || '';
  return requestJson<{ config: any; appsScriptTemplate: string }>(`${apiUrl}/api/ai/telemetry/config`);
};

export const updateTelemetryConfig = async (config: {
  googleSheetId?: string;
  googleSheetName?: string;
  googleSheetWebhookUrl?: string;
  autoSync?: boolean;
}): Promise<{ success: boolean; config: any }> => {
  const apiUrl = (import.meta as any).env.VITE_API_URL || '';
  return requestJson<{ success: boolean; config: any }>(`${apiUrl}/api/ai/telemetry/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
};

export const triggerSheetSync = async (): Promise<{ success: boolean; synced: number; failed: number }> => {
  const apiUrl = (import.meta as any).env.VITE_API_URL || '';
  return requestJson<{ success: boolean; synced: number; failed: number }>(`${apiUrl}/api/ai/telemetry/sync`, {
    method: 'POST'
  });
};

export const submitLogFeedback = async (
  logId: string,
  rating: 'good' | 'bad' | 'neutral',
  feedback?: string
): Promise<{ success: boolean }> => {
  const apiUrl = (import.meta as any).env.VITE_API_URL || '';
  return requestJson<{ success: boolean }>(`${apiUrl}/api/ai/telemetry/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logId, rating, feedback })
  });
};

export const getTelemetryDownloadUrl = (format: 'csv' | 'json' = 'csv'): string => {
  const apiUrl = (import.meta as any).env.VITE_API_URL || '';
  return `${apiUrl}/api/ai/telemetry/download?format=${format}`;
};


