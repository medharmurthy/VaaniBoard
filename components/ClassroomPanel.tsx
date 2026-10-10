import React,{useEffect,useState} from 'react';
import { SUPPORTED_LANGUAGES } from '../utils/languages';
import type { SupportedLanguage,ClassroomProposal } from '../types';
import {useStore} from '../store';
import {localizeWarning} from '../utils/warningLanguage';
import {BookOpen,ChevronDown,ChevronUp,Send,Sparkles,Volume2,Undo2,Leaf,Sigma,Shapes,Accessibility,Check,X} from 'lucide-react';
interface Props {
  activeChapter:string|null;onChapterChange:(key:string|null)=>void;
  boardLanguage:SupportedLanguage;onBoardLanguageChange:(lang:SupportedLanguage)=>void;
  lessonMode:'standard'|'nipun';onLessonModeChange:(mode:'standard'|'nipun')=>void;
  proposals:ClassroomProposal[];onApprove:(id:string)=>void;onReject:(id:string)=>void;
  onPrompt:(prompt:string)=>void;onReadBoard:()=>void;onUndo:()=>void;
  highContrast:boolean;onHighContrastChange:(b:boolean)=>void;
}
export function ClassroomPanel(p:Props) {
  const busy=useStore(s=>s.isThinking || s.isActing || s.actionQueue.length>0);
  const engine=useStore(s=>s.classroomEngine);
  const warningLanguage=useStore(s=>s.warningLanguage);
  const [open,setOpen]=useState(false);const [chapters,setChapters]=useState<any[]>([]);const [notice,setNotice]=useState('');
  const [tab,setTab]=useState<'create'|'curriculum'|'review'>('create');const [prompt,setPrompt]=useState('');
  useEffect(()=>{let alive=true;fetch('/api/syllabus/chapters').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(d=>{if(alive){setChapters(d.chapters||[]);if(!d.chapters?.length)setNotice('Install the local NCERT index to use chapter exercises.');}}).catch(()=>alive&&setNotice('Syllabus server unavailable.'));return()=>{alive=false;};},[]);
  useEffect(()=>{if(p.proposals.length){setOpen(true);setTab('review');}},[p.proposals.length]);
  const run=(text:string)=>{if(!busy&&text.trim()){p.onPrompt(text.trim());setPrompt('');setOpen(false);}};
  const select='mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm min-h-11 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const examples=[
    {label:'Digestive system',hint:'Labelled anatomy',icon:Shapes,prompt:'Draw a labelled illustration of the human digestive system.'},
    {label:'Fourier series',hint:'Typeset equations',icon:Sigma,prompt:'Write the Fourier series formula and its coefficients for a function of period 2π. Explain the symbols.'},
    {label:'Photosynthesis',hint:'Plant illustration',icon:Leaf,prompt:'Draw a labelled diagram of photosynthesis.'},
    {label:'Water cycle',hint:'Landscape illustration',icon:Shapes,prompt:'Draw a labelled water cycle illustration, not a flowchart.'},
  ];
  return <aside className="classroom-panel w-[340px] max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-lg shadow-slate-900/5" aria-label="Classroom tools">
    <button className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors" aria-expanded={open} aria-controls="classroom-panel-content" onClick={()=>setOpen(!open)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Sparkles size={18}/></span>
      <span className="flex-1"><span className="block text-sm font-semibold">Classroom tools · कक्षा</span><span className="block mt-0.5 text-[11px] text-slate-500">Create, explore and teach</span></span>
      {!!p.proposals.length&&<span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">{p.proposals.length}</span>}
      {open?<ChevronUp size={16} className="text-slate-400"/>:<ChevronDown size={16} className="text-slate-400"/>}
    </button>
    {open&&<div id="classroom-panel-content" className="border-t border-slate-100">
      <nav className="mx-4 mt-3 flex rounded-xl bg-slate-100 p-1" aria-label="Classroom sections">{(['create','curriculum','review'] as const).map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)} className={`min-h-10 flex-1 rounded-lg text-xs font-semibold capitalize transition-colors ${tab===t?'bg-white text-blue-700 shadow-sm':'text-slate-500 hover:text-slate-900'}`}>{t}{t==='review'&&p.proposals.length?` (${p.proposals.length})`:''}</button>)}</nav>
      <div className="max-h-[min(62vh,620px)] space-y-4 overflow-auto p-4 custom-scrollbar">
        {tab==='create'&&<>
          <form onSubmit={e=>{e.preventDefault();run(prompt);}}>
            <label htmlFor="classroom-request" className="text-xs font-semibold text-slate-600">What would you like to teach?</label>
            <textarea id="classroom-request" disabled={busy} rows={3} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="A formula, a labelled diagram, or a lesson…" className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            <button disabled={busy||!prompt.trim()} type="submit" className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-45"><Send size={15}/>{busy?'Working…':'Create on board'}</button>
          </form>
          <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Try a starting point</p><div className="grid grid-cols-2 gap-2">{examples.map(e=><button key={e.label} disabled={busy} onClick={()=>run(e.prompt)} className="rounded-xl border border-slate-200 p-3 text-left hover:bg-blue-50 hover:border-blue-200 disabled:opacity-45 transition-colors"><e.icon size={17} className="mb-2 text-blue-600"/><span className="block text-xs font-semibold">{e.label}</span><span className="mt-1 block text-[10px] text-slate-500">{e.hint}</span></button>)}</div></div>
          <label className="block text-xs font-semibold text-slate-600">Board language<select className={select} value={p.boardLanguage} onChange={e=>p.onBoardLanguageChange(e.target.value as SupportedLanguage)}>{SUPPORTED_LANGUAGES.map(l=><option key={l.code} value={l.code}>{l.nativeName}</option>)}</select></label>
          <p className="text-[11px] leading-5 text-slate-500">Illustrations are educational vector drawings, not photographs. Math is rendered as readable equations.</p>
        </>}
        {tab==='curriculum'&&<>
          <div className="flex gap-2 text-sm leading-6 text-slate-500"><BookOpen size={18} className="mt-1 shrink-0 text-blue-600"/><p>NCERT Class 9 source material. Select a chapter for grounded lessons and original exercises.</p></div>
          <label className="block text-xs font-semibold text-slate-600">NCERT chapter<select className={select} value={p.activeChapter||''} onChange={e=>p.onChapterChange(e.target.value||null)}><option value="">General lesson · no chapter</option>{chapters.map(c=><option key={c.key} value={c.key}>{c.subject} · {c.chapterNo}. {c.title}</option>)}</select></label>
          {notice&&<p role="status" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{localizeWarning(notice,warningLanguage)}</p>}
          <button disabled={busy||!p.activeChapter} onClick={()=>run('Is chapter ka exercise dikhao.')} className="w-full min-h-11 rounded-xl bg-blue-50 text-sm font-semibold text-blue-700 disabled:opacity-45">Show chapter exercises</button>
          <div className="border-t border-slate-100 pt-3"><p className="mb-2 text-xs font-semibold">Foundational practice</p>{[
            ['Addition quiz','Class 2 ke bachchon ke liye 20 tak addition ka quiz banao.'],['Count in Hindi','Hindi mein ek simple counting activity banao.'],['Hindi letter game','Hindi mein Swar aur Vyanjan ka game banao.'],
          ].map(([label,text])=><button key={label} disabled={busy} onClick={()=>run(text)} className="mr-2 mb-2 min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-medium hover:bg-slate-50">{label}</button>)}</div>
          <label className="flex gap-2 items-center text-xs min-h-11"><input type="checkbox" checked={p.lessonMode==='nipun'} onChange={e=>p.onLessonModeChange(e.target.checked?'nipun':'standard')}/> NIPUN-inspired practice · Classes 1–3</label>
        </>}
        {tab==='review'&&<>
          {!p.proposals.length&&<div className="py-6 text-center"><Check className="mx-auto mb-3 text-teal-500" size={24}/><p className="text-sm font-semibold">No suggestions awaiting review</p><p className="mt-2 text-xs leading-5 text-slate-500">Student doubt explanations stay private here until you add them to the board.</p></div>}
          {p.proposals.map(item=><article key={item.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3"><span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Teacher review</span><h3 className="mt-1 text-sm font-semibold">{item.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.body}</p><p className="mt-2 text-[11px] text-slate-500">{item.citations.length?`${item.citations.length} textbook reference(s)`:'General explanation · not sourced from textbook'}</p><div className="mt-3 flex gap-2"><button disabled={busy} className="min-h-10 flex items-center gap-1 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white" onClick={()=>p.onApprove(item.id)}><Check size={14}/>Add to board</button><button className="min-h-10 flex items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs" onClick={()=>p.onReject(item.id)}><X size={14}/>Dismiss</button></div></article>)}
        </>}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3"><button className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-50 text-xs font-medium hover:bg-slate-100" onClick={p.onReadBoard}><Volume2 size={14}/>Read board</button><button disabled={busy} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-50 text-xs font-medium hover:bg-slate-100 disabled:opacity-45" onClick={p.onUndo}><Undo2 size={14}/>Undo turn</button><button aria-label="Toggle high contrast" aria-pressed={p.highContrast} className="min-h-10 min-w-10 flex items-center justify-center rounded-lg border border-slate-200" onClick={()=>p.onHighContrastChange(!p.highContrast)}><Accessibility size={16}/></button></div>
      <p role="status" className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">{busy?'Preparing your lesson…':engine||'Ready for your next lesson'}</p>
    </div>}
  </aside>;
}