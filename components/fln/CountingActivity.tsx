import React, { useState } from 'react';
import type { SupportedLanguage } from '../../types';
import { nativeNumber } from '../../utils/languages';
import { speakText } from '../../services/speechService';
const hiWords = ['शून्य','एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ','दस'];
export function CountingActivity({config,lang='hi',readOnly=false}:{config:any;lang?:SupportedLanguage;readOnly?:boolean}) {
  const l = config.lang || lang; const max = Math.max(1,Math.min(20,Number(config.max)||10));
  const [selected,setSelected]=useState<number[]>([]);
  const count=selected.length; const word=l==='hi'?hiWords[count]:String(count);
  return <section className="h-full overflow-auto p-5 bg-amber-50 text-slate-900" aria-label="Counting activity">
    <h2 className="font-bold text-2xl">{config.title || (l==='hi'?'आम गिनें':'Count mangoes')}</h2>
    <p className="my-3">{l==='hi'?'हर आम पर दबाकर गिनें।':'Tap each mango to count.'}</p>
    <div className="grid grid-cols-5 gap-3">{Array.from({length:max},(_,i)=><button key={i} disabled={readOnly} aria-label={`Mango ${i+1}`} aria-pressed={selected.includes(i)}
      className={`min-h-16 text-4xl rounded-xl border-2 focus-visible:ring-4 focus-visible:ring-blue-600 ${selected.includes(i)?'bg-green-100 border-green-700':'bg-white border-amber-300'}`}
      onClick={()=>setSelected(s=>s.includes(i)?s.filter(n=>n!==i):[...s,i])}>🥭</button>)}</div>
    <p className="text-5xl font-bold mt-5" aria-live="polite">{nativeNumber(count,l)} <span className="text-2xl">{word || ''}</span></p>
    <div className="flex gap-3 mt-4"><button className="min-h-12 px-4 bg-blue-700 text-white rounded-xl" onClick={()=>speakText(word || String(count),l).catch(()=>{})}>🔊 {l==='hi'?'सुनें':'Listen'}</button>
      <button disabled={readOnly} className="min-h-12 px-4 border rounded-xl" onClick={()=>setSelected([])}>{l==='hi'?'फिर से':'Reset'}</button></div>
  </section>;
}