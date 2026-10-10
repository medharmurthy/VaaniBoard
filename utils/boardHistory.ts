export interface BoardSnapshot { canvas: string; dom: string }
export class BoardHistory {
  private past: BoardSnapshot[] = []; private future: BoardSnapshot[] = []; private active = false;
  begin(snapshot: BoardSnapshot) { this.record(snapshot); this.active = true; }
  commit(snapshot: BoardSnapshot) { this.active = false; this.record(snapshot); }
  clear() { this.past = []; this.future = []; this.active = false; }
  record(snapshot: BoardSnapshot) {
    if (this.active) return;
    const last = this.past.at(-1);
    if (last?.canvas === snapshot.canvas && last?.dom === snapshot.dom) return;
    this.past.push(snapshot); if (this.past.length > 50) this.past.shift(); this.future = [];
  }
  undo(): BoardSnapshot | undefined { if (this.active || this.past.length < 2) return; this.future.push(this.past.pop()!); return this.past.at(-1); }
  redo(): BoardSnapshot | undefined { if (this.active) return; const s=this.future.pop(); if(s)this.past.push(s);return s; }
}