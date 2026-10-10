import React,{useEffect,useState} from 'react';
import {useStore} from '../store';
export interface StudentRecord {id:string|number;name:string;status?:'P'|'A'|'L';note?:string;nis?:string}
export interface AttendanceConfig {title?:string;className?:string;date?:string;students?:StudentRecord[]}
export function AttendanceTool({config}:{config?:AttendanceConfig}) {
 const [students,setStudents]=useState<StudentRecord[]>(config?.students||[]);const [name,setName]=useState('');const viewer=useStore(s=>s.isViewerUrl);
 useEffect(()=>{if(config?.students)setStudents(config.students);},[config]);
 return <section className="h-full p-4 bg-white text-slate-900 overflow-auto" aria-label="Attendance"><h2 className="text-2xl font-bold">{config?.title||'Class attendance'}</h2><p className="my-3">{config?.className||'Your class'} · Present: {students.filter(s=>s.status==='P').length} / {students.length}</p>
 {!viewer&&<form className="flex gap-2 mb-4" onSubmit={e=>{e.preventDefault();if(name.trim()){setStudents(s=>[...s,{id:crypto.randomUUID(),name:name.trim(),status:'P'}]);setName('');}}}><input aria-label="Student name" placeholder="Add student name" className="border rounded-lg min-h-12 px-3 flex-1 min-w-0" value={name} onChange={e=>setName(e.target.value)}/><button className="min-h-12 px-3 bg-blue-700 text-white rounded-lg">Add</button></form>}
 {!students.length&&<p>No pupils added. This roster remains in the classroom; the AI receives only counts.</p>}
 <ul className="space-y-3">{students.map(s=><li key={s.id} className="flex justify-between items-center gap-3 border-b py-2"><span>{s.name}</span><div className="flex gap-2">{(['P','A','L'] as const).map(status=><button key={status} disabled={viewer} aria-label={`${s.name}: ${status==='P'?'Present':status==='A'?'Absent':'Leave'}`} aria-pressed={s.status===status} className={`min-h-12 min-w-12 border rounded-lg ${s.status===status?'bg-blue-700 text-white':''}`} onClick={()=>setStudents(list=>list.map(x=>x.id===s.id?{...x,status}:x))}>{status}</button>)}</div></li>)}</ul></section>;
}
