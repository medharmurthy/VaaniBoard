import type { AiPreference } from '../../types';
import { CONFIG } from '../../constants';
import { z } from 'zod';
export const providerRequestSchema = z.object({
  aiPreference:z.enum(['auto','cline','gemini','sarvam','vertex','ollama']).optional(),
  geminiApiKey:z.string().max(1000).optional(),ollamaBaseUrl:z.string().max(2000).optional(),
  selectedGeminiModel:z.string().max(200).optional(),selectedVertexModel:z.string().max(200).optional(),selectedOllamaModel:z.string().max(200).optional(),
});
export interface ProviderInput { aiPreference?: AiPreference; geminiApiKey?: string; ollamaBaseUrl?: string; selectedGeminiModel?: string; selectedVertexModel?: string; selectedOllamaModel?: string }
export function resolveProvider(input: ProviderInput) {
  const explicit = input.aiPreference && input.aiPreference !== 'auto' ? input.aiPreference : process.env.CLINE_PROVIDER || process.env.AI_MODE || 'auto';
  const configured = explicit === 'auto' ? (process.env.CLINE_API_KEY ? 'cline' : input.geminiApiKey || process.env.GEMINI_API_KEY ? 'gemini' : process.env.SARVAM_API_KEY ? 'sarvam' : process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT_ID ? 'vertex' : 'ollama') : explicit;
  if (configured === 'cline') {
    const apiKey = process.env.CLINE_API_KEY;
    if (!apiKey) throw Object.assign(new Error('Set CLINE_API_KEY in the server .env. Never store it in a classroom browser.'), { code: 'missing_key' });
    return { providerId: 'cline', modelId: process.env.CLINE_MODEL || `google/${CONFIG.ai.gemini.model}`, apiKey };
  }
  if (configured === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY || input.geminiApiKey;
    if (!apiKey) throw Object.assign(new Error('Set GEMINI_API_KEY in .env or in Settings.'), { code: 'missing_key' });
    return { providerId: 'gemini', modelId: process.env.GEMINI_MODEL || input.selectedGeminiModel || CONFIG.ai.gemini.model, apiKey };
  }
  if (configured === 'sarvam') {
    if (!process.env.SARVAM_API_KEY) throw Object.assign(new Error('Set SARVAM_API_KEY in the server .env.'), { code: 'missing_key' });
    return { providerId: 'sarvam', modelId: process.env.SARVAM_MODEL || 'sarvam-105b', apiKey: process.env.SARVAM_API_KEY };
  }
  if (configured === 'vertex') {
    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT_ID;
    if (!project) throw Object.assign(new Error('Set your own GOOGLE_CLOUD_PROJECT and application credentials.'), { code: 'missing_key' });
    return { providerId: 'vertex', modelId: process.env.VERTEX_MODEL || input.selectedVertexModel || CONFIG.ai.vertex.model,
      options: { projectId: project, location: process.env.GOOGLE_CLOUD_LOCATION || 'global' } };
  }
  if (configured !== 'ollama') throw new Error('Unsupported provider. Choose Cline credits, Gemini, Sarvam, Vertex, or Ollama.');
  const baseUrl = input.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const url = new URL(baseUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && baseUrl !== process.env.OLLAMA_BASE_URL) throw new Error('Remote Ollama endpoints must be configured by the server administrator.');
  return { providerId: 'ollama', modelId: process.env.OLLAMA_MODEL || input.selectedOllamaModel || CONFIG.ai.ollama.model, baseUrl };
}