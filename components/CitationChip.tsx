import React from 'react';
export function CitationChip({source}:{source:{id?:string;chapterTitle?:string;page?:number;bookCode?:string}}) {
  return <span className="inline-block text-xs px-2 py-1 rounded bg-green-100 text-green-900 border border-green-200">NCERT · {source.chapterTitle} · p. {source.page}</span>;
}