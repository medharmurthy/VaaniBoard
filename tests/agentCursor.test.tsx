import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AgentCursor } from '../components/AgentCursor';
import { useStore } from '../store';
vi.mock('gsap', () => ({ default: { to: vi.fn(() => ({ kill: vi.fn() })) } }));
const initial = useStore.getState();
afterEach(() => { cleanup(); useStore.setState(initial, true); });
describe('agent cursor lesson visibility', () => {
  it('does not leave an idle message bubble over the lesson or intercept pointer events', () => {
    useStore.setState({ isThinking: false, isActing: false, agentMessage: 'Lesson ready.' });
    const { container } = render(<AgentCursor />);
    expect(container.firstElementChild).toHaveStyle({ visibility: 'hidden' });
    expect(screen.queryByText('Lesson ready.')).not.toBeInTheDocument();
  });
  it('shows processing feedback only while an action or generation is active', () => {
    useStore.setState({ isThinking: true, isActing: false, agentMessage: 'Preparing lesson.' });
    const { container } = render(<AgentCursor />);
    expect(container.firstElementChild).toHaveStyle({ visibility: 'visible' });
    expect(screen.getByText('Preparing lesson.')).toBeInTheDocument();
  });
});