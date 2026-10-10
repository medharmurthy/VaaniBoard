import { describe, it, expect } from 'vitest';
import { buildSystemInstruction } from '../server/aiTools';

describe('Whiteboard & Multi-turn Session Context Continuity', () => {
  it('injects existing mindmaps into prompt context for seamless continuation', () => {
    const existingDomElements: Record<string, any> = {
      'mermaid_mm_1': {
        id: 'mermaid_mm_1',
        componentType: 'MERMAID_DIAGRAM',
        title: 'Mindmap Hindi',
        config: {
          code: 'mindmap\n  root((Hindi))\n    Swar\n    Vyanjan'
        }
      }
    };

    const instruction = buildSystemInstruction(
      [],
      { width: 1440, height: 900 },
      { current: 0, total: 1 },
      existingDomElements,
      {
        subject: 'Hindi',
        topic: 'Swar',
        phase: 'core',
        existingMindmapNodes: ['Swar', 'Vyanjan']
      }
    );

    // Verify system instruction contains the active whiteboard objects
    expect(instruction).toContain('Mindmap Hindi');
    expect(instruction).toContain('Swar');
    expect(instruction).toContain('Vyanjan');
    expect(instruction).toContain('Preserve existing content');
    expect(instruction).toContain('update_component');
  });

  it('preserves existing whiteboard components when expanding context in another language', () => {
    const existingDomElements: Record<string, any> = {
      'timer_1': {
        id: 'timer_1',
        componentType: 'TIMER',
        title: 'Class Timer',
        config: { seconds: 300, isRunning: true }
      },
      'notes_1': {
        id: 'notes_1',
        componentType: 'MARKDOWN_NOTE',
        title: 'Meeting Notes',
        config: { markdown: 'Key takeaways from UN agenda' }
      }
    };

    const instruction = buildSystemInstruction(
      [],
      { width: 1440, height: 900 },
      { current: 0, total: 1 },
      existingDomElements
    );

    expect(instruction).toContain('Class Timer');
    expect(instruction).toContain('Meeting Notes');
    expect(instruction).toContain('native-script labels');
  });
});
