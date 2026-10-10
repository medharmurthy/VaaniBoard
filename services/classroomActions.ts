import { useStore } from '../store';
import type { ClassroomProposal } from '../types';
import {scienceDiagramSchema} from '../utils/scienceDiagrams';

/** Approved proposals may only publish declarative React widgets, never executable HTML. */
export function approveClassroomProposal(id: string, canvas?: any): boolean {
  const state = useStore.getState();
  const proposal = state.proposals.find(p => p.id === id);
  if (!proposal) return false;
  const call = proposal.boardCall;
  let config: Record<string, any> = { title: proposal.title, markdown: proposal.body, citations: state.citations.filter(c=>proposal.citations.includes(c.id)) };
  let componentType = 'DOCUMENT_PAGE';
  if (call?.name === 'add_component') {
    const allowed = ['DOCUMENT_PAGE', 'MARKDOWN_NOTE', 'LETTER_GAME', 'COUNTING_ACTIVITY', 'EXERCISE_SHEET', 'LABELLED_DIAGRAM', 'QUIZ_APP', 'MERMAID_DIAGRAM', 'FLASHCARD'];
    if (!allowed.includes(call.args.componentType)) return false;
    componentType = call.args.componentType;
    try {
      config = typeof call.args.configJson === 'string' ? JSON.parse(call.args.configJson) : call.args.configJson || config;
      if (!config || typeof config !== 'object' || Array.isArray(config)) return false;
      if(componentType==='LABELLED_DIAGRAM'&&!scienceDiagramSchema.safeParse(config).success)return false;
    } catch { return false; }
  }
  const vpt = canvas?.viewportTransform || [1, 0, 0, 1, 0, 0];
  const x = ((canvas?.width || 1100) / 2 - vpt[4]) / vpt[0];
  const y = ((canvas?.height || 700) / 2 - vpt[5]) / vpt[0];
  state.addAction({
    id: crypto.randomUUID(), type: 'RENDER_HTML', status: 'PENDING',
    payload: { html: '<div></div>', componentType, config: { ...config, lang: state.boardLanguage }, x, y, width: 600, height: 560 },
  });
  state.dismissProposal(id);
  return true;
}