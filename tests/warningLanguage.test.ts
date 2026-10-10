import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSpeechLanguage, localizeWarning, warningText } from '../utils/warningLanguage';
import { useStore } from '../store';
import { toast } from '../utils/toast';

afterEach(() => { useStore.setState({ language: 'hi', warningLanguage: 'hi' }); });
describe('audio-driven warning language', () => {
  it.each([['hi-IN', 'बोर्ड बनाओ', 'hi'], ['ta-IN', 'வரைபடம்', 'ta'], ['en-IN', 'draw a chart', 'en']])('uses supported single-language metadata %s', (language, text, expected) => {
    expect(resolveSpeechLanguage({ language, text }).warningLanguage).toBe(expected);
  });
  it('uses English for multiple detected languages including code-mixed script evidence', () => {
    expect(resolveSpeechLanguage({ language: 'hi-IN', text: 'बोर्ड पर quiz बनाओ' }).warningLanguage).toBe('en');
    expect(resolveSpeechLanguage({ language: 'hi-IN', detectedLanguages: ['hi-IN', 'ta-IN'], text: 'बोर्ड' }).warningLanguage).toBe('en');
    expect(resolveSpeechLanguage({ language: 'hi-IN', text: 'बोर्ड வரைபடம்' }).warningLanguage).toBe('en');
  });
  it('uses English for missing/unsupported metadata and does not misclassify Marathi script', () => {
    expect(resolveSpeechLanguage({ text: 'बोर्ड' }).warningLanguage).toBe('en');
    expect(resolveSpeechLanguage({ language: 'id-ID', text: 'hello' }).warningLanguage).toBe('en');
    expect(resolveSpeechLanguage({ language: 'mr-IN', text: 'फळा' }).warningLanguage).toBe('mr');
  });
  it('does not claim exhaustive detection of Roman Hinglish', () => {
    const result = resolveSpeechLanguage({ language: 'hi-IN', text: 'board pe likho' });
    expect(result.languageDetection).toBe('provider+script-heuristic');
    expect(result.warningLanguage).toBe('hi');
  });
  it('localises warning toasts while retaining technical details and leaves success text alone', () => {
    useStore.setState({ warningLanguage: 'ta' });
    const cb = vi.fn(); const unsubscribe = toast.subscribe(cb);
    toast.warning('Sarvam speech unavailable.');
    expect(cb.mock.calls[0][0].message).toContain(warningText('speechUnavailable', 'ta'));
    expect(cb.mock.calls[0][0].message).toContain('Sarvam speech unavailable.');
    toast.success('Saved.'); expect(cb.mock.calls[1][0].message).toBe('Saved.');
    unsubscribe();
  });
  it('uses selected UI language after an explicit language change without changing board language', () => {
    useStore.setState({ warningLanguage: 'ta', boardLanguage: 'hi' });
    useStore.getState().setLanguage('bn');
    expect(useStore.getState().warningLanguage).toBe('bn');
    expect(useStore.getState().boardLanguage).toBe('hi');
    expect(localizeWarning('Unfamiliar technical failure.', 'bn')).toContain('Unfamiliar technical failure.');
  });
});