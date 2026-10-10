import {describe,it,expect,vi} from 'vitest';
import {matchAndExecuteHandsFreeCommand} from '../hooks/useAmbientListener';
import {useStore} from '../store';
describe('safe ambient wake phrase',()=>{
 it('requires Vaani wake word before dispatching',()=>{expect(matchAndExecuteHandsFreeCommand('classroom conversation')).toEqual({matched:false,action:'UNKNOWN'});});
 it('dispatches teacher commands to the shared pipeline once',()=>{const cb=vi.fn();window.addEventListener('vaani:voice-command',cb);expect(matchAndExecuteHandsFreeCommand('Vaani suno board pe counting banao').matched).toBe(true);expect(cb).toHaveBeenCalledTimes(1);window.removeEventListener('vaani:voice-command',cb);});
 it('records the stripped command before dispatch so detected warning language survives',()=>{
  useStore.setState({warningLanguage:'ta',lastVoiceCommand:null});
  const cb=vi.fn(()=>{expect(useStore.getState().lastVoiceCommand).toBe('வரைபடம்');expect(useStore.getState().warningLanguage).toBe('ta');});
  window.addEventListener('vaani:voice-command',cb);
  matchAndExecuteHandsFreeCommand('Vaani வரைபடம்');
  expect(cb).toHaveBeenCalledOnce();window.removeEventListener('vaani:voice-command',cb);
 });
});
