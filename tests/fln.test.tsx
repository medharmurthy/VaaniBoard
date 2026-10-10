import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {CountingActivity} from '../components/fln/CountingActivity';
import {LetterGame} from '../components/fln/LetterGame';
vi.mock('../services/speechService',()=>({speakText:vi.fn(async()=>{}),stopSpeaking:vi.fn()}));
describe('accessible primary activities',()=>{
 it('counts Hindi mangoes using accessible toggle buttons',()=>{
  render(<CountingActivity config={{lang:'hi',max:10}}/>);fireEvent.click(screen.getByRole('button',{name:'Mango 1'}));
  expect(screen.getByRole('button',{name:'Mango 1'})).toHaveAttribute('aria-pressed','true');expect(screen.getByText('एक')).toBeInTheDocument();cleanup();
 });
 it('lets children classify letters without dragging',()=>{render(<LetterGame config={{}}/>);fireEvent.click(screen.getByRole('button',{name:'स्वर'}));expect(screen.getByText(/अंक: 1/)).toBeInTheDocument();cleanup();});
});