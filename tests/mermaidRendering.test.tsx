import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MermaidTool, markdownToMermaidMindmap, DEFAULT_MINDMAP } from '../components/MermaidTool';
import { normalizeMermaidCode, validateMermaidCode } from '../utils/mermaidCode';
import { useStore } from '../store';
import { queueBoardCall, type ClassroomContext } from '../server/cline/classroomTools';

let vendorDom: JSDOM;
let mermaid: any;
const formulaChart = 'flowchart TD\n  A[Apply: x = (-b ± √Δ) / 2a] --> B';

beforeAll(() => {
  // Exercise exactly the self-contained build served by the app, with no CDN,
  // dynamic import or fetch. VM evaluation preserves its browser-global vars.
  vendorDom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
  runInContext(readFileSync(resolve(process.cwd(), 'public/vendor/mermaid.min.js'), 'utf8'), vendorDom.getInternalVMContext());
  mermaid = (vendorDom.window as any).mermaid;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true });
  // jsdom has no text/layout metrics. Stub only SVG measurement, not Mermaid
  // parsing or rendering, so the resulting SVG is still the real engine output.
  (vendorDom.window.SVGElement.prototype as any).getBBox = () => ({ x: 0, y: 0, width: 100, height: 30 });
  (vendorDom.window.SVGElement.prototype as any).getComputedTextLength = () => 100;
});

beforeEach(() => {
  useStore.setState({ boardLanguage: 'en', warningLanguage: 'en' });
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request in rendering regression'); }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (window as any).mermaid; });
afterAll(() => vendorDom.window.close());

describe('vendored Mermaid parse and bounded repair', () => {
  it('reproduces the unquoted formula failure then repairs it without losing Unicode', async () => {
    await expect(mermaid.parse(formulaChart)).rejects.toBeTruthy();
    const result = await validateMermaidCode(formulaChart, mermaid);
    expect(result).toEqual({ code: 'flowchart TD\n  A["Apply: x = (-b ± √Δ) / 2a"] --> B', repaired: true, attempts: 2 });
    await expect(mermaid.parse(result.code)).resolves.toBeTruthy();
  });

  it.each([
    'flowchart LR\n A([Start]) --> B[[Process]] --> C[(Data)] --> D((Finish))',
    'flowchart TD\n A[/Input/] --> B[\\Output\\] --> C{{Decision}}',
    'flowchart TD\n A["f(x) = (a + b) / 2"] -->|"Yes (true)"| B["`**Bold** result`"]:::answer\n classDef answer fill:#fff,stroke:#333\n style A fill:#eef\n %% A[do not change (comment)]',
    'flowchart TD\n A@{ shape: rect, label: "f(x) = a" } --> B@{ shape: diamond, label: "x > 0?" }',
    'flowchart TD\n subgraph s[Lesson group]\n A[Line<br/>break] --> B[उत्तर]\n end',
    'sequenceDiagram\n participant A as Alice (teacher)\n A->>B: Apply f(x)',
    DEFAULT_MINDMAP,
  ])('preserves valid syntax byte-for-byte: %s', async code => {
    expect(normalizeMermaidCode(code)).toBe(code);
    expect(await validateMermaidCode(code, mermaid)).toEqual({ code, repaired: false, attempts: 1 });
  });

  it.each([
    'flowchart TD\n A[गणना: x = (-b ± √Δ) / 2a] --> B{Is f(x) > 0?}',
    'flowchart TD\n A([f(x)]) --> B[[g(x)]] --> C[(h(x))]',
    'flowchart TD\n A((f(x))) --> B{{g(x)}}',
    'flowchart TD\n A[/f(x)/] --> B[\\g(x)\\]',
    'flowchart TD\n A[/f(x)\\] --> B[\\g(x)/]',
    'flowchart TD\n A[Use "quoted" words (सही)] --> B[Expected E[X] (value)]',
    'flowchart TD\n A-->B[f(x)]-.->C[g(x)]==>D{h(x)?}',
    'flowchart TD\n A-start-->B-end[f(x)]',
  ])('quotes unsafe labels across shapes and keeps parsing: %s', async code => {
    const normalized = normalizeMermaidCode(code);
    expect(normalized).toContain('"');
    expect(normalizeMermaidCode(normalized)).toBe(normalized);
    await expect(mermaid.parse(normalized)).resolves.toBeTruthy();
  });

  it('strips a Mermaid fence and decodes serialized line separators', async () => {
    const fenced = '```mermaid\n' + formulaChart + '\n```';
    await expect(validateMermaidCode(fenced, mermaid)).resolves.toMatchObject({ repaired: true, attempts: 2 });
    expect(normalizeMermaidCode(String.raw`flowchart TD\n A[Start] --> B`)).toBe('flowchart TD\n A[Start] --> B');
  });

  it('does not rewrite node-like text inside edge labels', () => {
    const code = 'flowchart TD\n A -->|Compute A[f(x)]| B[Result]';
    expect(normalizeMermaidCode(code)).toBe(code);
  });

  it('does not loop or ask a model when the chart cannot be repaired', async () => {
    const parse = vi.fn((code: string) => mermaid.parse(code));
    await expect(validateMermaidCode('flowchart TD\n A[f(x)] --> B[', { parse })).rejects.toThrow(/Open the editor/);
    expect(parse).toHaveBeenCalledTimes(2);
    const unchanged = vi.fn((code: string) => mermaid.parse(code));
    await expect(validateMermaidCode('not a Mermaid diagram', { parse: unchanged })).rejects.toThrow(/could not be parsed/);
    expect(unchanged).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves punctuation and Indic labels in Markdown concept maps', async () => {
    const code = markdownToMermaidMindmap('# शीर्षक (मूल) [महत्वपूर्ण]\n## शाखा "एक" {कुंजी}\n- x = (-b ± √Δ) / 2a');
    expect(code).toContain('शीर्षक (मूल) [महत्वपूर्ण]');
    expect(code).toContain('शाखा #quot;एक#quot; {कुंजी}');
    expect(code).toContain('x = (-b ± √Δ) / 2a');
    await expect(mermaid.parse(code)).resolves.toBeTruthy();
  });

  it('normalizes direct, added and updated classroom Mermaid actions on the server', async () => {
    const context = (): ClassroomContext => ({ req: { prompt: 'Quadratic formula flowchart', lang: 'en', domElements: {
      chart: { id: 'chart', componentType: 'MERMAID_DIAGRAM', config: { title: 'Quadratic', code: 'flowchart TD\n A-->B' } },
    } }, calls: [], citations: [], proposals: [], grounded: false, requiresGrounding: false, proposalOnly: false });
    const direct = context();
    queueBoardCall(direct, 'render_mermaid', { code: formulaChart, gridPosition: 'CENTER' });
    expect(direct.calls[0].args.code).toBe(normalizeMermaidCode(formulaChart));
    for (const name of ['add_component', 'update_component']) {
      const ctx = context();
      const configJson = JSON.stringify({ code: formulaChart });
      queueBoardCall(ctx, name, name === 'add_component'
        ? { componentType: 'MERMAID_DIAGRAM', gridPosition: 'CENTER', configJson }
        : { objectId: 'chart', action: 'UPDATE_CONFIG', configJson });
      const code = JSON.parse(ctx.calls[0].args.configJson).code;
      expect(code).toBe(normalizeMermaidCode(formulaChart));
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('Mermaid board DOM', () => {
  it('renders the repaired source through real Mermaid and exposes corrected copy code', async () => {
    (window as any).mermaid = mermaid;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { container } = render(<MermaidTool config={{ title: 'Quadratic steps', code: formulaChart }} />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Quadratic steps' }).querySelector('svg')).not.toBeNull());
    expect(container.querySelector('svg[id^="mermaid_"]')?.textContent).toContain('Apply: x = (-b ± √Δ) / 2a');
    expect(screen.getByRole('status')).toHaveTextContent('repaired locally');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy Mermaid code' })); });
    expect(writeText).toHaveBeenCalledWith(normalizeMermaidCode(formulaChart));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows an actionable source/editor fallback and never a substitute chart', async () => {
    (window as any).mermaid = mermaid;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<MermaidTool config={{ title: 'Invalid chart', code: 'flowchart TD\n A[f(x)] --> B[' }} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('check brackets and arrows');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download SVG' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Open editor' }));
    expect(screen.getByRole('textbox', { name: 'Edit Mermaid code' })).toHaveValue('flowchart TD\n A[f(x)] --> B[');
    expect(fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it('reports missing source without loading a remote renderer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<MermaidTool config={{}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No chart content was provided');
    expect(document.querySelector('script[src*="cdn"]')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows local loader failures, retries locally and localizes warning controls', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    useStore.setState({ warningLanguage: 'hi' });
    render(<MermaidTool config={{ code: 'flowchart TD\n A-->B' }} />);
    const script = await waitFor(() => {
      const element = document.querySelector('script[src="/vendor/mermaid.min.js"]');
      expect(element).not.toBeNull();
      return element!;
    });
    fireEvent.error(script);
    expect(await screen.findByRole('alert')).toHaveTextContent('The local Mermaid renderer could not load');
    expect(screen.getByRole('button', { name: 'संपादक खोलें' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'फिर कोशिश करें' }));
    const retry = await waitFor(() => {
      const element = document.querySelector('script[src="/vendor/mermaid.min.js"]');
      expect(element).not.toBeNull();
      return element!;
    });
    fireEvent.error(retry);
    await screen.findByRole('alert');
    expect(document.querySelector('script[src*="cdn"]')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});