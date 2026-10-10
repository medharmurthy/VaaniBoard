import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useAgentProcessor } from '../hooks/useAgentProcessor';
import { useStore } from '../store';
import { BoardHistory } from '../utils/boardHistory';
import { getBoardLayoutContext, rectsOverlap, transformPoint } from '../utils/boardLayout';

vi.mock('../utils/sounds', () => ({ sounds: { play: vi.fn() } }));
vi.mock('../utils/toast', () => ({ toast: { warning: vi.fn() } }));
const storeBefore = useStore.getState();
afterEach(() => { cleanup(); useStore.setState(storeBefore, true); vi.restoreAllMocks(); });

class Rect {
  id!: string;
  constructor(args: any) { Object.assign(this, args); }
}
const payload = { x: 600, y: 350, width: 720, height: 560, componentType: 'DOCUMENT_PAGE', html: '', config: { markdown: 'A deterministic lesson card' } };

describe('layout execution and whole-turn history', () => {
  it('lays out all queued cards together against live objects and undoes/redoes DOM and Fabric atomically', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(.5);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => window.setTimeout(() => callback(performance.now() + 1000), 0));
    const existing = { id: 'teacher-drawing', left: 100, top: 100, width: 200, height: 200, originX: 'center', originY: 'center' };
    let objects: any[] = [existing];
    const canvas = { width: 1280, height: 800, viewportTransform: [.5, 0, 0, .5, 20, 30], add: (object: any) => objects.push(object), getObjects: () => objects, remove: vi.fn(), setActiveObject: vi.fn(), requestRenderAll: vi.fn() };
    window.fabric = { Rect };
    const history = new BoardHistory();
    const snapshot = () => ({ canvas: JSON.stringify(objects), dom: JSON.stringify(useStore.getState().domElements) });
    const begin = vi.fn(() => history.begin(snapshot())); const commit = vi.fn(() => history.commit(snapshot()));
    useStore.setState({ actionQueue: [], domElements: {}, isActing: false, cursorPosition: { x: 300, y: 300 }, beginAiTransaction: begin, commitAiTransaction: commit });
    history.record(snapshot());
    const { unmount } = renderHook(() => useAgentProcessor({ current: canvas }));
    try {
      await act(async () => { useStore.setState({ actionQueue: ['notes', 'diagram', 'activity'].map(id => ({ id, type: 'RENDER_HTML', status: 'PENDING', payload })) }); });
      await waitFor(() => expect(commit).toHaveBeenCalledTimes(1), { timeout: 6000 });
      expect(begin).toHaveBeenCalledTimes(1); expect(objects).toHaveLength(4);
      const dom = Object.values(useStore.getState().domElements); expect(dom).toHaveLength(3);
      expect(objects[0]).toBe(existing); expect(existing.left).toBe(100); expect(existing.top).toBe(100);
      const context = getBoardLayoutContext(canvas, {});
      for (let index = 1; index < context.occupied.length; index++) {
        expect(context.occupied.slice(index + 1).some(rect => rectsOverlap(context.occupied[index], rect, 15.9))).toBe(false);
        expect(rectsOverlap(context.occupied[index], context.occupied[0], 15.9)).toBe(false);
      }
      for (const element of dom) {
        const placeholder = objects.find(object => object.id === element.id);
        expect(placeholder).toMatchObject({ left: element.x, top: element.y, width: element.width, height: element.height, scaleX: element.scaleX, scaleY: element.scaleY });
        expect(element.scaleX).toBe(2);
      }
      expect(canvas.viewportTransform).toEqual([.5, 0, 0, .5, 20, 30]);
      const undo = history.undo()!; expect(JSON.parse(undo.canvas)).toEqual([existing]); expect(JSON.parse(undo.dom)).toEqual({});
      const redo = history.redo()!; expect(JSON.parse(redo.canvas)).toHaveLength(4); expect(Object.keys(JSON.parse(redo.dom))).toHaveLength(3);
      // Second turn recomputes occupancy, instead of using stale first-turn slots.
      objects = JSON.parse(redo.canvas);
      await act(async () => { useStore.getState().addAction({ id: 'later', type: 'RENDER_HTML', status: 'PENDING', payload }); });
      await waitFor(() => expect(commit).toHaveBeenCalledTimes(2), { timeout: 3000 });
      const all = getBoardLayoutContext(canvas, {}).occupied;
      expect(all.slice(0, -1).some(rect => rectsOverlap(all.at(-1)!, rect, 15.9))).toBe(false);
    } finally { unmount(); }
  }, 10000);
  it('one-click navigation moves the viewport only and keeps exact zoom and user positions', async () => {
    const element = { id: 'overflow', x: 200, y: 1200, width: 300, height: 240, scaleX: 2, scaleY: 2, rotation: 0, zIndex: 10, html: '' };
    const canvas = { width: 390, height: 700, viewportTransform: [.5, 0, 0, .5, 0, 0], getObjects: () => [], getZoom: () => .5, requestRenderAll: vi.fn(), setViewportTransform: vi.fn((matrix: number[]) => { canvas.viewportTransform = matrix; }) };
    useStore.setState({ actionQueue: [], isActing: false, domElements: { overflow: element } });
    renderHook(() => useAgentProcessor({ current: canvas }));
    await act(async () => window.dispatchEvent(new CustomEvent('vaani:view-board-card', { detail: { id: element.id } })));
    expect(canvas.setViewportTransform).toHaveBeenCalledTimes(1);
    expect(canvas.viewportTransform.slice(0, 4)).toEqual([.5, 0, 0, .5]);
    const center = transformPoint({ x: element.x, y: element.y }, canvas.viewportTransform);
    expect(center.x).toBe(195); expect(center.y).toBe(136);
    expect(useStore.getState().zoom).toBe(.5); expect(useStore.getState().domElements.overflow).toEqual(element);
  });
});