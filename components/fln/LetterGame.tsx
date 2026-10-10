import React,{useState} from 'react';
import type { SupportedLanguage } from '../../types';
import { speakText } from '../../services/speechService';
const vowels=['अ','आ','इ','ई','उ','ऊ','ऋ','ए','ऐ','ओ','औ'];
const cards=['अ','क','आ','म','इ','त','ई','प','उ','स','ऊ','न','ए','र','ऐ','ल','ओ','व','औ','ह'];
export function LetterGame({config,lang='hi',readOnly=false}:{config:any;lang?:SupportedLanguage;readOnly?:boolean}) {
  const [index,setIndex]=useState(0); const [score,setScore]=useState(0); const [feedback,setFeedback]=useState('');
  const letter=cards[index%cards.length];
  const choose=(isVowel:boolean)=> {const correct=vowels.includes(letter)===isVowel;setFeedback(correct?'सही!':'दोबारा सोचें।');if(correct){setScore(s=>s+1);setIndex(i=>i+1);}};
  return <section className="h-full overflow-auto p-5 bg-indigo-50 text-slate-900" lang="hi" aria-label="Hindi vowels and consonants game">
    <h2 className="font-bold text-2xl">{config.title||'स्वर और व्यंजन'}</h2>
    <p className="mt-3">अक्षर सुनें और सही समूह चुनें।</p>
    <button className="block text-8xl font-bold mx-auto my-6 p-4 min-w-32 rounded-2xl bg-white border-2 border-indigo-400" aria-label={`अक्षर ${letter} सुनें`} onClick={()=>speakText(letter,'hi').catch(()=>{})}>{letter}</button>
    <div className="flex gap-4 justify-center"><button disabled={readOnly} className="min-h-16 px-6 rounded-xl bg-blue-700 text-white text-2xl" onClick={()=>choose(true)}>स्वर</button>
      <button disabled={readOnly} className="min-h-16 px-6 rounded-xl bg-purple-700 text-white text-2xl" onClick={()=>choose(false)}>व्यंजन</button></div>
    <p className="text-xl mt-4" aria-live="polite">{feedback} अंक: {score}</p>
    <p className="mt-3 text-lg">स्वर: {vowels.join(' ')}</p>
  </section>;
}