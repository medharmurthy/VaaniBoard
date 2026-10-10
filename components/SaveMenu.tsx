import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { 
  Save, HardDrive, FileJson, FilePlus, ChevronDown, Check,
  History, Settings, Sparkles, Clock, ArrowRight, CornerDownLeft, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../utils/translations';
import { toast } from '../utils/toast';
import { downloadFile } from '../utils/smartExport';

interface SaveMenuProps {
  onExportClick: () => void;
}

export const SaveMenu: React.FC<SaveMenuProps> = ({ onExportClick }) => {
  const { t } = useTranslation();
  const { 
    currentSessionId, sessions, pages, currentPageIndex, 
    domElements, activeMindmapNodes, saveCurrentSession, 
    createNewSession, toggleHistory 
  } = useStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isSavedDone, setIsSavedDone] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentSessionId) {
      const session = sessions.find(s => s.id === currentSessionId);
      if (session) {
        setTitle(session.title || 'Untitled board');
        setLastSavedTime(new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } else {
      setTitle('Lesson board');
    }
  }, [currentSessionId, sessions, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick save to browser local database (IndexedDB)
  const handleSaveToDb = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsSaving(true);
    try {
      await saveCurrentSession(title);
      setIsSaving(false);
      setIsSavedDone(true);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedTime(timeStr);
      toast.success(`Board "${title}" saved locally.`);
      setTimeout(() => setIsSavedDone(false), 2500);
    } catch (err: any) {
      setIsSaving(false);
      toast.error('Could not save to the local database: ' + (err.message || ''));
    }
  };

  // Download project file (.trido) directly to disk
  const handleSaveToDisk = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const exportData = {
        app: 'trido',
        version: '1.0.0',
        exportedAt: Date.now(),
        title: title || 'Project board',
        pages: pages,
        currentPageIndex,
        domElements,
        messages: useStore.getState().messages,
        lessonPlan: useStore.getState().lessonPlan
      };

      const safeName = (title || 'vaani_board').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      downloadFile(JSON.stringify(exportData, null, 2), `${safeName}_${Date.now()}.trido.json`, 'application/json');
      toast.success(`Backup file "${safeName}.trido" saved to this device.`);
      setIsOpen(false);
    } catch (err: any) {
      toast.error('Could not save the file to this device.');
    }
  };

  const handleNewSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (title || currentSessionId) {
      saveCurrentSession(title).then(() => {
        createNewSession();
        setIsOpen(false);
        toast.info('A new board is ready.');
      });
    } else {
      createNewSession();
      setIsOpen(false);
      toast.info('A new board is ready.');
    }
  };

  return (
    <div className="relative font-sans" ref={menuRef}>
      {/* Top Bar Trigger Button */}
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)} 
        className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900 border border-slate-200/80 bg-white/80 hover:bg-white backdrop-blur rounded-full transition-all shadow-xs active:scale-95 cursor-pointer"
        title="Save the board session locally (Ctrl+S)"
      >
        <Save size={16} className={isSaving ? "animate-pulse text-[#1550aa]" : isSavedDone ? "text-emerald-600" : "text-[#1550aa]"} /> 
        <span className="hidden md:inline">{isSavedDone ? 'Saved' : t('save', 'Save')}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Mobile view simple trigger button */}
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)} 
        className="flex sm:hidden p-2.5 text-slate-700 hover:text-slate-900 border border-slate-200/80 bg-white/80 hover:bg-white backdrop-blur rounded-full transition-all shadow-xs active:scale-95 cursor-pointer"
        title="Save"
      >
        <Save size={18} className="text-[#1550aa]" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 overflow-hidden"
          >
            {/* Header: Title Editor */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Lesson board name
                </label>
                {lastSavedTime && (
                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock size={10} /> {lastSavedTime}
                  </span>
                )}
              </div>

              <div className="flex items-center bg-white border border-slate-300 rounded-xl px-3 py-1.5 focus-within:border-[#1550aa] focus-within:ring-2 focus-within:ring-[#1550aa]/15 transition-all">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter lesson title…"
                  className="w-full text-xs font-bold text-slate-800 outline-hidden bg-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveToDb();
                  }}
                />
              </div>
            </div>

            {/* Save Options */}
            <div className="p-2.5 space-y-1.5 text-xs">
              {/* Option 1: Save to Browser DB */}
              <button 
                type="button"
                onClick={handleSaveToDb}
                disabled={isSaving}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1550aa] flex items-center justify-center shrink-0">
                    <HardDrive size={16} />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                      <span>Save ke Database Laptop</span>
                      {isSavedDone && <Check size={13} className="text-emerald-600" />}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      Browser storage • Quick to reopen
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  Ctrl+S
                </span>
              </button>

              {/* Option 2: Download .trido file to local disk */}
              <button 
                type="button"
                onClick={handleSaveToDisk}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileJson size={16} />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-800">
                      Download project file (.trido)
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      Save to a USB drive or teacher's documents
                    </div>
                  </div>
                </div>
              </button>

              {/* Option 3: Export Hub (PNG, PDF, SVG, Preview) */}
              <button 
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onExportClick();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1550aa] flex items-center justify-center shrink-0">
                    <Download size={16} />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-800">
                      Export images & PDF
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      PNG (1x/2x/4K), A4 PDF, SVG & preview
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400" />
              </button>

              <div className="h-px w-full bg-slate-100 my-1" />

              {/* Option 3: View History */}
              <button 
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  toggleHistory();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-blue-50/70 border border-transparent hover:border-blue-200 transition-all cursor-pointer text-left text-slate-700 hover:text-[#1550aa]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <History size={16} />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-800">
                      Open board history
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {sessions.length} saved lesson sessions
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400" />
              </button>

              {/* Option 4: New Whiteboard */}
              <button 
                type="button"
                onClick={handleNewSession}
                className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-pointer text-left text-slate-700 font-bold"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <FilePlus size={16} />
                </div>
                <span>New whiteboard</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SaveMenu;
