import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Download, Image as ImageIcon, FileJson, FileText, Upload,
  Layers, Check, Sparkles, FolderUp, CheckSquare, Printer,
  Copy, ExternalLink, Palette, AlertTriangle, Share2, Eye,
  Maximize2, Cpu, FileCode, GitBranch
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { useStore } from '../store';
import { toast } from '../utils/toast';
import { useTranslation } from '../utils/translations';
import {
  detectBoardObjects,
  exportDocumentAsHtml,
  exportDocumentAsMarkdown,
  printCleanDocument,
  exportInteractiveAppAsHtml,
  exportQuizAsPrintableWorksheet,
  exportMindmapAsMarkdown,
  exportSafeCompositePNG,
  exportMindmapToMermaid,
  exportMindmapToCanvaSVG,
  exportQuizToGIFT,
  copyImageToClipboard,
  getBoardContentBoundingBox,
  downloadFile
} from '../utils/smartExport';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<any>;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose, canvasRef }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'visual' | 'project' | 'objects'>('visual');
  const [bgColor, setBgColor] = useState<'#ffffff' | '#0f172a' | 'transparent'>('#ffffff');
  const [multiplier, setMultiplier] = useState<1 | 2 | 4>(2);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string>('');
  const [pendingImportData, setPendingImportData] = useState<any | null>(null);

  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const {
    pages,
    currentPageIndex,
    domElements,
    activeMindmapNodes,
    importProjectSession
  } = useStore();

  const detected = useMemo(() => {
    return detectBoardObjects(canvasRef.current, domElements, activeMindmapNodes);
  }, [domElements, activeMindmapNodes, canvasRef.current, isOpen]);

  // Generate live visual preview snapshot capturing BOTH canvas and DOM smartboard widgets
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const generatePreview = async () => {
      // 1. Try capturing composite stage with all widgets (Mindmaps, Document Blocks, Quizzes, Simulations)
      const stage = document.getElementById('smartboard-stage-container');
      if (stage) {
        try {
          const dataUrl = await toPng(stage, {
            skipFonts: true,
            backgroundColor: bgColor === 'transparent' ? undefined : bgColor,
            pixelRatio: 0.6,
            cacheBust: true,
            filter: (node: any) => {
              if (node.classList && (node.classList.contains('agent-cursor') || node.classList.contains('exclude-export'))) {
                return false;
              }
              return true;
            }
          });
          if (!isCancelled && dataUrl && dataUrl.length > 500) {
            setLivePreviewUrl(dataUrl);
            return;
          }
        } catch (err) {
          console.warn('Live preview stage capture fallback to canvas:', err);
        }
      }

      // 2. Fallback to canvas.toDataURL
      if (canvasRef.current && !isCancelled) {
        try {
          const canvas = canvasRef.current;
          const dataUrl = canvas.toDataURL({
            format: 'png',
            multiplier: 0.5
          });
          setLivePreviewUrl(dataUrl);
        } catch (e) {
          console.warn('Failed to generate live preview snapshot:', e);
        }
      }
    };

    generatePreview();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, canvasRef.current, bgColor, domElements, activeMindmapNodes]);

  // ── 1. EXPORT SAFE COMPOSITE PNG (Anti Layar Hitam) ──────────────────────
  const handleExportPNG = async () => {
    if (!canvasRef.current) return;
    try {
      const dataURL = await exportSafeCompositePNG(canvasRef.current, domElements, {
        backgroundColor: bgColor,
        multiplier
      });
      downloadFile(dataURL, `vaani_board_${multiplier === 4 ? '4K_' : multiplier === 2 ? 'HD_' : ''}${Date.now()}.png`, 'image/png');
      toast.success(`PNG image (${multiplier}x) exported.`);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Could not export the PNG image.');
    }
  };

  // ── 2. COPY IMAGE TO CLIPBOARD ───────────────────────────────────────────
  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    try {
      const dataURL = await exportSafeCompositePNG(canvasRef.current, domElements, {
        backgroundColor: bgColor,
        multiplier: 2
      });
      const ok = await copyImageToClipboard(dataURL);
      if (ok) {
        setCopiedImage(true);
        toast.success('Image copied to clipboard! Paste it (Ctrl+V) into WhatsApp, Word or Canva.');
        setTimeout(() => setCopiedImage(false), 2000);
      } else {
        toast.error('This browser does not allow copying images directly.');
      }
    } catch (err: any) {
      toast.error('Could not copy the image.');
    }
  };

  // ── 3. EXPORT SVG DENGAN BOUNDING BOX ─────────────────────────────────────
  const handleExportSVG = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    try {
      const bounds = getBoardContentBoundingBox(canvas, domElements);
      let svg = canvas.toSVG({
        viewBox: {
          x: bounds.left,
          y: bounds.top,
          width: bounds.width,
          height: bounds.height
        }
      });

      if (bgColor !== 'transparent') {
        svg = svg.replace('<svg ', `<svg style="background-color: ${bgColor};" `);
      }

      downloadFile(svg, `vaani_board_vector_${Date.now()}.svg`, 'image/svg+xml;charset=utf-8');
      toast.success('SVG vector exported.');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Could not export the SVG vector.');
    }
  };

  // ── 4. EXPORT A4 PDF DOCUMENT ────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!canvasRef.current) return;
    setIsExportingPdf(true);

    try {
      const { PDFDocument } = await import('pdf-lib');
      const dataURL = await exportSafeCompositePNG(canvasRef.current, domElements, {
        backgroundColor: '#ffffff',
        multiplier: 2
      });

      const pdfDoc = await PDFDocument.create();
      // A4 landscape: 842 x 595 pt
      const page = pdfDoc.addPage([842, 595]);

      const pngImageBytes = await fetch(dataURL).then(res => res.arrayBuffer());
      const pngImage = await pdfDoc.embedPng(pngImageBytes);

      const margin = 28;
      const maxWidth = 842 - margin * 2;
      const maxHeight = 595 - margin * 2;

      let drawWidth = maxWidth;
      let drawHeight = (pngImage.height / pngImage.width) * drawWidth;

      if (drawHeight > maxHeight) {
        drawHeight = maxHeight;
        drawWidth = (pngImage.width / pngImage.height) * drawHeight;
      }

      const x = margin + (maxWidth - drawWidth) / 2;
      const y = margin + (maxHeight - drawHeight) / 2;

      page.drawImage(pngImage, {
        x,
        y,
        width: drawWidth,
        height: drawHeight
      });

      const pdfBytes = await pdfDoc.save();
      downloadFile(new Blob([pdfBytes], { type: 'application/pdf' }), `vaani_board_document_A4_${Date.now()}.pdf`, 'application/pdf');

      toast.success('Print-ready A4 PDF created.');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Could not create the PDF document.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // ── 5. EXPORT PROJECT JSON / .TRIDO ──────────────────────────────────────
  const handleExportJSON = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const currentCanvasJson = canvas.toJSON(['id', 'zIndex', 'isDomPlaceholder']);

    const updatedPages = [...pages];
    updatedPages[currentPageIndex] = {
      canvas: currentCanvasJson,
      dom: domElements,
      previewDataUrl: livePreviewUrl || canvas.toDataURL({ format: 'png', multiplier: 0.2 }),
      mindmapNodes: activeMindmapNodes
    };

    const exportData = {
      app: 'trido',
      version: '1.0.0',
      exportedAt: Date.now(),
      title: `Vaani Board Project - ${new Date().toLocaleDateString('en-IN')}`,
      pages: updatedPages,
      currentPageIndex,
      messages: useStore.getState().messages,
      lessonPlan: useStore.getState().lessonPlan
    };

    downloadFile(JSON.stringify(exportData, null, 2), `vaani_board_backup_${Date.now()}.trido.json`, 'application/json');
    toast.success('Vaani Board project backup (.trido) downloaded!');
    onClose();
  };

  // ── 6. INSPECT & IMPORT PROJECT FILE (Flexible Multi-Format) ───────────
  const handleProjectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Route image files directly to canvas insertion
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(file.name)) {
      handleImageFileChange(e);
      return;
    }

    try {
      const text = await file.text();
      let parsed = JSON.parse(text);

      // 1. Standard Trido project with multi-page structure
      if (parsed.pages && Array.isArray(parsed.pages)) {
        // already valid
      } else if (parsed.objects && Array.isArray(parsed.objects)) {
        // 2. Raw Fabric.js canvas export
        parsed = {
          title: file.name.replace(/\.[^/.]+$/, ''),
          pages: [{ canvas: parsed, dom: {} }],
          currentPageIndex: 0
        };
      } else if (parsed.canvas) {
        // 3. Single canvas wrapper
        parsed = {
          title: parsed.title || file.name.replace(/\.[^/.]+$/, ''),
          pages: [{ canvas: parsed.canvas, dom: parsed.dom || {} }],
          currentPageIndex: 0
        };
      } else {
        // Fallback: wrap into generic page
        parsed = {
          title: file.name.replace(/\.[^/.]+$/, ''),
          pages: [{ canvas: parsed, dom: {} }],
          currentPageIndex: 0
        };
      }

      setPendingImportData({
        fileName: file.name,
        sizeKb: (file.size / 1024).toFixed(1),
        title: parsed.title || 'Untitled Project',
        pageCount: parsed.pages.length,
        exportedAt: parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleDateString('en-IN') : 'External session',
        raw: parsed
      });
    } catch (err: any) {
      toast.error('Could not read the file: ' + (err?.message || 'Make sure it is a valid JSON or .trido file'));
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleApplyImport = async () => {
    if (!pendingImportData) return;
    setIsImporting(true);
    try {
      await importProjectSession(pendingImportData.raw);
      toast.success(`Project "${pendingImportData.title}" loaded onto the board!`);
      setPendingImportData(null);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Could not apply the project file.');
    } finally {
      setIsImporting(false);
    }
  };

  // ── 7. INSERT IMAGE DIRECTLY ONTO CANVAS ─────────────────────────────────
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvasRef.current || !window.fabric) return;

    const canvas = canvasRef.current;
    const reader = new FileReader();

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      window.fabric.Image.fromURL(dataUrl, (img: any) => {
        if (!img) {
          toast.error('Could not load the image.');
          return;
        }

        const maxDim = 400;
        let scale = 1;
        if (img.width > maxDim || img.height > maxDim) {
          scale = maxDim / Math.max(img.width, img.height);
        }

        const center = canvas.getCenter();
        img.set({
          left: center.left - (img.width * scale) / 2,
          top: center.top - (img.height * scale) / 2,
          scaleX: scale,
          scaleY: scale,
          cornerColor: '#1550aa',
          cornerStyle: 'circle',
          borderColor: '#1550aa',
          transparentCorners: false
        });

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
        toast.success('Image inserted onto the whiteboard!');
        onClose();
      });
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs font-sans">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-[101] max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50/80 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1550aa] flex items-center justify-center text-white shadow-2xs">
                  <Download size={20} strokeWidth={2.4} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#0a1a3a]">
                    Whiteboard Export & Import Centre
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Live preview • No black screens • Works with Canva, Word & PDF
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex p-1.5 bg-slate-100 border-b border-slate-200 gap-1 px-6 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('visual')}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'visual'
                    ? 'bg-white text-[#1550aa] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ImageIcon size={15} />
                <span>Images & Documents (PNG / PDF / SVG)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('project')}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'project'
                    ? 'bg-white text-[#1550aa] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderUp size={15} />
                <span>Project Backup (.trido) & Import</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('objects')}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'objects'
                    ? 'bg-white text-[#1550aa] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles size={15} />
                <span>Special Content (Mermaid & Quiz)</span>
              </button>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={projectFileInputRef}
              type="file"
              accept=".json,.trido"
              className="hidden"
              onChange={handleProjectFileChange}
            />
            <input
              ref={imageFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleImageFileChange}
            />

            {/* Content Area */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              {/* TAB 1: GAMBAR & DOKUMEN DENGAN LIVE PREVIEW */}
              {activeTab === 'visual' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Live Visual Board Preview */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <Eye size={14} className="text-[#1550aa]" />
                        <span>Export Preview</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Page {currentPageIndex + 1}</span>
                    </div>

                    <div className="aspect-[4/3] rounded-2xl border-2 border-slate-200 overflow-hidden relative flex items-center justify-center p-2 shadow-inner" style={{ backgroundColor: bgColor === 'transparent' ? '#f1f5f9' : bgColor }}>
                      {livePreviewUrl ? (
                        <img
                          src={livePreviewUrl}
                          alt="Live Canvas Preview"
                          className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                        />
                      ) : (
                        <div className="text-center space-y-1 text-slate-400">
                          <ImageIcon size={32} className="mx-auto opacity-50" />
                          <p className="text-xs font-semibold">Board ready to export</p>
                        </div>
                      )}

                      {bgColor === 'transparent' && (
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono">
                          Transparent background
                        </div>
                      )}
                    </div>

                    {/* Background Plate Settings */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <span className="text-[11px] font-bold text-slate-600 block">Background colour:</span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setBgColor('#ffffff')}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            bgColor === '#ffffff' ? 'border-[#1550aa] bg-white text-[#1550aa] ring-2 ring-[#1550aa]/15' : 'border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full border border-slate-300 bg-white" />
                          <span>White</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBgColor('#0f172a')}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            bgColor === '#0f172a' ? 'border-[#1550aa] bg-white text-[#1550aa] ring-2 ring-[#1550aa]/15' : 'border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full bg-slate-900" />
                          <span>Dark</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBgColor('transparent')}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            bgColor === 'transparent' ? 'border-[#1550aa] bg-white text-[#1550aa] ring-2 ring-[#1550aa]/15' : 'border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full border border-dashed border-slate-400 bg-transparent" />
                          <span>Transparent</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions & Formats */}
                  <div className="lg:col-span-7 space-y-3">
                    <span className="text-xs font-bold text-slate-700 block">Export formats:</span>

                    {/* PNG High-Res Card */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-[#1550aa]/40 transition-all space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1550aa] flex items-center justify-center">
                            <ImageIcon size={18} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-[#0a1a3a]">High-quality PNG image</h4>
                            <p className="text-[11px] text-slate-500 font-medium">No black screens, sharp resolution for presentations</p>
                          </div>
                        </div>

                        {/* Multiplier Selector */}
                        <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200 text-[11px] font-bold">
                          {([1, 2, 4] as const).map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setMultiplier(m)}
                              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                multiplier === m ? 'bg-[#1550aa] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {m === 4 ? '4K' : `${m}x`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleExportPNG}
                          className="flex-1 py-2 px-3 bg-[#1550aa] hover:bg-[#0a1a3a] text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Download size={14} />
                          <span>Download PNG image ({multiplier === 4 ? '4K' : `${multiplier}x`})</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyImage}
                          className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Copy straight to the clipboard to paste into WhatsApp Web or Word"
                        >
                          {copiedImage ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          <span>{copiedImage ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {/* PDF Document A4 Landscape */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-[#1550aa]/40 transition-all flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                          <FileText size={18} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-[#0a1a3a]">Print-ready PDF document (A4)</h4>
                          <p className="text-[11px] text-slate-500 font-medium">Clean landscape layout for worksheets & student handouts</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isExportingPdf}
                        onClick={handleExportPDF}
                        className="py-2 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Printer size={14} />
                        <span>{isExportingPdf ? 'Preparing...' : 'Download PDF'}</span>
                      </button>
                    </div>

                    {/* Scalable Vector SVG */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-[#1550aa]/40 transition-all flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                          <FileCode size={18} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-[#0a1a3a]">Scalable SVG vector</h4>
                          <p className="text-[11px] text-slate-500 font-medium">Can be opened & edited again in Canva, Figma, Illustrator</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleExportSVG}
                        className="py-2 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <ExternalLink size={14} />
                        <span>Download SVG</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CADANGAN PROYEK (.TRIDO) & PUSAT IMPOR */}
              {activeTab === 'project' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Backup Section */}
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-left">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#1550aa] flex items-center justify-center">
                          <Download size={16} />
                        </div>
                        <h4 className="font-extrabold text-sm text-[#0a1a3a]">Back up the full project</h4>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        Save the whole canvas, all pages, interactive elements and chat history into a single <code>.trido</code> file.
                      </p>
                      <button
                        type="button"
                        onClick={handleExportJSON}
                        className="w-full py-2.5 px-4 bg-[#1550aa] hover:bg-[#0a1a3a] text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <FileJson size={15} />
                        <span>Download backup file (.trido)</span>
                      </button>
                    </div>

                    {/* Insert Image Section */}
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-left">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <ImageIcon size={16} />
                        </div>
                        <h4 className="font-extrabold text-sm text-[#0a1a3a]">Insert an image on the board</h4>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        Add diagrams, lesson photos or charts (PNG, JPG, SVG) straight to the centre of the active board.
                      </p>
                      <button
                        type="button"
                        onClick={() => imageFileInputRef.current?.click()}
                        className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Upload size={15} />
                        <span>Choose an image from your computer</span>
                      </button>
                    </div>
                  </div>

                  {/* Import Dropzone Area */}
                  <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 hover:bg-blue-50/30 hover:border-[#1550aa] transition-all text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1550aa] flex items-center justify-center mx-auto shadow-2xs">
                      <FolderUp size={24} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-sm text-[#0a1a3a]">
                        Restore / Open a Vaani Board project file
                      </h4>
                      <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                        Choose a <code>.trido</code> or <code>.json</code> backup file to continue a previous teaching session.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => projectFileInputRef.current?.click()}
                      className="px-5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-2xs"
                    >
                      Browse backup files (.trido)
                    </button>

                    {/* Pending Import Inspection Card */}
                    {pendingImportData && (
                      <div className="mt-4 p-4 bg-white rounded-2xl border-2 border-[#1550aa] text-left space-y-3 shadow-md max-w-lg mx-auto">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-[#1550aa] bg-blue-50 px-2 py-0.5 rounded-full">
                            Ready to restore
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{pendingImportData.sizeKb} KB</span>
                        </div>
                        <div>
                          <h5 className="font-extrabold text-sm text-[#0a1a3a]">{pendingImportData.title}</h5>
                          <p className="text-xs text-slate-500">
                            {pendingImportData.pageCount} page(s) • Backed up {pendingImportData.exportedAt}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={handleApplyImport}
                            disabled={isImporting}
                            className="flex-1 py-2 bg-[#1550aa] hover:bg-[#0a1a3a] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                          >
                            {isImporting ? 'Restoring...' : 'Open this project on the board ↵'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingImportData(null)}
                            className="py-2 px-3 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: KONTEN KHUSUS (MERMAID & KUIS) */}
              {activeTab === 'objects' && (
                <div className="space-y-4 text-left">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                    <Sparkles size={18} className="text-[#1550aa] shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Vaani Board can export concept diagrams and interactive quizzes on the board to standard structured text, ready to paste into Canva, Notion or your school LMS.
                    </p>
                  </div>

                  {/* Mindmap Export */}
                  {detected.mindmap.hasNodes && (
                    <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <GitBranch size={16} className="text-[#1550aa]" />
                        <h4 className="font-extrabold text-sm text-[#0a1a3a]">Active mind map diagram</h4>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl font-mono text-xs text-slate-800 max-h-32 overflow-y-auto custom-scrollbar border border-slate-200">
                        {exportMindmapToMermaid(activeMindmapNodes)}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const code = exportMindmapToMermaid(activeMindmapNodes);
                            navigator.clipboard.writeText(code);
                            setCopiedMermaid(true);
                            toast.success('Mermaid syntax copied!');
                            setTimeout(() => setCopiedMermaid(false), 2000);
                          }}
                          className="px-3 py-1.5 bg-[#1550aa] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedMermaid ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedMermaid ? 'Copied' : 'Copy Mermaid code'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!detected.mindmap.hasNodes && (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-slate-200/70 text-slate-400 flex items-center justify-center">
                        <GitBranch size={20} />
                      </div>
                      <div className="font-bold text-slate-700 text-sm">No mind map on the active page yet</div>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Create a concept map with the AI in the chat tab to see Mermaid export options here.
                      </p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ExportDialog;
