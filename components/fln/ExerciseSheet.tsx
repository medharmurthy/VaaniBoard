import React from 'react';
import type { SupportedLanguage } from '../../types';
import { speakText } from '../../services/speechService';
export function ExerciseSheet({config,lang='en',readOnly=false}:{config:any;lang?:SupportedLanguage;readOnly?:boolean}) {
  return <section className="h-full overflow-auto bg-white p-5 text-slate-900" aria-label="Textbook exercises" lang={config.lang||'en'}>
    <h2 className="text-2xl font-bold">{config.title||'NCERT exercises'}</h2>
    <p className="my-2 text-sm bg-green-100 rounded-lg p-2">{config.source||'NCERT'} · Original textbook text (not an AI-generated exercise)</p>
    <ol className="space-y-5">{(config.items||[]).map((item:any,i:number)=><li key={item.id||i} id={`exercise-${i+1}`} className="border-b pb-4">
      <p className="text-lg whitespace-pre-wrap">{item.text}</p>
      <div className="flex gap-3 items-center mt-2 text-sm"><span>Printed page {item.page}</span>
        {item.pdfFile&&<a className="text-blue-700 underline min-h-12 inline-flex items-center" target="_blank" rel="noopener noreferrer" href={`/api/syllabus/page?file=${encodeURIComponent(item.pdfFile)}#page=${item.pdfPage||1}`}>View original page</a>}
        <button className="min-h-12 border rounded-lg px-3" onClick={()=>speakText(item.text,config.lang||'en').catch(()=>{})} aria-label={`Read exercise ${i+1}`}>🔊</button></div>
    </li>)}</ol>
  </section>;
}