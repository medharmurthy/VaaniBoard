import { describe, it, expect, vi, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { aiRouter } from '../server/aiRouter';
import { resolveProvider } from '../server/cline/providers';
import { classifyClassroomError, classroomRuntimeStatus, recordClassroomHealth } from '../server/cline/runtimeHealth';
import * as clineAdapter from '../server/cline/clineAdapter';
import type { AgentModel } from '@cline/shared';
import { resolveLocalClassroomCommand } from '../server/cline/localClassroomCommands';

let server: Server | undefined;
afterEach(async () => {
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
  vi.restoreAllMocks();
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  server = undefined;
});
function configure() {
  vi.stubEnv('GEMINI_API_KEY', `test-only-${crypto.randomUUID()}`);
  vi.stubEnv('GEMINI_MODEL', 'gemini-3.5-flash-lite'); vi.stubEnv('CLINE_MODEL', '');
  vi.stubEnv('AI_ENGINE', 'cline'); vi.stubEnv('CLINE_PROVIDER', 'gemini');
}
describe('pipeline failures and truthful health', () => {
  it('identifies exhausted prepaid credits without leaking raw provider data', () => {
    const failure = classifyClassroomError(new Error('Your prepayment credits are depleted. private-key-shaped-value'));
    expect(failure.status).toBe(402); expect(failure.code).toBe('billing_required');
    expect(failure.retryable).toBe(false); expect(failure.error).toContain('ai.studio/projects');
    expect(failure.error).not.toContain('private-key-shaped-value');
  });
  it('directs Cline billing failures to Cline, not Google AI Studio',()=>{
    const failure=classifyClassroomError({statusCode:402,message:'Insufficient credits private detail'},'cline');
    expect(failure.code).toBe('billing_required');expect(failure.error).toContain('Cline account');
    expect(failure.error).not.toContain('Google AI Studio');expect(failure.error).not.toContain('private detail');
  });
  it.each([
    [{ statusCode: 403 }, 'invalid_key'], [{ statusCode: 404 }, 'model_not_found'],
    [{ statusCode: 429 }, 'rate_limited'], [new Error('deadline exceeded'), 'request_timeout'],
    [new Error('private unexpected error'), 'provider_error'],
  ])('classifies %j safely as %s', (error, code) => {
    expect(classifyClassroomError(error).code).toBe(code);
    expect(classifyClassroomError(error).error).not.toContain('private unexpected');
  });
  it('does not claim that merely configured credentials can generate', () => {
    configure(); const status = classroomRuntimeStatus({ aiPreference: 'gemini' });
    expect(status.online).toBe(false); expect(status.verified).toBe(false);
    expect(status.reason).toBe('configured_not_probed');
  });
  it('preserves a failure through status polling, clears it after success, and isolates keys', () => {
    configure(); const input = { aiPreference: 'gemini' as const };
    const provider = resolveProvider(input);
    recordClassroomHealth(provider, classifyClassroomError(new Error('prepayment credits are depleted')));
    expect(classroomRuntimeStatus(input).reason).toBe('billing_required');
    expect(classroomRuntimeStatus(input).online).toBe(false);
    recordClassroomHealth(provider); expect(classroomRuntimeStatus(input).online).toBe(true);
    vi.stubEnv('GEMINI_API_KEY', 'another-test-only-key');
    expect(classroomRuntimeStatus(input).reason).toBe('configured_not_probed');
  });
  it('expires observations without performing automatic billable probes', () => {
    configure(); const input = { aiPreference: 'gemini' as const };
    recordClassroomHealth(resolveProvider(input));
    const now = Date.now(); const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 16 * 60_000);
    try { expect(classroomRuntimeStatus(input).reason).toBe('configured_not_probed'); }
    finally { clock.mockRestore(); }
  });
  it('propagates fake-model billing rejection through the SDK and HTTP route, leaving local tools available', async () => {
    configure(); const clientFetch = globalThis.fetch;
    const error = new Error('Your prepayment credits are depleted. private provider details');
    const model: AgentModel = { async *stream() { throw error; } };
    await expect(clineAdapter.generateAgentActionsCline({ prompt: 'Create a water cycle mind map', lang: 'hi' }, model)).rejects.toThrow(/prepayment/);
    const provider = vi.spyOn(clineAdapter, 'generateAgentActionsCline').mockRejectedValue(error);
    const app = express(); app.use('/ai', aiRouter); server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server!.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as any).port}/ai`;
    const response = await clientFetch(base + '/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Create a water cycle mind map', aiPreference: 'gemini' }) });
    expect(response.status).toBe(402);
    const body = await response.json(); expect(body.code).toBe('billing_required');
    expect(JSON.stringify(body)).not.toContain('private provider details');
    const calls = provider.mock.calls.length;
    const local = await clientFetch(base + '/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Hindi mein counting activity banao', lang: 'hi' }) });
    expect(local.status).toBe(200); expect((await local.json()).engine).toBe('local');
    expect(provider).toHaveBeenCalledTimes(calls);
  });
  it('routes Hindi arithmetic अभ्यास to checked maths, not chapter exercises', () => {
    const result = resolveLocalClassroomCommand({ prompt: '20 तक जोड़ का अभ्यास बनाओ', lang: 'hi' });
    expect(result?.functionCalls[0].args.componentType).toBe('QUIZ_APP');
    expect(JSON.parse(result!.functionCalls[0].args.configJson).questions).toHaveLength(10);
  });
  it('bounds local arithmetic requests to the supported range', () => {
    const result = resolveLocalClassroomCommand({ prompt: '100000 tak addition quiz banao', lang: 'hi' });
    const questions = JSON.parse(result!.functionCalls[0].args.configJson).questions;
    expect(questions).toHaveLength(10);
  });
});