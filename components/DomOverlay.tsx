import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { DomElementState } from '../types';
import { QuizMultipleChoice } from './quiz/QuizMultipleChoice';
import { QuizEssay } from './quiz/QuizEssay';
import { QuizTrueFalse } from './quiz/QuizTrueFalse';
import { QuizDragMatch } from './quiz/QuizDragMatch';
import { DocumentBlock } from './DocumentBlock';
import { TimerTool } from './TimerTool';
import { CalculatorTool } from './CalculatorTool';
import { AppBuilderTool } from './AppBuilderTool';
import { FlashcardTool } from './FlashcardTool';
import { QuizApp } from './quiz/QuizApp';
import { MarkmapTool } from './MarkmapTool';
import { MermaidTool } from './MermaidTool';
import { AttendanceTool } from './AttendanceTool';
import { TodoListTool } from './TodoListTool';
import { SpinWheelTool } from './SpinWheelTool';
import { ScoreboardTool } from './ScoreboardTool';
import { MathGraphTool } from './MathGraphTool';
import { LetterGame } from './fln/LetterGame';
import { CountingActivity } from './fln/CountingActivity';
import { ExerciseSheet } from './fln/ExerciseSheet';
import { LabelledDiagram } from './fln/LabelledDiagram';
import { getLanguageProfile } from '../utils/languages';
import {
  Printer, Maximize2, Minimize2, X, Download, FileText, Globe,
  Code, Compass, BookOpen, Clock, Calculator, HelpCircle, Layers, Sparkles, Users, SquareCheckBig,
  Image as ImageIcon, Copy, GripVertical
} from 'lucide-react';
import {
  triggerPrintComponent,
  printCleanDocument,
  exportDocumentAsHtml,
  exportDocumentAsMarkdown,
  exportInteractiveAppAsHtml,
  exportQuizAsPrintableWorksheet,
  exportComponentAsPNG,
  copyComponentAsImage,
  downloadFile,
  slugify
} from '../utils/smartExport';
import { toast } from '../utils/toast';
import { screenDeltaToWorld, transformPoint } from '../utils/boardLayout';

export const DomOverlay: React.FC = () => {
  const domElements = useStore(state => state.domElements);
  const viewportTransform = useStore(state => state.viewportTransform);
  const isActing = useStore(state => state.isActing);
  const removeDomElement = useStore(state => state.removeDomElement);
  const boardLanguage = useStore(state => state.boardLanguage);
  const isViewer = useStore(state => state.isViewerUrl);
  const lessonMode = useStore(state => state.lessonMode);

  const [fullscreenWidgetId, setFullscreenWidgetId] = useState<string | null>(null);
  const [lastViewedCardId, setLastViewedCardId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlaySize, setOverlaySize] = useState({ width: 1000, height: 700 });
  const [draggingWidget, setDraggingWidget] = useState<{ id: string; startMouseX: number; startMouseY: number; startElX: number; startElY: number } | null>(null);
  const [resizingWidget, setResizingWidget] = useState<{ id: string; startMouseX: number; startMouseY: number; startWidth: number; startHeight: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const element = overlayRef.current;
    if (!element) return;
    const update = () => setOverlaySize({ width: element.clientWidth || 1000, height: element.clientHeight || 700 });
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const focusCard = (event: Event) => {
      const id = (event as CustomEvent).detail?.id;
      if (useStore.getState().domElements[id]) setFullscreenWidgetId(id);
    };
    window.addEventListener('vaani:focus-board-card', focusCard);
    return () => window.removeEventListener('vaani:focus-board-card', focusCard);
  }, []);

  const handleTitlebarMouseDown = (el: DomElementState, e: React.MouseEvent | React.PointerEvent) => {
    if (e.button !== 0) return; // Only drag on left click
    e.preventDefault();
    e.stopPropagation();
    setDraggingWidget({
      id: el.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startElX: el.x,
      startElY: el.y
    });
  };

  const handleResizeMouseDown = (el: DomElementState, e: React.MouseEvent | React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setResizingWidget({
      id: el.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startWidth: el.width,
      startHeight: el.height
    });
  };

  useEffect(() => {
    if (!draggingWidget && !resizingWidget) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafIdRef.current) return;
      const { clientX, clientY } = e;

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (draggingWidget) {
          const { x: deltaX, y: deltaY } = screenDeltaToWorld({ x: clientX - draggingWidget.startMouseX, y: clientY - draggingWidget.startMouseY }, viewportTransform);

          const newX = Math.round(draggingWidget.startElX + deltaX);
          const newY = Math.round(draggingWidget.startElY + deltaY);

          useStore.getState().updateDomElement(draggingWidget.id, { x: newX, y: newY });
          window.dispatchEvent(new CustomEvent('moveCanvasPlaceholder', { detail: { id: draggingWidget.id, x: newX, y: newY } }));
        } else if (resizingWidget) {
          const { x: worldX, y: worldY } = screenDeltaToWorld({ x: clientX - resizingWidget.startMouseX, y: clientY - resizingWidget.startMouseY }, viewportTransform);
          const element = useStore.getState().domElements[resizingWidget.id];
          const angle = (element?.rotation || 0) * Math.PI / 180;
          const deltaX = (worldX * Math.cos(angle) + worldY * Math.sin(angle)) / (element?.scaleX || 1);
          const deltaY = (-worldX * Math.sin(angle) + worldY * Math.cos(angle)) / (element?.scaleY || 1);

          const newW = Math.max(260, Math.round(resizingWidget.startWidth + deltaX));
          const newH = Math.max(180, Math.round(resizingWidget.startHeight + deltaY));

          useStore.getState().updateDomElement(resizingWidget.id, { width: newW, height: newH });
          window.dispatchEvent(new CustomEvent('resizeCanvasPlaceholder', { detail: { id: resizingWidget.id, width: newW, height: newH } }));
        }
      });
    };

    const handleMouseUp = () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setDraggingWidget(null);
      setResizingWidget(null);
    };

    window.addEventListener('pointermove', handleMouseMove, { passive: true });
    window.addEventListener('pointerup', handleMouseUp);
    window.addEventListener('pointercancel', handleMouseUp);
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      window.removeEventListener('pointermove', handleMouseMove);
      window.removeEventListener('pointerup', handleMouseUp);
      window.removeEventListener('pointercancel', handleMouseUp);
    };
  }, [draggingWidget, resizingWidget, viewportTransform]);

  // Keyboard shortcut: Escape exits fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreenWidgetId) {
        setFullscreenWidgetId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenWidgetId]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (fullscreenWidgetId === id) setFullscreenWidgetId(null);
    removeDomElement(id);
    const event = new CustomEvent('removeCanvasObject', { detail: { id } });
    window.dispatchEvent(event);
  };

  const handlePrint = (el: DomElementState, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const title = el.config?.title || el.componentType || 'Vaani Board document';
    const type = el.componentType || '';

    // Specialized print handlers
    if (type.startsWith('QUIZ_')) {
      exportQuizAsPrintableWorksheet({ title, type, config: el.config });
      toast.success('Opening the printable worksheet.');
      return;
    }

    triggerPrintComponent(`widget-${el.id}`);
    toast.success('Opening print preview.');
  };

  const handleExportComponentPNG = async (el: DomElementState, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const title = el.config?.title || el.componentType || 'Board card';
    toast.info('Creating a high-resolution PNG…');
    const ok = await exportComponentAsPNG(`widget-${el.id}`, title, { pixelRatio: 2 });
    if (ok) {
      toast.success('PNG downloaded.');
    } else {
      toast.error('Could not create the PNG.');
    }
  };

  const handleCopyComponentImage = async (el: DomElementState, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toast.info('Copying image to the clipboard…');
    const ok = await copyComponentAsImage(`widget-${el.id}`);
    if (ok) {
      toast.success('Image copied to the clipboard.');
    } else {
      toast.error('Could not copy the image.');
    }
  };

  const handleQuickExport = (el: DomElementState, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const type = el.componentType || '';
    const config = el.config || {};
    const title = config.title || type;

    if (type === 'MARKDOWN_NOTE' || type === 'DOCUMENT_PAGE') {
      exportDocumentAsHtml(title, config.markdown || config.content || '');
      toast.success('HTML document downloaded.');
    } else if (type === 'MARKMAP_MINDMAP') {
      const svg = document.querySelector(`#widget-${el.id} svg`);
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        downloadFile(svgData, `${slugify(title)}_markmap.svg`, 'image/svg+xml;charset=utf-8');
        toast.success('Markmap SVG downloaded.');
      } else {
        exportDocumentAsMarkdown(title, config.markdown || config.content || '');
        toast.success('Markdown downloaded.');
      }
    } else if (type === 'MERMAID_DIAGRAM') {
      const svg = document.querySelector(`#widget-${el.id} svg`);
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        downloadFile(svgData, `${slugify(title)}_diagram.svg`, 'image/svg+xml;charset=utf-8');
        toast.success('Diagram SVG downloaded.');
      } else {
        downloadFile(config.code || '', `${slugify(title)}.mmd`, 'text/plain;charset=utf-8');
        toast.success('Mermaid code downloaded.');
      }
    } else if (type === 'INTERACTIVE_APP') {
      exportInteractiveAppAsHtml({
        title,
        html: config.html || '',
        css: config.css,
        js: config.js
      });
      toast.success('Aplikasi web mandiri (.html) downloaded.');
    } else if (type.startsWith('QUIZ_')) {
      exportQuizAsPrintableWorksheet({ title, type, config });
      toast.success('Opening the pupil worksheet.');
    } else {
      handlePrint(el, e);
    }
  };

  const getComponentIcon = (type?: string) => {
    switch (type) {
      case 'MARKDOWN_NOTE':
      case 'DOCUMENT_PAGE':
        return <BookOpen size={14} className="text-indigo-600" />;
      case 'MARKMAP_MINDMAP':
        return <Compass size={14} className="text-blue-600" />;
      case 'MERMAID_DIAGRAM':
        return <Layers size={14} className="text-emerald-600" />;
      case 'INTERACTIVE_APP':
        return <Code size={14} className="text-purple-600" />;
      case 'TIMER':
        return <Clock size={14} className="text-amber-600" />;
      case 'CALCULATOR':
        return <Calculator size={14} className="text-slate-600" />;
      case 'ATTENDANCE':
      case 'PRESENSI':
        return <Users size={14} className="text-blue-600" />;
      case 'TODOLIST':
        return <SquareCheckBig size={14} className="text-emerald-600" />;
      default:
        if (type?.startsWith('QUIZ')) return <HelpCircle size={14} className="text-rose-600" />;
        return <Sparkles size={14} className="text-blue-600" />;
    }
  };

  const renderContent = (el: DomElementState) => {
    if (el.componentType) {
      switch (el.componentType) {
        case 'QUIZ_MULTIPLE_CHOICE':
          return <QuizMultipleChoice config={el.config} />;
        case 'QUIZ_ESSAY':
          return <QuizEssay config={el.config} />;
        case 'QUIZ_TRUE_FALSE':
          return <QuizTrueFalse config={el.config} />;
        case 'QUIZ_DRAG_MATCH':
          return <QuizDragMatch config={el.config} />;
        case 'MARKDOWN_NOTE':
        case 'DOCUMENT_PAGE':
          return <DocumentBlock config={el.config} />;
        case 'TIMER':
          return <TimerTool config={el.config} />;
        case 'CALCULATOR':
          return <CalculatorTool />;
        case 'ATTENDANCE':
        case 'PRESENSI':
          return <AttendanceTool config={el.config} />;
        case 'TODOLIST':
          return <TodoListTool />;
        case 'SPIN_WHEEL':
        case 'RODA_ACAK':
          return <SpinWheelTool config={el.config} />;
        case 'SCOREBOARD':
        case 'PAPAN_SKOR':
          return <ScoreboardTool config={el.config} />;
        case 'MATH_GRAPH':
        case 'GRAFIK_MATEMATIKA':
          return <MathGraphTool config={el.config} />;
        case 'FLASHCARD':
          return <FlashcardTool config={el.config} />;
        case 'MARKMAP_MINDMAP':
        case 'MERMAID_DIAGRAM':
          return <MermaidTool id={el.id} config={el.config} />;
        case 'INTERACTIVE_APP':
        case 'APP_BUILDER':
        case 'STEM_SIMULATION':
        case 'SIMULASI_FISIKA':
        case 'SIMULASI_KIMIA':
          return <AppBuilderTool config={el.config} />;
        case 'QUIZ_APP':
          return <QuizApp config={el.config} />;
        case 'LETTER_GAME':
          return <LetterGame config={el.config || {}} lang={boardLanguage} readOnly={isViewer} />;
        case 'COUNTING_ACTIVITY':
          return <CountingActivity config={el.config || {}} lang={boardLanguage} readOnly={isViewer} />;
        case 'EXERCISE_SHEET':
          return <ExerciseSheet config={el.config || {}} lang={boardLanguage} readOnly={isViewer} />;
        case 'LABELLED_DIAGRAM':
          return <LabelledDiagram config={el.config || {}} lang={boardLanguage} readOnly={isViewer} />;
        case 'IMAGE_URL':
          return (
            <div className="w-full h-full flex items-center justify-center bg-slate-50 p-3">
              <img
                src={el.config?.url}
                alt="Uploaded"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          );
        default:
          return (
            <iframe title={el.config?.title || 'Imported widget'} sandbox=""
              className="w-full h-full border-0"
              srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">${el.html || ''}`} />
          );
      }
    }
    return (
      <iframe title="Imported content" sandbox="" className="w-full h-full border-0"
        srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">${el.html || ''}`} />
    );
  };

  const activeFullscreenEl = fullscreenWidgetId ? domElements[fullscreenWidgetId] : null;
  const cards = Object.values(domElements);
  const offscreenCards = cards.filter(element => {
    const center = transformPoint(element, viewportTransform);
    const width = element.width * Math.abs(element.scaleX ?? 1) * Math.hypot(viewportTransform[0], viewportTransform[1]);
    const height = element.height * Math.abs(element.scaleY ?? 1) * Math.hypot(viewportTransform[2], viewportTransform[3]);
    const angle = (element.rotation || 0) * Math.PI / 180;
    const boundsWidth = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle));
    const boundsHeight = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
    return center.x - boundsWidth / 2 < 0 || center.y - boundsHeight / 2 < 0 || center.x + boundsWidth / 2 > overlaySize.width || center.y + boundsHeight / 2 > overlaySize.height;
  });
  const viewNextCard = () => {
    const currentIndex = cards.findIndex(element => element.id === lastViewedCardId);
    const next = lastViewedCardId ? cards[(currentIndex + 1) % cards.length] : offscreenCards[0];
    if (!next) return;
    setLastViewedCardId(next.id);
    window.dispatchEvent(new CustomEvent('vaani:view-board-card', { detail: { id: next.id } }));
  };

  return (
    <div ref={overlayRef} className={`pointer-events-none absolute inset-0 overflow-hidden z-10 ${lessonMode === 'nipun' ? 'vaani-nipun' : ''}`}
      style={{ fontFamily: getLanguageProfile(boardLanguage).font }}>
      {/* ── 1. REGULAR CANVAS-PINNED DOM ELEMENTS ── */}
      <div
        className="absolute inset-0 will-change-transform"
        style={{
          transform: `matrix(${viewportTransform.join(',')})`,
          transformOrigin: '0 0'
        }}
      >
        {Object.values(domElements).map((el: DomElementState) => {
          if (fullscreenWidgetId === el.id) return null; // Rendered in fullscreen portal instead

          const title = el.config?.title || el.componentType?.replace(/_/g, ' ') || 'Board card';

          const isDragging = draggingWidget?.id === el.id;
          const isResizing = resizingWidget?.id === el.id;

          return (
            <div
              key={el.id}
              data-board-card-id={el.id}
              className={`board-widget absolute flex flex-col overflow-hidden rounded-2xl bg-white border will-change-transform select-none opacity-100 ${
                isDragging
                  ? 'shadow-[0_24px_70px_rgba(10,26,58,0.22)] border-[#1550aa] scale-[1.018] z-40 ring-4 ring-[#1550aa]/15'
                  : 'shadow-[0_12px_45px_rgba(10,26,58,0.10)] border-slate-200/90 hover:border-slate-300'
              }`}
              style={{
                width: `${el.width}px`,
                height: `${el.height}px`,
                left: el.x,
                top: el.y,
                transform: `translate(-50%, -50%) rotate(${el.rotation || 0}deg) scale(${el.scaleX ?? 1}, ${el.scaleY ?? 1})`,
                transformOrigin: 'center center',
                zIndex: isDragging || isResizing ? 40 : el.zIndex,
                pointerEvents: 'auto',
                transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s ease, border-color 0.2s ease, opacity 0.2s ease'
              }}
            >
              {/* Desktop Header / PC Window Titlebar with Generous Drag Area */}
              <div
                onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); handleTitlebarMouseDown(el, e); }}
                style={{ touchAction: 'none' }}
                onDoubleClick={() => setFullscreenWidgetId(el.id)}
                className={`flex h-12 w-full items-center justify-between px-3.5 border-b border-slate-200/80 shrink-0 select-none transition-colors cursor-grab active:cursor-grabbing ${
                  isDragging ? 'bg-[#1550aa]/10' : 'bg-slate-50/90 hover:bg-slate-100/90'
                }`}
                title="Drag to move · Double-click to focus"
              >
                {/* Title & Icon & Drag Hitbox (Flex-1 so touching/clicking anywhere drags) */}
                <div className="flex-1 flex items-center gap-2.5 min-w-0 pr-3 py-1 cursor-grab active:cursor-grabbing">
                  <div className="flex items-center justify-center text-slate-400 group-hover:text-slate-600 shrink-0">
                    <GripVertical size={16} />
                  </div>
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-2xs shrink-0">
                    {getComponentIcon(el.componentType)}
                  </div>
                  <div className="font-extrabold text-[12.5px] text-[#0a1a3a] tracking-tight truncate font-sans">
                    {title}
                  </div>
                </div>

                {/* PC Window Actions: Minimalist & focused */}
                <div className="flex items-center gap-1 shrink-0 no-print" onPointerDown={(e) => e.stopPropagation()}>
                  {/* Fullscreen / Focus Mode */}
                  <button
                    onClick={() => setFullscreenWidgetId(el.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-[#1550aa] transition cursor-pointer"
                    title="Focus view"
                  >
                    <Maximize2 size={14} />
                  </button>

                  {/* Sole Close / Delete Button */}
                  <button
                    onClick={(e) => handleDelete(el.id, e)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    title="Close widget"
                  >
                    <X size={15} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Application Content */}
              <div id={`widget-${el.id}`} className="flex-1 bg-white relative overflow-auto pointer-events-auto">
                {renderContent(el)}

                {isActing && (
                  <div className="absolute inset-0 z-50 bg-white/20 flex items-end justify-end p-3">
                    <div className="bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 text-blue-700 text-xs font-medium">
                      Updating board…
                    </div>
                  </div>
                )}
              </div>

              {/* Tactile Corner Resize Handle (learned from C7Cards & windows) */}
              <div
                onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); handleResizeMouseDown(el, e); }}
                style={{ touchAction: 'none' }}
                className="absolute bottom-0 right-0 w-8 h-8 flex items-end justify-end p-1.5 cursor-nwse-resize z-40 select-none group/resize touch-none"
                title="Drag corner to resize"
              >
                <div className="w-3.5 h-3.5 rounded-br-sm border-b-2 border-r-2 border-[#1550aa] group-hover/resize:border-[#ffcc00] group-hover/resize:scale-125 transition-all" />
                {isResizing && (
                  <div className="absolute -top-7 right-0 px-2 py-0.5 rounded-full bg-[#0a1a3a] text-white text-[10px] font-mono font-bold whitespace-nowrap shadow-md pointer-events-none">
                    {el.width} × {el.height}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!activeFullscreenEl && cards.length > 0 && (offscreenCards.length > 0 || lastViewedCardId) && overlayRef.current && createPortal(
        <button type="button" data-board-occluder="true" aria-label="View next lesson card" onClick={viewNextCard}
          className="pointer-events-auto absolute right-3 top-20 md:right-auto md:left-3 md:top-3 z-60 max-w-[calc(100%-24px)] rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-800 shadow-md"
          title="View the next board card without changing zoom">
          View next card{offscreenCards.length > 0 ? ` · ${offscreenCards.length} off-screen` : ''}
        </button>, overlayRef.current.closest('main') || overlayRef.current.parentElement!
      )}

      {/* ── 2. TRUE FULLSCREEN PC FOCUS MODE OVERLAY (MOUNTED DIRECTLY TO BODY VIA PORTAL) ── */}
      {activeFullscreenEl && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center pointer-events-auto p-3 sm:p-6 lg:p-8 font-sans select-none">
          {/* Dark Backdrop */}
          <div
            onClick={() => setFullscreenWidgetId(null)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
          />

          {/* Desktop Fullscreen Window Card */}
          <div className="relative w-full h-full max-w-7xl max-h-[95vh] bg-white rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.6)] border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 z-10">
            {/* Titlebar */}
            <div className="flex min-h-14 flex-wrap gap-2 px-3 py-2 sm:px-6 items-center justify-between bg-slate-50 border-b border-slate-200/90 shrink-0 select-none">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm shrink-0">
                  {getComponentIcon(activeFullscreenEl.componentType)}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight truncate">
                    {activeFullscreenEl.config?.title || activeFullscreenEl.componentType?.replace(/_/g, ' ') || 'Board card'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Focus view · Press Escape to return</p>
                </div>
              </div>

              {/* Titlebar Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {cards.length > 1 && <button type="button" aria-label="View next lesson card" onClick={() => {
                  const next = cards[(cards.findIndex(element => element.id === activeFullscreenEl.id) + 1) % cards.length];
                  setLastViewedCardId(next.id); setFullscreenWidgetId(next.id);
                }} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">Next card</button>}
                <button
                  onClick={(e) => handleExportComponentPNG(activeFullscreenEl, e)}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Download a high-resolution PNG"
                >
                  <ImageIcon size={14} /> Download PNG
                </button>

                <button
                  onClick={(e) => handleCopyComponentImage(activeFullscreenEl, e)}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Copy image to clipboard"
                >
                  <Copy size={14} /> Copy image
                </button>

                <button
                  onClick={(e) => handlePrint(activeFullscreenEl, e)}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Print or save as PDF"
                >
                  <Printer size={14} /> Print / PDF
                </button>

                <button
                  onClick={(e) => handleQuickExport(activeFullscreenEl, e)}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Download standalone file"
                >
                  <Download size={14} /> Download file
                </button>

                <button
                  onClick={() => setFullscreenWidgetId(null)}
                  className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition cursor-pointer ml-1"
                  title="Exit focus view (Escape)"
                >
                  <Minimize2 size={16} />
                </button>
              </div>
            </div>

            {/* Content Body in Fullscreen */}
            <div id={`widget-${activeFullscreenEl.id}-fullscreen`} className="flex-1 bg-white relative overflow-auto p-4 sm:p-8">
              {renderContent(activeFullscreenEl)}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
