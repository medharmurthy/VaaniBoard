import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DomOverlay } from '../components/DomOverlay';
import { useStore } from '../store';

vi.mock('../components/DocumentBlock', () => ({ DocumentBlock: ({ config }: any) => <p>{config.markdown}</p> }));
vi.mock('../components/MermaidTool', () => ({ MermaidTool: () => <div>Diagram</div> }));
vi.mock('../components/MarkmapTool', () => ({ MarkmapTool: () => <div>Map</div> }));
const original = useStore.getState();
afterEach(() => { cleanup(); useStore.setState(original, true); vi.restoreAllMocks(); });
const card = (id: string, x: number, y: number) => ({ id, x, y, width: 340, height: 280, scaleX: 2, scaleY: 2, rotation: 15, zIndex: 12, html: '', componentType: 'DOCUMENT_PAGE', config: { title: id, markdown: `${id} readable lesson` } });

describe('DOM cards share Fabric scaling and reachable overflow', () => {
  it('applies stored scale and rotation under the Fabric viewport matrix without changing state', () => {
    const note = card('note', 300, 300);
    useStore.setState({ domElements: { note }, viewportTransform: [.5, 0, 0, .5, 15, 35] });
    const { container } = render(<main><DomOverlay /></main>);
    const element = container.querySelector('[data-board-card-id="note"]') as HTMLElement;
    expect(element.style.transform).toBe('translate(-50%, -50%) rotate(15deg) scale(2, 2)');
    expect(element.parentElement!.style.transform).toBe('matrix(0.5,0,0,0.5,15,35)');
    expect(element.style.width).toBe('340px'); expect(element.style.zIndex).toBe('12');
    expect(useStore.getState().domElements.note).toEqual(note);
  });
  it('portals the persistent next-card button outside the canvas stacking context, then cycles in focus mode', () => {
    useStore.setState({ domElements: { one: card('one', 500, 400), two: card('two', 500, 1900) }, viewportTransform: [.5, 0, 0, .5, 0, 0] });
    const event = vi.fn(); window.addEventListener('vaani:view-board-card', event);
    const { container } = render(<main><section className="z-0"><DomOverlay /></section></main>);
    try {
      const next = screen.getByRole('button', { name: 'View next lesson card' });
      expect(next.parentElement?.tagName).toBe('MAIN'); expect(next.className).toContain('z-60');
      fireEvent.click(next); expect(event).toHaveBeenCalledTimes(1); expect((event.mock.calls[0][0] as CustomEvent).detail.id).toBe('two');
      act(() => window.dispatchEvent(new CustomEvent('vaani:focus-board-card', { detail: { id: 'two' } })));
      expect(document.getElementById('widget-two-fullscreen')).toHaveTextContent('two readable lesson');
      expect(container.querySelector('[data-board-card-id="two"]')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'View next lesson card' }));
      expect(document.getElementById('widget-one-fullscreen')).toHaveTextContent('one readable lesson');
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(document.querySelector('[id$="-fullscreen"]')).toBeNull();
      expect(Object.keys(useStore.getState().domElements)).toHaveLength(2);
    } finally { window.removeEventListener('vaani:view-board-card', event); }
  });
});