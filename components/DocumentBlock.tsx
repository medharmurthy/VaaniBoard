import React, { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { toast } from '../utils/toast';
import { triggerPrintComponent, exportDocumentAsHtml, exportDocumentAsMarkdown, exportComponentAsPNG } from '../utils/smartExport';
import { Copy, Printer, Globe, FileText, Check, Image as ImageIcon } from 'lucide-react';
import { CitationChip } from './CitationChip';
import { normalizeMathMarkdown } from '../utils/mathMarkdown';
import { localizeWarning } from '../utils/warningLanguage';
import { useStore } from '../store';
import 'katex/dist/katex.min.css';

interface DocumentBlockProps {
  config?: {
    title?: string;
    markdown?: string;
    content?: string;
    citations?: any[];
  };
}

export const DocumentBlock: React.FC<DocumentBlockProps> = ({ config }) => {
  const warningLanguage = useStore(state => state.warningLanguage);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const safeConfig = config || {};

  const processedMarkdown = useMemo(() => {
    const raw = safeConfig.markdown || safeConfig.content || '';
    if (!raw) return '';
    return normalizeMathMarkdown(raw);
  }, [safeConfig.markdown, safeConfig.content]);

  const title = safeConfig.title || 'Lesson notes';

  const handleCopy = () => {
    navigator.clipboard.writeText(processedMarkdown);
    setCopied(true);
    toast.success('Content copied.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    if (containerRef.current) {
      triggerPrintComponent(containerRef.current);
    } else {
      window.print();
    }
  };

  const handleDownloadHtml = () => {
    exportDocumentAsHtml(title, processedMarkdown);
    toast.success('HTML document downloaded.');
  };

  const handleDownloadMarkdown = () => {
    exportDocumentAsMarkdown(title, processedMarkdown);
    toast.success('Markdown file (.md) downloaded.');
  };

  const handleDownloadPNG = async () => {
    if (containerRef.current) {
      toast.info('Creating a high-resolution document image…');
      const ok = await exportComponentAsPNG(containerRef.current, title, { pixelRatio: 2 });
      if (ok) toast.success('Document image downloaded.');
    }
  };

  return (
    <div
      ref={containerRef}
      className="lesson-document flex w-full h-full min-w-0 flex-col bg-white text-slate-800 overflow-hidden font-sans select-text"
    >
      {/* Printable Document Header (Appears only on print) */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
        <div className="text-[10px] font-black uppercase tracking-widest text-[#1550aa]">VAANI CLASSROOM DOCUMENT</div>
        <h1 className="text-2xl font-black text-slate-900 uppercase mt-1">{title}</h1>
        <div className="text-xs text-slate-500 mt-1">Date: {new Date().toLocaleDateString('en-IN')}</div>
      </div>

      {/* Content Area */}
      {!!safeConfig.citations?.length && <div className="px-4 py-2 flex flex-wrap gap-2" aria-label="Textbook sources">{safeConfig.citations.filter(c=>typeof c==='object').map((c,i)=><CitationChip key={c.id||i} source={c}/>)}</div>}
      <div className="flex-1 min-h-0 min-w-0 overflow-auto px-6 py-5 custom-scrollbar bg-white print:overflow-visible print:px-0 print:py-0">
        <div className="max-w-3xl mx-auto prose prose-slate prose-base leading-relaxed antialiased print:max-w-none [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-2 [&_.katex-error]:break-words">
          <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[[rehypeKatex, { strict: false, trust: false }]]}
            components={{
              h1: ({node, ...props}) => <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-6 border-b-2 border-indigo-100 pb-3 font-sans print:border-b print:border-slate-300" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-xl font-bold tracking-tight text-slate-800 mt-8 mb-3 font-sans flex items-center gap-2" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-lg font-bold text-slate-700 mt-6 mb-2 font-sans" {...props} />,
              p: ({node, ...props}) => <p className="mb-4 text-slate-700 leading-7 font-sans" {...props} />,
              li: ({node, ...props}) => <li className="mb-1.5 text-slate-700 last:mb-0 font-sans" {...props} />,
              table: ({node, ...props}) => (
                <div className="my-6 overflow-hidden rounded-xl border border-slate-200 shadow-sm print:shadow-none">
                  <table className="w-full text-sm text-left font-sans" {...props} />
                </div>
              ),
              thead: ({node, ...props}) => <thead className="bg-slate-50 text-slate-600 border-b border-slate-200" {...props} />,
              th: ({node, ...props}) => <th className="px-4 py-2.5 font-black uppercase tracking-wider text-[10px]" {...props} />,
              td: ({node, ...props}) => <td className="px-4 py-2.5 border-b border-slate-100 last:border-0" {...props} />,
              span: ({ node, className, children, ...props }) => className?.split(' ').includes('katex-error') ? (
                <span role="alert" className="katex-error inline-block rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800" {...props}>
                  <span className="font-semibold whitespace-pre-wrap">{localizeWarning('Could not render this formula. Check the LaTeX commands and braces, then request a corrected formula.', warningLanguage)}</span>{' '}
                  <code className="whitespace-pre-wrap break-words">{children}</code>
                </span>
              ) : <span className={className} {...props}>{children}</span>,
              code: ({node, inline, className, children, ...props}: any) => {
                return inline || (!className && !String(children).includes('\n')) ? (
                  <code className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-xs font-bold" {...props}>{children}</code>
                ) : (
                  <div className="bg-slate-900 rounded-xl overflow-hidden my-6 shadow-md print:bg-slate-100 print:text-slate-800 print:shadow-none">
                     <div className="flex items-center px-4 py-1.5 bg-slate-800/50 border-b border-slate-700 justify-between print:hidden">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">Code</span>
                     </div>
                     <pre className="p-4 overflow-x-auto text-xs text-indigo-200 font-mono leading-relaxed print:text-slate-800"><code {...props}>{children}</code></pre>
                  </div>
                );
              }
            }}
          >
            {processedMarkdown || '*Waiting for lesson content…*'}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};
