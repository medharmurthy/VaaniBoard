import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import { isWhisperAvailable, transcribeAudioWhisper } from '../server/whisperAdapter';
const { execFile } = vi.hoisted(() => ({ execFile: vi.fn() }));
vi.mock('child_process', () => ({ execFile, default: { execFile } }));

beforeEach(() => {
  execFile.mockReset();
  vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
  vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
const subprocessResult = (error: Error | null, stdout = '') => execFile.mockImplementation((_file, _args, _options, callback) => callback(error, { stdout, stderr: '' }));

describe('legacy Whisper adapter boundaries (mocked subprocess, never a model)', () => {
  it('reports availability from a successful mocked package check', async () => {
    subprocessResult(null, 'ok\n');
    expect(await isWhisperAvailable()).toBe(true);
    expect(execFile.mock.calls[0][1]).toEqual(['-c', 'import faster_whisper; print("ok")']);
  });
  it('reports an unavailable package or subprocess timeout without depending on the host', async () => {
    subprocessResult(new Error('Mocked Python timeout'));
    expect(await isWhisperAvailable()).toBe(false);
  });

  it('handles empty audio gracefully without crashing', async () => {
    const text = await transcribeAudioWhisper('');
    expect(text).toBe('');
    expect(execFile).not.toHaveBeenCalled();
  });

  it('handles invalid base64 audio gracefully', async () => {
    subprocessResult(new Error('Mocked audio decode failure'));
    const text = await transcribeAudioWhisper('invalid_base64_audio_sample', 'auto', 'tiny');
    expect(text).toBe('');
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
  });
  it('parses a mocked transcription and cleans temporary audio', async () => {
    subprocessResult(null, JSON.stringify({ success: true, text: 'Legacy adapter result', language: 'en' }));
    expect(await transcribeAudioWhisper('YXVkaW8=', 'en', 'tiny')).toBe('Legacy adapter result');
    expect(execFile.mock.calls[0][1]).toEqual(expect.arrayContaining(['--language', 'en', '--model', 'tiny']));
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
  });
});
