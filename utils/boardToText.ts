export interface BoardReadingItem { id: string; kind: string; region: string; text: string }
export function boardToText(objects: any[], dom: Record<string, any>, lang = 'hi'): BoardReadingItem[] {
  const items: (BoardReadingItem & { x: number; y: number })[] = [];
  for (const obj of objects) {
    if (obj.isDomPlaceholder || dom[obj.id]) continue;
    const text = obj.text || obj.textContent || (obj.getObjects?.() || obj.objects || []).map((o: any) => o.text || '').join(' ').trim();
    if (text) items.push({ id: obj.id || 'text', kind: 'text', region: '', text, x: obj.left || 0, y: obj.top || 0 });
  }
  for (const [id, el] of Object.entries(dom)) {
    const c = el.config || {};
    const parts = [c.title || ''];
    if (c.markdown) parts.push(c.markdown);
    if(el.componentType==='LABELLED_DIAGRAM') {
      if(c.description)parts.push(c.description);
      if(c.labels)parts.push(...Object.values(c.labels).filter((label):label is string=>typeof label==='string'));
      if(c.shapes)parts.push(...c.shapes.filter((shape:any)=>shape.kind==='text').map((shape:any)=>shape.text));
    }
    if (c.code) parts.push(c.code.replace(/^(mindmap|flowchart[^\n]*)/i, '').replace(/root\(\((.*?)\)\)/g, '$1').replace(/[()[\]{}]/g, ' ').replace(/-->|---/g, ', '));
    if (c.question || c.statement) parts.push(c.question || c.statement);
    if (c.options) parts.push(...c.options.map((v: string, i: number) => `${i + 1}. ${v}`));
    if (c.questions) parts.push(...c.questions.map((q: any, i: number) => `${i + 1}. ${q.question}`));
    if (c.items) parts.push(...c.items.map((q: any, i: number) => `${q.exerciseNo || i + 1}. ${q.text || q}`));
    if (el.componentType === 'COUNTING_ACTIVITY') parts.push(lang === 'hi' ? `${c.min || 1} से ${c.max || 10} तक गिनती।` : `Count from ${c.min || 1} to ${c.max || 10}.`);
    if (el.componentType === 'LETTER_GAME') parts.push(lang === 'hi' ? 'स्वर और व्यंजन का खेल।' : 'Vowels and consonants game.');
    const text = parts.join('. ').replace(/[*#`_~]/g, '').replace(/https?:\/\/\S+/g, '').trim();
    if (text) items.push({ id, kind: el.componentType || 'widget', region: '', text, x: el.x || 0, y: el.y || 0 });
  }
  return items.sort((a, b) => a.y - b.y || a.x - b.x).map(({ x, y, ...item }) => item);
}