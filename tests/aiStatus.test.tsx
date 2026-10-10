import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAiStatus } from '../hooks/useAiStatus';
import { generateAgentActions } from '../services/aiService';
import { useStore } from '../store';

afterEach(() => { vi.unstubAllGlobals(); });
describe('client generation health', () => {
  it('refreshes status immediately on generation failure rather than waiting for polling', async () => {
    let failed = false;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/generate')) { failed = true; return Response.json({ error: 'Add Gemini credits.', code: 'billing_required', retryable: false }, { status: 402 }); }
      return Response.json({ mode: 'gemini', model: 'gemini-3.5-flash-lite', online: false, verified: failed, reason: failed ? 'billing_required' : 'configured_not_probed' });
    }));
    useStore.setState({ aiPreference: 'gemini' });
    const { result, unmount } = renderHook(() => useAiStatus());
    try {
      await waitFor(() => expect(result.current.reason).toBe('configured_not_probed'));
      await act(async () => { await expect(generateAgentActions('Make a lesson', '', [], { width: 1000, height: 700 })).rejects.toMatchObject({ code: 'billing_required', retryable: false }); });
      await waitFor(() => expect(result.current.reason).toBe('billing_required'));
      expect(result.current.online).toBe(false);
    } finally { unmount(); }
  });
  it('does not replace a newer health observation with a stale response', async () => {
    let resolveFirst!: (response: Response) => void;
    let count = 0;
    vi.stubGlobal('fetch', vi.fn(() => ++count === 1 ? new Promise<Response>(resolve => { resolveFirst = resolve; }) : Promise.resolve(Response.json({ mode: 'gemini', online: false, reason: 'billing_required' }))));
    const { result, unmount } = renderHook(() => useAiStatus());
    try {
      act(() => { window.dispatchEvent(new Event('vaani:ai-health-changed')); });
      await waitFor(() => expect(result.current.reason).toBe('billing_required'));
      await act(async () => { resolveFirst(Response.json({ mode: 'gemini', online: true, reason: 'configured_not_probed' })); });
      expect(result.current.reason).toBe('billing_required');
    } finally { unmount(); }
  });
});