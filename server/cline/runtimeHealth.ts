import { createHash } from 'node:crypto';
import { resolveProvider, type ProviderInput } from './providers';

type Provider = ReturnType<typeof resolveProvider>;
export interface ClassroomFailure { status: number; code: string; error: string; retryable: boolean }

/** Only allowlisted explanations leave the server, never raw provider errors or keys. */
export function classifyClassroomError(error: any, providerId = 'gemini'): ClassroomFailure {
  const message = [error?.message, error?.cause?.message, error?.responseBody].filter(Boolean).join(' ').toLowerCase();
  const status = Number(error?.statusCode || error?.status || error?.cause?.statusCode);
  if (error?.code === 'missing_key') return { status: 503, code: 'missing_key', error: 'The selected AI provider needs server credentials. Local activities still work.', retryable: false };
  if (status === 402 || /prepay|credits.*depleted|insufficient.*(?:balance|credit)|billing|payment required/.test(message)) {
    if (providerId === 'cline') return { status: 402, code: 'billing_required', error: 'Cline generation is blocked by account credits or billing. Check the credited Cline account balance and API-key access, then retry. Local classroom tools and Sarvam speech still work.', retryable: false };
    return { status: 402, code: 'billing_required', error: 'Gemini generation is blocked: the API project has no prepaid credits or requires billing. Add credits in Google AI Studio (ai.studio/projects), then retry. Local exercises, counting, letter games and Sarvam speech still work.', retryable: false };
  }
  if (status === 401 || status === 403 || /api key not valid|invalid api.?key|unauthenticated|permission.denied/.test(message)) return { status: 403, code: 'invalid_key', error: 'The AI provider rejected the credentials or permissions. Check the server API key and project access.', retryable: false };
  if (status === 404 || /model.*not found|not_found|not supported.*generate/.test(message)) return { status: 404, code: 'model_not_found', error: 'The selected model is unavailable to this API project. Check its model configuration.', retryable: false };
  if (status === 429 || /quota|resource.exhausted|rate.limit/.test(message)) return { status: 429, code: 'rate_limited', error: 'AI generation quota or rate limit reached. Check project quota and retry later. Local activities still work.', retryable: false };
  if (/cancel|abort|deadline/.test(message)) return { status: 504, code: 'request_timeout', error: 'The classroom request was cancelled or timed out. Try a shorter command.', retryable: false };
  return { status: 502, code: 'provider_error', error: 'The AI provider could not complete this request. Check credentials, model and quota. Local exercises and FLN activities still work.', retryable: false };
}

const health = new Map<string, { checkedAt: number; failure?: ClassroomFailure }>();
function key(provider: Provider) {
  // Never store or return credentials in diagnostic state.
  return createHash('sha256').update(JSON.stringify(provider)).digest('hex');
}
export function recordClassroomHealth(provider: Provider, failure?: ClassroomFailure) {
  if (health.size >= 100) health.delete(health.keys().next().value!);
  health.set(key(provider), { checkedAt: Date.now(), failure });
}
export function classroomRuntimeStatus(input: ProviderInput) {
  try {
    const provider = resolveProvider(input);
    const observation = health.get(key(provider));
    const recent = observation && Date.now() - observation.checkedAt < 15 * 60_000 ? observation : undefined;
    return { mode: provider.providerId, model: provider.modelId, online: !!recent && !recent.failure,
      verified: !!recent, reason: recent ? recent.failure?.code || 'generation_succeeded' : 'configured_not_probed',
      message: recent?.failure?.error, lastGenerationAt: recent?.checkedAt,
      engine: 'cline', localToolsAvailable: true };
  } catch (error) {
    const failure = classifyClassroomError(error, input.aiPreference || process.env.CLINE_PROVIDER);
    return { mode: 'unavailable', model: '', online: false, verified: false, reason: failure.code,
      message: failure.error, engine: 'cline', localToolsAvailable: true };
  }
}