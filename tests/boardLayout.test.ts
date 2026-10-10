import { describe, expect, it, vi } from 'vitest';
import { getBoardLayoutContext, getCardPanTransform, getCardViewTarget, layoutBoardCards, layoutCardActions, rectsOverlap, screenDeltaToWorld, transformPoint, type BoardLayoutContext, type CardPlacement } from '../utils/boardLayout';
import type { AgentAction } from '../types';

const context = (width = 1280, height = 800): BoardLayoutContext => ({ width, height, transform: [1, 0, 0, 1, 0, 0], occupied: [] });
const cards = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `card-${index}`, width: 720, height: 560 }));
function screenRect(card: CardPlacement, viewport: BoardLayoutContext) {
  const center = transformPoint(card, viewport.transform);
  const width = card.width * card.scaleX * Math.hypot(viewport.transform[0], viewport.transform[1]);
  const height = card.height * card.scaleY * Math.hypot(viewport.transform[2], viewport.transform[3]);
  return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}
function expectSafe(placements: CardPlacement[], viewport: BoardLayoutContext) {
  const rectangles = placements.map(card => screenRect(card, viewport));
  rectangles.forEach((rect, index) => {
    expect(rect.width).toBeGreaterThanOrEqual(Math.min(viewport.width - 32, 280));
    expect(rect.height).toBeGreaterThanOrEqual(220);
    expect(rectangles.slice(index + 1).some(other => rectsOverlap(rect, other, 15.9))).toBe(false);
    expect(viewport.occupied.some(other => rectsOverlap(rect, other, 15.9))).toBe(false);
    if (!placements[index].overflow) {
      expect(rect.x).toBeGreaterThanOrEqual(15.99); expect(rect.y).toBeGreaterThanOrEqual(15.99);
      expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width - 15.99);
      expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height - 15.99);
    }
  });
}

describe('viewport-aware new-turn card layout', () => {
  it('keeps science illustrations tall enough for complete labelled anatomy on phones', () => {
    const viewport = { ...context(372, 770), occupied: [{ x: 0, y: 0, width: 372, height: 80 }, { x: 0, y: 610, width: 372, height: 160 }] };
    const result = layoutCardActions(['DOCUMENT_PAGE', 'MERMAID_DIAGRAM', 'LABELLED_DIAGRAM'].map((componentType, index) => ({ id: `visual-${index}`, type: 'RENDER_HTML', status: 'PENDING', payload: { width: 660, height: 660, componentType } })), viewport);
    expect(result[0].payload.boardOverflow).toBe(false);
    expect(result.every(action => action.payload.height >= 420)).toBe(true);
    expect(result.filter(action => !action.payload.boardOverflow)).toHaveLength(1);
  });
  it('fits three oversized desktop cards in coherent readable columns instead of shared grid anchors', () => {
    const viewport = context(); const result = layoutBoardCards(cards(3), viewport);
    expect(result.every(card => !card.overflow)).toBe(true);
    expect(new Set(result.map(card => card.y)).size).toBeLessThanOrEqual(2);
    expect(new Set(result.map(card => card.x)).size).toBeGreaterThanOrEqual(2);
    expectSafe(result, viewport);
  });
  it('fits six desktop cards in rows and remains deterministic', () => {
    const viewport = context(); const result = layoutBoardCards(cards(6), viewport);
    expect(result.every(card => !card.overflow)).toBe(true);
    expect(new Set(result.map(card => card.y)).size).toBe(2);
    expect(layoutBoardCards(cards(6), viewport)).toEqual(result); expectSafe(result, viewport);
  });
  it.each([.25, .8, 1.75, 4])('honours pan and zoom %s without tiny intrinsic content or changing the camera', zoom => {
    const viewport = { ...context(), transform: [zoom, 0, 0, zoom, -310, 145] };
    const matrix = [...viewport.transform]; const result = layoutBoardCards(cards(3), viewport);
    expect(result.every(card => !card.overflow)).toBe(true);
    expect(result[0].width).toBeGreaterThan(280); expect(result[0].scaleX).toBe(1 / zoom);
    expect(viewport.transform).toEqual(matrix); expectSafe(result, viewport);
  });
  it('accounts for real Fabric bounds plus DOM-only scaled and rotated widgets, leaving originals untouched', () => {
    const getBounds = vi.fn(() => ({ left: 10, top: 20, width: 200, height: 100 }));
    const objects = [{ id: 'drawing', getBoundingRect: getBounds, left: 10, top: 20 }, { visible: false, left: 0, top: 0, width: 1000, height: 1000 }];
    const dom = { note: { id: 'note', x: 400, y: 250, width: 100, height: 200, scaleX: 2, scaleY: 1, rotation: 90, html: '', zIndex: 10 } };
    const before = JSON.stringify(dom); const viewport = getBoardLayoutContext({ width: 1280, height: 800, viewportTransform: [2, 0, 0, 2, -40, 30], getObjects: () => objects }, dom);
    expect(getBounds).toHaveBeenCalledWith(true, true); expect(viewport.occupied).toHaveLength(2);
    expect(viewport.occupied[0]).toEqual({ x: -20, y: 70, width: 400, height: 200 });
    expect(viewport.occupied[1].width).toBeCloseTo(400); expect(viewport.occupied[1].height).toBeCloseTo(400);
    const result = layoutBoardCards(cards(2), viewport); expectSafe(result, viewport); expect(JSON.stringify(dom)).toBe(before);
  });
  it('uses maximal empty areas below controls and beside existing drawings', () => {
    const viewport = { ...context(), occupied: [{ x: 0, y: 0, width: 1280, height: 125 }, { x: 0, y: 730, width: 1280, height: 70 }, { x: 0, y: 125, width: 85, height: 550 }] };
    const result = layoutBoardCards(cards(3), viewport);
    expect(result.every(card => !card.overflow)).toBe(true); expectSafe(result, viewport);
  });
  it('fits beside a large existing drawing while preserving world-space positions at zoom and pan', () => {
    const existing = { left: 700, top: 500, width: 1200, height: 1600, originX: 'center', originY: 'center', scaleX: 1, scaleY: 1 };
    const canvas = { width: 1280, height: 800, viewportTransform: [.5, 0, 0, .5, -30, 80], getObjects: () => [existing] };
    const original = JSON.stringify(existing); const matrix = [...canvas.viewportTransform];
    const viewport = getBoardLayoutContext(canvas, {}); const result = layoutBoardCards(cards(2), viewport);
    expect(result.every(card => !card.overflow)).toBe(true); expectSafe(result, viewport);
    expect(result[0].width).toBeLessThan(720); expect(JSON.stringify(existing)).toBe(original); expect(canvas.viewportTransform).toEqual(matrix);
  });
  it('stacks phone cards vertically, overflowing only below and never below readable height', () => {
    const viewport = context(390, 700); const result = layoutBoardCards(cards(4), viewport);
    expect(result.filter(card => !card.overflow)).toHaveLength(2);
    expect(new Set(result.map(card => card.x)).size).toBe(1);
    expect(result[2].y).toBeGreaterThan(viewport.height); expectSafe(result, viewport);
  });
  it('leaves at least one readable phone card above a horizontal mobile toolbar and voice controls', () => {
    const viewport = { ...context(372, 770), occupied: [
      { x: 12, y: 12, width: 348, height: 64 },
      { x: 37, y: 594, width: 298, height: 64 },
      { x: 0, y: 690, width: 372, height: 64 },
    ] };
    const result = layoutBoardCards(cards(3), viewport);
    expect(result.filter(card => !card.overflow).length).toBeGreaterThanOrEqual(1); expectSafe(result, viewport);
    expect(result[0].height).toBeGreaterThanOrEqual(220);
  });
  it('uses readable overflow for a short landscape phone or a completely occupied viewport', () => {
    for (const viewport of [context(700, 180), { ...context(390, 700), occupied: [{ x: 0, y: 0, width: 390, height: 700 }, { x: 0, y: 716, width: 390, height: 400 }] }]) {
      const result = layoutBoardCards(cards(3), viewport);
      expect(result.every(card => card.overflow)).toBe(true); expectSafe(result, viewport);
    }
  });
  it('measures only marked UI controls in local canvas coordinates', () => {
    const control = document.createElement('div'); control.dataset.boardOccluder = 'true'; document.body.append(control);
    control.getBoundingClientRect = () => ({ left: 900, top: 150, width: 200, height: 100 } as DOMRect);
    try {
      const viewport = getBoardLayoutContext({ width: 1000, height: 700, getObjects: () => [], lowerCanvasEl: { getBoundingClientRect: () => ({ left: 100, top: 100, width: 1000, height: 700 }) } }, {});
      expect(viewport.controls).toEqual([{ x: 800, y: 50, width: 200, height: 100 }]);
    } finally { control.remove(); }
  });
  it('only adjusts new card actions; existing edits/moves and input payloads are preserved', () => {
    const actions: AgentAction[] = [
      { id: 'note', type: 'RENDER_HTML', status: 'PENDING', payload: { x: 1000, y: 1000, width: 720, height: 560, config: { title: 'Notes' } } },
      { id: 'edit', type: 'EDIT_HTML', status: 'PENDING', payload: { objectId: 'old', config: { title: 'Updated' } } },
      { id: 'move', type: 'DRAG_OBJECT', status: 'PENDING', payload: { objectId: 'old', toX: 44, toY: 55 } },
    ];
    const before = JSON.stringify(actions); const result = layoutCardActions(actions, context());
    expect(result[0].payload.x).not.toBe(1000); expect(result[0].payload.config).toBe(actions[0].payload.config);
    expect(result[1]).toBe(actions[1]); expect(result[2]).toBe(actions[2]); expect(JSON.stringify(actions)).toBe(before);
  });
  it('one-click card navigation changes translation only and picks space away from UI', () => {
    const matrix = [.75, 0, 0, .75, -100, 70]; const center = { x: 250, y: 1200 };
    const viewport = { ...context(390, 700), controls: [{ x: 0, y: 0, width: 390, height: 120 }, { x: 0, y: 600, width: 390, height: 100 }] };
    const target = getCardViewTarget(300, 300, viewport);
    const result = getCardPanTransform(center, matrix, target);
    expect(result.slice(0, 4)).toEqual(matrix.slice(0, 4)); expect(transformPoint(center, result)).toEqual(target);
    expect(target.y).toBeGreaterThan(136); expect(target.y).toBeLessThan(584);
    expect(matrix).toEqual([.75, 0, 0, .75, -100, 70]);
    expect(screenDeltaToWorld({ x: 150, y: 75 }, matrix)).toEqual({ x: 200, y: 100 });
  });
});