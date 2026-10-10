import type { AgentAction, DomElementState, Point } from '../types';

/** Layout is calculated in board-local screen pixels, then converted to world space. */
export interface LayoutRect { x: number; y: number; width: number; height: number }
export interface CardSize { id: string; width: number; height: number; minHeight?: number }
export interface CardPlacement extends CardSize { x: number; y: number; scaleX: number; scaleY: number; overflow: boolean }
export interface BoardLayoutContext {
  width: number;
  height: number;
  transform: number[];
  occupied: LayoutRect[];
  controls?: LayoutRect[];
}

const finite = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const positive = (value: unknown, fallback: number): number => Math.max(1, finite(value, fallback));
export const transformPoint = (point: Point, matrix: number[]): Point => ({
  x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
  y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
});
export const screenDeltaToWorld = (point: Point, matrix: number[]): Point => {
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  if (Math.abs(determinant) < 1e-8) return point;
  return { x: (matrix[3] * point.x - matrix[2] * point.y) / determinant, y: (-matrix[1] * point.x + matrix[0] * point.y) / determinant };
};
const screenToWorld = (point: Point, matrix: number[]) => screenDeltaToWorld({ x: point.x - matrix[4], y: point.y - matrix[5] }, matrix);
/** Explicit navigation changes only translation, never zoom or object coordinates. */
export function getCardPanTransform(center: Point, matrix: number[], screenTarget: Point): number[] {
  const current = transformPoint(center, matrix);
  return [matrix[0], matrix[1], matrix[2], matrix[3], matrix[4] + screenTarget.x - current.x, matrix[5] + screenTarget.y - current.y];
}
const boundsOf = (points: Point[]): LayoutRect => {
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
};
const transformRect = (rect: LayoutRect, matrix: number[]) => boundsOf([
  { x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y },
  { x: rect.x, y: rect.y + rect.height }, { x: rect.x + rect.width, y: rect.y + rect.height },
].map(point => transformPoint(point, matrix)));
export const rectsOverlap = (a: LayoutRect, b: LayoutRect, gap = 0): boolean =>
  a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

/** Bounded maximal empty regions, not just full-viewport grids. This lets phone
 * cards use the space to the right of a toolbar or below a classroom panel. */
function freeRegions(viewport: LayoutRect, obstacles: LayoutRect[], gap: number): LayoutRect[] {
  let regions = [viewport];
  for (const obstacle of obstacles) {
    const blocked = { x: obstacle.x - gap, y: obstacle.y - gap, width: obstacle.width + gap * 2, height: obstacle.height + gap * 2 };
    regions = regions.flatMap(region => {
      if (!rectsOverlap(region, blocked)) return [region];
      const right = region.x + region.width, bottom = region.y + region.height;
      return [
        { ...region, width: blocked.x - region.x },
        { ...region, x: blocked.x + blocked.width, width: right - blocked.x - blocked.width },
        { ...region, height: blocked.y - region.y },
        { ...region, y: blocked.y + blocked.height, height: bottom - blocked.y - blocked.height },
      ].filter(rect => rect.width > 0 && rect.height > 0);
    });
    regions = regions.filter((rect, index) => !regions.some((other, otherIndex) => otherIndex !== index &&
      other.x <= rect.x && other.y <= rect.y && other.x + other.width >= rect.x + rect.width && other.y + other.height >= rect.y + rect.height &&
      (other.width * other.height > rect.width * rect.height || otherIndex < index)))
      .sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 64);
  }
  return regions;
}

export function getCardViewTarget(width: number, height: number, context: BoardLayoutContext): Point {
  const viewport = { x: 16, y: 16, width: Math.max(1, context.width - 32), height: Math.max(1, context.height - 32) };
  const regions = freeRegions(viewport, context.controls || [], 16);
  const fitting = regions.filter(rect => rect.width >= width && rect.height >= height);
  const region = fitting[0] || regions[0] || viewport;
  return { x: region.x + region.width / 2, y: region.y + Math.min(region.height, height) / 2 };
}

const centeredBounds = (x: number, y: number, width: number, height: number, angle = 0): LayoutRect => {
  const radians = angle * Math.PI / 180;
  const w = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
  const h = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
  return { x: x - w / 2, y: y - h / 2, width: w, height: h };
};

/** Fabric's getBoundingRect(true, true) includes origins, groups, rotation and stroke. */
export function getBoardLayoutContext(canvas: any, dom: Record<string, DomElementState>): BoardLayoutContext {
  const matrix = canvas.viewportTransform?.length === 6 ? [...canvas.viewportTransform] : [1, 0, 0, 1, 0, 0];
  const width = positive(canvas.getWidth?.() ?? canvas.width, 1000);
  const height = positive(canvas.getHeight?.() ?? canvas.height, 700);
  const occupied: LayoutRect[] = [];
  const controls: LayoutRect[] = [];
  for (const object of canvas.getObjects?.() || []) {
    if (object.visible === false) continue;
    const w = positive(object.width, 1) * Math.abs(finite(object.scaleX, 1));
    const h = positive(object.height, 1) * Math.abs(finite(object.scaleY, 1));
    const rect = object.getBoundingRect?.(true, true) || centeredBounds(
      finite(object.left) + (object.originX === 'left' || !object.originX ? w / 2 : object.originX === 'right' ? -w / 2 : 0),
      finite(object.top) + (object.originY === 'top' || !object.originY ? h / 2 : object.originY === 'bottom' ? -h / 2 : 0), w, h, finite(object.angle),
    );
    occupied.push(transformRect({ x: rect.left ?? rect.x, y: rect.top ?? rect.y, width: rect.width, height: rect.height }, matrix));
  }
  // Include DOM-only imports as well as placeholders. Duplicate bounds are harmless and
  // conservatively cover a placeholder during an in-flight DOM drag/resize.
  for (const element of Object.values(dom)) {
    occupied.push(transformRect(centeredBounds(element.x, element.y, element.width * Math.abs(element.scaleX ?? 1), element.height * Math.abs(element.scaleY ?? 1), element.rotation), matrix));
  }
  const stage = canvas.lowerCanvasEl?.getBoundingClientRect?.();
  if (stage?.width > 0 && stage?.height > 0 && typeof document !== 'undefined') {
    for (const control of document.querySelectorAll('[data-board-occluder="true"]')) {
      const rect = control.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const bounds = { x: (rect.left - stage.left) * width / stage.width, y: (rect.top - stage.top) * height / stage.height, width: rect.width * width / stage.width, height: rect.height * height / stage.height };
      if (rectsOverlap(bounds, { x: 0, y: 0, width, height })) controls.push(bounds);
    }
  }
  return { width, height, transform: matrix, occupied: [...occupied, ...controls], controls };
}

/** Never move existing objects or change the camera. Readable overflow beats tiny cards. */
export function layoutBoardCards(cards: CardSize[], context: BoardLayoutContext): CardPlacement[] {
  if (!cards.length) return [];
  const padding = 16, gap = 16;
  const usableWidth = Math.max(1, context.width - padding * 2);
  const usableHeight = Math.max(1, context.height - padding * 2);
  const zoomX = Math.hypot(context.transform[0], context.transform[1]) || 1;
  const zoomY = Math.hypot(context.transform[2], context.transform[3]) || 1;
  // Inverse creation-time zoom keeps new UI readable without changing the camera.
  // Subsequent user zoom scales these cards normally along with the whole board.
  const minWidth = Math.min(usableWidth, 280);
  // Full illustrations need room for anatomy and labels, not a clipped strip.
  // Prefer one readable card with explicit navigation over two cramped cards.
  const minHeight = Math.max(220, ...cards.map(card => card.minHeight || 0));
  const preferredWidth = Math.max(minWidth, ...cards.map(c => positive(c.width, 450)));
  const preferredHeight = Math.max(minHeight, ...cards.map(c => positive(c.height, 400)));
  const maxColumns = Math.min(cards.length, Math.max(1, Math.floor((usableWidth + gap) / (minWidth + gap))));
  const maxRows = Math.min(cards.length, Math.max(1, Math.floor((usableHeight + gap) / (minHeight + gap))));
  let best: LayoutRect[] = [], bestScore = -Infinity, bestWidth = Math.max(minWidth, usableWidth), bestHeight = Math.max(minHeight, Math.min(preferredHeight, usableHeight));
  const viewport = { x: padding, y: padding, width: usableWidth, height: usableHeight };
  const obstacles = context.occupied.filter(rect => rectsOverlap(rect, viewport, gap));
  const regions = [viewport, ...freeRegions(viewport, obstacles, gap)];
  for (const region of regions) {
    for (let columns = 1; columns <= maxColumns; columns++) {
      for (let rows = 1; rows <= maxRows; rows++) {
        const cellWidth = Math.min(preferredWidth, (region.width - gap * (columns - 1)) / columns);
        const cellHeight = Math.min(preferredHeight, (region.height - gap * (rows - 1)) / rows);
        if (cellWidth < minWidth || cellHeight < minHeight) continue;
        const gridWidth = columns * cellWidth + (columns - 1) * gap;
        const gridHeight = rows * cellHeight + (rows - 1) * gap;
        const xs = [...new Set([region.x, region.x + region.width - gridWidth])];
        const ys = [...new Set([region.y, region.y + region.height - gridHeight])];
        for (const x of xs) for (const y of ys) {
          if (x < padding || y < padding || x + gridWidth > context.width - padding + .01 || y + gridHeight > context.height - padding + .01) continue;
          const slots: LayoutRect[] = [];
          for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
            const slot = { x: x + column * (cellWidth + gap), y: y + row * (cellHeight + gap), width: cellWidth, height: cellHeight };
            if (!context.occupied.some(rect => rectsOverlap(slot, rect, gap))) slots.push(slot);
          }
          const count = Math.min(cards.length, slots.length);
          const score = count * 1e9 + cellWidth * cellHeight - y - x * .01;
          if (score > bestScore) { best = slots.slice(0, count); bestScore = score; bestWidth = cellWidth; bestHeight = cellHeight; }
        }
      }
    }
  }
  const placed: LayoutRect[] = [...best];
  // Overflow continues beneath the viewport in the same columns, checking even
  // off-screen drawings. No destructive relayout, automatic pan or extra pages.
  const overflowColumns = Math.max(1, Math.floor((usableWidth + gap) / (bestWidth + gap)));
  let overflowY = context.height + gap;
  while (placed.length < cards.length) {
    const row: LayoutRect[] = [];
    for (let column = 0; column < overflowColumns && placed.length + row.length < cards.length; column++) {
      const slot = { x: padding + column * (bestWidth + gap), y: overflowY, width: bestWidth, height: bestHeight };
      if (![...context.occupied, ...placed].some(rect => rectsOverlap(slot, rect, gap))) row.push(slot);
    }
    if (row.length) { placed.push(...row); overflowY += bestHeight + gap; }
    else {
      const collisions = context.occupied.filter(rect => rectsOverlap({ x: padding, y: overflowY, width: usableWidth, height: bestHeight }, rect, gap));
      overflowY = Math.max(overflowY + bestHeight + gap, ...collisions.map(rect => rect.y + rect.height + gap));
    }
  }
  return placed.map((slot, index) => {
    const center = screenToWorld({ x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 }, context.transform);
    return { id: cards[index].id, x: center.x, y: center.y, width: slot.width, height: slot.height, scaleX: 1 / zoomX, scaleY: 1 / zoomY, overflow: index >= best.length };
  });
}

export function layoutCardActions(actions: AgentAction[], context: BoardLayoutContext): AgentAction[] {
  const cards = actions.filter(action => action.type === 'RENDER_HTML');
  const placements = layoutBoardCards(cards.map(action => ({ id: action.id, width: action.payload.width, height: action.payload.height,
    minHeight: action.payload.componentType === 'LABELLED_DIAGRAM' ? 420 : undefined })), context);
  const byId = new Map(placements.map(placement => [placement.id, placement]));
  return actions.map(action => {
    const placement = byId.get(action.id);
    return placement ? { ...action, payload: { ...action.payload, x: placement.x, y: placement.y, width: placement.width, height: placement.height, scaleX: placement.scaleX, scaleY: placement.scaleY, boardOverflow: placement.overflow } } : action;
  });
}