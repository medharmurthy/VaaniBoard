import React, { useState, useEffect, useMemo } from 'react';
import { getLanguageProfile } from '../utils/languages';
import { Download, Copy, RefreshCw, ZoomIn, ZoomOut, Check, AlertCircle, Edit3, Eye, Sparkles } from 'lucide-react';
import { toast } from '../utils/toast';
import { downloadFile, slugify } from '../utils/smartExport';
import { useStore } from '../store';
import { needsMermaidLabelQuotes, quoteMermaidLabel, validateMermaidCode } from '../utils/mermaidCode';
import { localizeWarning, warningText } from '../utils/warningLanguage';

interface MermaidToolProps {
  id?: string;
  config: {
    code?: string;
    markdown?: string;
    title?: string;
  };
}

export const DEFAULT_MINDMAP = `mindmap
  root((Lesson topic))
    Key idea
    Example
    Practice`;

export const DEFAULT_FLOWCHART = `flowchart TD
  A[Start] --> B[Step one]
  B --> C[Step two]
  C --> D[Finish]`;

/**
 * Robust converter from markdown hierarchical bullet lists / headings
 * into valid Mermaid mindmap syntax.
 */
export function markdownToMermaidMindmap(md: string, fallbackTitle = 'Concept map'): string {
  const lines = md.split('\n');
  const result: string[] = ['mindmap'];
  let rootSet = false;
  let rootTitle = fallbackTitle;
  let currentHeadingLevel = 1;
  let nodeIndex = 0;

  const sanitizeNode = (str: string): string => {
    return str.trim() || 'Node';
  };
  const rootNode = (text: string) => `  root((${needsMermaidLabelQuotes(text) ? quoteMermaidLabel(text) : text}))`;
  const branchNode = (text: string) => needsMermaidLabelQuotes(text) ? `node${++nodeIndex}[${quoteMermaidLabel(text)}]` : text;
  rootTitle = sanitizeNode(rootTitle);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Heading parsing: # Root, ## Branch, ### Sub-branch
    if (line.startsWith('#')) {
      const match = line.match(/^(#+)\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = sanitizeNode(match[2]);
        if (level === 1 && !rootSet) {
          rootTitle = text;
          rootSet = true;
          result.push(rootNode(rootTitle));
          currentHeadingLevel = 1;
        } else {
          if (!rootSet) {
            rootSet = true;
            result.push(rootNode(rootTitle));
          }
          currentHeadingLevel = level;
          const indent = '  '.repeat(Math.max(2, level));
          result.push(`${indent}${branchNode(text)}`);
        }
        continue;
      }
    }

    // Bullet parsing: - Item, * Item
    const bulletMatch = rawLine.match(/^(\s*)[-*+]\s+(.+)$/);
    if (bulletMatch) {
      if (!rootSet) {
        rootSet = true;
        result.push(rootNode(rootTitle));
      }
      const rawSpaces = bulletMatch[1].replace(/\t/g, '  ').length;
      const bulletDepth = Math.floor(rawSpaces / 2);
      const effectiveLevel = currentHeadingLevel + 1 + bulletDepth;
      const text = sanitizeNode(bulletMatch[2]);
      const indent = '  '.repeat(Math.max(2, effectiveLevel));
      result.push(`${indent}${branchNode(text)}`);
      continue;
    }
  }

  if (!rootSet) {
    result.push(rootNode(rootTitle));
  }

  return result.join('\n');
}

// Standalone Mermaid Loader
let mermaidPromise: Promise<any> | null = null;

function getMermaidInstance(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).mermaid) {
    return Promise.resolve((window as any).mermaid);
  }

  if (!mermaidPromise) {
    mermaidPromise = new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && (window as any).mermaid) {
        resolve((window as any).mermaid);
        return;
      }

      const script = document.createElement('script');
      const timeout = window.setTimeout(() => {
        script.remove();
        reject(new Error('The local Mermaid renderer took too long to load. Reload the board or try again.'));
      }, 10000);
      script.src = '/vendor/mermaid.min.js';
      script.async = true;
      script.onload = () => {
        window.clearTimeout(timeout);
        if ((window as any).mermaid) {
          resolve((window as any).mermaid);
        } else {
          reject(new Error('The local Mermaid renderer did not initialize. Reload the board or check that /vendor/mermaid.min.js is available.'));
        }
      };
      script.onerror = () => {
        window.clearTimeout(timeout);
        script.remove();
        reject(new Error('The local Mermaid renderer could not load. Reload the board or check that /vendor/mermaid.min.js is available.'));
      };
      document.head.appendChild(script);
    }).catch(error => { mermaidPromise = null; throw error; });
  }

  return mermaidPromise;
}

export const MermaidTool: React.FC<MermaidToolProps> = ({ id, config }) => {
  const boardLanguage = useStore(state => state.boardLanguage);
  const warningLanguage = useStore(state => state.warningLanguage);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [renderedCode, setRenderedCode] = useState('');
  const [repairNotice, setRepairNotice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [retryKey, setRetryKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  
  // Missing content is an error, never an unrelated sample diagram.
  const resolvedInitialCode = useMemo(() => {
    if (config.code && config.code.trim()) {
      return config.code.trim();
    }
    if (config.markdown && config.markdown.trim()) {
      return markdownToMermaidMindmap(config.markdown, config.title || 'Concept map');
    }
    return '';
  }, [config.code, config.markdown, config.title]);

  const [activeCode, setActiveCode] = useState(resolvedInitialCode);

  useEffect(() => {
    setActiveCode(resolvedInitialCode);
  }, [resolvedInitialCode]);

  const title = config.title || 'Concept chart';

  const isMindmap = useMemo(() => {
    return activeCode.trim().startsWith('mindmap');
  }, [activeCode]);

  // Render diagram on change
  useEffect(() => {
    let isMounted = true;
    const renderDiagram = async () => {
      try {
        setError(null);
        setSvgHtml('');
        setRenderedCode('');
        setRepairNotice(false);
        setIsLoading(true);
        if(!activeCode.trim())throw new Error('No chart content was provided. Ask for the concept map or flowchart again.');
        const mm = await getMermaidInstance();
        if (!mm) throw new Error('The Mermaid renderer is not ready. Reload the board and try again.');

        mm.initialize({
          startOnLoad: false,
          theme: isMindmap ? 'base' : 'neutral',
          themeVariables: isMindmap ? {
            primaryColor: '#6366f1',
            primaryTextColor: '#ffffff',
            primaryBorderColor: '#4f46e5',
            lineColor: '#818cf8',
            secondaryColor: '#ec4899',
            tertiaryColor: '#10b981',
            fontFamily: getLanguageProfile(boardLanguage).font
          } : {
            fontFamily: getLanguageProfile(boardLanguage).font
          },
          securityLevel: 'strict',
          fontFamily: getLanguageProfile(boardLanguage).font,
          suppressErrorRendering: true
        });

        const validated = await validateMermaidCode(activeCode, mm);
        const uniqueId = `mermaid_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const { svg } = await mm.render(uniqueId, validated.code);
        if (isMounted) {
          setSvgHtml(svg);
          setRenderedCode(validated.code);
          setRepairNotice(validated.repaired);
        }
      } catch (err: any) {
        console.error('Mermaid render error:', err);
        if (isMounted) {
          setError(err?.message || 'Invalid Mermaid syntax. Open the editor to check labels, brackets and arrows.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    renderDiagram();
    return () => {
      isMounted = false;
    };
  }, [activeCode, retryKey, isMindmap, boardLanguage]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(renderedCode || activeCode);
      setCopied(true);
      toast.success('Mermaid code copied.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy code. Open the editor to select and copy the Mermaid source.');
    }
  };

  const handleExportSvg = () => {
    if (!svgHtml) return;
    downloadFile(svgHtml, `${slugify(title)}_mermaid.svg`, 'image/svg+xml;charset=utf-8');
    toast.success('Diagram SVG downloaded.');
  };

  const handleSaveCodeEdit = () => {
    setIsEditing(false);
    if (id) {
      useStore.getState().updateDomElement(id, {
        config: { ...config, code: renderedCode || activeCode }
      });
      toast.success('Mermaid diagram updated.');
    }
  };

  const handleSwitchToMindmapTemplate = () => {
    setActiveCode(DEFAULT_MINDMAP);
    setIsEditing(false);
  };

  const handleSwitchToFlowchartTemplate = () => {
    setActiveCode(DEFAULT_FLOWCHART);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col w-full h-full min-w-0 bg-[#fafafa] text-slate-800 overflow-hidden font-sans select-none relative" aria-busy={isLoading}>
      {/* Code Editor Drawer */}
      {isEditing && (
        <div className="bg-slate-900 text-slate-100 p-3 border-b border-slate-800 text-xs flex flex-col gap-2 shrink-0 z-30">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1.5">
              <Sparkles size={12} className="text-indigo-400" /> Mermaid code editor
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSwitchToMindmapTemplate}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-indigo-300 transition cursor-pointer"
              >
                Concept map template
              </button>
              <button
                onClick={handleSwitchToFlowchartTemplate}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-emerald-300 transition cursor-pointer"
              >
                Flowchart template
              </button>
              <button
                onClick={handleSaveCodeEdit}
                className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
              >
                <Check size={11} /> Apply
              </button>
            </div>
          </div>
          <textarea
            value={activeCode}
            aria-label={warningText('editCode', warningLanguage)}
            onChange={(e) => setActiveCode(e.target.value)}
            rows={5}
            className="w-full bg-slate-950 font-mono text-[11px] p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 text-slate-200 resize-y"
            placeholder="mindmap&#10;  root((Lesson topic))&#10;    Key idea&#10;      Example"
          />
        </div>
      )}

      {/* Main Diagram Canvas Area */}
      {repairNotice && <div role="status" data-engine="local" className="px-3 py-1.5 text-xs text-indigo-800 bg-indigo-50 border-b border-indigo-100">Chart labels repaired locally. Copy code to keep the corrected Mermaid source.</div>}
      <div className="flex-1 min-h-0 w-full relative overflow-auto p-4 pb-14 flex items-center justify-center bg-white/70">
        {error ? (
          <div role="alert" className="max-w-full max-h-full overflow-auto p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex flex-col gap-2.5 select-text">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold mb-0.5">{warningText('diagramError', warningLanguage)}</div>
                <div className="font-mono text-[11px] opacity-90 break-words whitespace-pre-wrap">{localizeWarning(error, warningLanguage)}</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1 bg-white hover:bg-indigo-50 border border-indigo-300 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Edit3 size={12} /> {warningText('openEditor', warningLanguage)}
              </button>
              <button
                onClick={() => setRetryKey(k => k + 1)}
                className="px-3 py-1 bg-white hover:bg-rose-100 border border-rose-300 text-rose-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} /> {warningText('retry', warningLanguage)}
              </button>
            </div>
            <details>
              <summary className="cursor-pointer font-semibold">View chart source</summary>
              <pre className="mt-2 p-2 bg-white border border-rose-100 rounded overflow-auto whitespace-pre-wrap break-words">{activeCode || 'No Mermaid code provided.'}</pre>
            </details>
          </div>
        ) : isLoading ? <div role="status" className="text-sm text-slate-600">Rendering chart locally…</div> : (
          <div
            role="img"
            aria-label={title}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
            dangerouslySetInnerHTML={{ __html: svgHtml }}
            className="max-w-full flex items-center justify-center"
          />
        )}
      </div>

      {/* Floating Canvas Controls (Figma/Canva style) */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-200/90 shadow-md select-none">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
            isEditing ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title={warningText('editCode', warningLanguage)}
          aria-label={isEditing ? warningText('preview', warningLanguage) : warningText('editCode', warningLanguage)}
        >
          {isEditing ? <Eye size={13} /> : <Edit3 size={13} />}
          <span className="text-[11px]">{isEditing ? warningText('preview', warningLanguage) : 'Edit'}</span>
        </button>
        <div className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />
        <button
          onClick={() => setZoom(z => Math.max(0.4, z - 0.15))}
          className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
          title={warningText('zoomOut', warningLanguage)}
          aria-label={warningText('zoomOut', warningLanguage)}
        >
          <ZoomOut size={13} />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="px-1.5 py-0.5 text-[10px] font-bold font-mono text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
          title="Reset zoom (100%)"
          aria-label="Reset zoom (100%)"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
          className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
          title={warningText('zoomIn', warningLanguage)}
          aria-label={warningText('zoomIn', warningLanguage)}
        >
          <ZoomIn size={13} />
        </button>
        <div className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />
        <button
          onClick={handleCopyCode}
          className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
          title={warningText('copyCode', warningLanguage)}
          aria-label={warningText('copyCode', warningLanguage)}
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
        </button>
        <button
          onClick={handleExportSvg}
          className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
          title={warningText('downloadSvg', warningLanguage)}
          aria-label={warningText('downloadSvg', warningLanguage)}
          disabled={!svgHtml || !!error || isLoading}
        >
          <Download size={13} />
        </button>
      </div>
    </div>
  );
};
