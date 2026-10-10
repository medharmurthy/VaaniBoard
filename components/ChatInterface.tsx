import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { useGeminiBrain } from '../hooks/useGeminiBrain';
import { CreatorTool } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { AiServiceError } from '../services/aiService';
import {
  MousePointer2, Pencil, Type, Square, Circle, Trash2, Triangle, PaintBucket,
  Mic, Image as ImageIcon, Send, Layers, ChevronUp, ChevronDown, X, AlertCircle,
  Activity, Cpu, MessageSquare, Sun, Moon, Minus, Plus, Maximize, ChevronLeft, ChevronRight, Undo2, Redo2, Sparkles, Network, Star,
  Square as StopIcon,
  CircleStop,
  Loader2,
  FileText, Clock, MoreHorizontal, PencilRuler, HelpCircle, Users, Settings, CheckSquare
} from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';
import { FileUploadButton } from './FileUploadButton';
import { AttachedDocumentBadge } from './AttachedDocumentBadge';
import { DrawingToolbar } from './DrawingToolbar';
import { sounds } from '../utils/sounds';
import { useTranslation } from '../utils/translations';
import { toast } from '../utils/toast';
import { useAiStatus } from '../hooks/useAiStatus';
import { localizeWarning, resolveSpeechLanguage } from '../utils/warningLanguage';

interface ChatInterfaceProps {
  canvasRef: React.MutableRefObject<any>;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ canvasRef }) => {
  const { t, language } = useTranslation();
  const warningLanguage = useStore(state => state.warningLanguage);
  const [input, setInput] = useState('');
  const [interimInput, setInterimInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(true);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [lastShape, setLastShape] = useState<CreatorTool>('RECTANGLE');

  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) { mediaRecorderRef.current.onstop = null; if (mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop(); }
      audioStreamRef.current?.getTracks().forEach(track => track.stop());
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
    };
  }, []);



  const {
    isThinking, isActing, actionQueue, logs,
    lastUploadedImage, setLastUploadedImage, abortTask, zoom, setViewport,
    isCreatorMode, toggleCreatorMode, activeTool, setActiveTool, setBrushColor, brushColor,
    removeDomElement, agentMessage, theme, toggleTheme, undoCanvas, redoCanvas, inputMode, setInputMode,
    isShapeFilled, setShapeFilled,
    fontFamily, setFontFamily, fontSize, setFontSize,
    pages, currentPageIndex, switchPage, addPage, removePage,
    isAiDrawerOpen, isViewerUrl,
    toggleTimer, toggleCalculator, toggleNotes, toggleQuiz,
    toggleUnitConverter, togglePeriodicTable, toggleAttendance, toggleTodoList, toggleBoardSettings,
    transcribeMode, selectedVertexModel, selectedGeminiModel, selectedOllamaModel, geminiApiKey, voiceConfig,
    aiPreference
  } = useStore();

  const liveAiStatus = useAiStatus();
  const isOfflineMode = aiPreference === 'ollama' || liveAiStatus.mode === 'ollama';
  const activeModelDisplay = isOfflineMode
    ? (selectedOllamaModel || (liveAiStatus.mode === 'ollama' ? liveAiStatus.model : 'trido-model:latest') || 'trido-model:latest')
    : (aiPreference === 'vertex' || liveAiStatus.mode === 'vertex')
    ? (selectedVertexModel || 'Vertex AI')
    : (liveAiStatus.model || selectedGeminiModel || 'Gemini Cloud');
  const aiReadiness = liveAiStatus.reason === 'billing_required' ? 'AI billing required'
    : liveAiStatus.reason === 'configured_not_probed' ? 'AI configured · unverified'
    : liveAiStatus.online ? 'AI ready · last request verified' : 'AI unavailable · local tools ready';

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsTranscribing(true);
    useStore.getState().setWarningLanguage(useStore.getState().language);
    setVoiceNotice('Uploading and transcribing audio…');
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result as string;
          const storeState = useStore.getState();
          const response = await fetch('/api/voice/stt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64Audio,
              language: storeState.language || 'hi',
              engine: 'sarvam',
            })
          });

          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Sarvam transcription failed.');
          if (data.text && data.text.trim()) {
            useStore.getState().setWarningLanguage(resolveSpeechLanguage(data).warningLanguage);
            useStore.getState().setLastVoiceCommand(data.text.trim());
            setVoiceNotice(null);
            if (voiceConfig.autoSubmit) {
              handleSubmitInternal(data.text.trim(), true);
            } else {
              setInput(data.text.trim());
              useStore.getState().setChatInputText(data.text.trim());
              if (!isAiDrawerOpen) useStore.getState().toggleAiDrawer();
              toast.info('Transcript ready for review.');
            }
          } else {
            setVoiceNotice('No speech recognised. Retry or type your command.');
          }
        } catch (err: any) {
          setVoiceNotice(err.message || 'Speech service unavailable. Retry or use text input.');
        } finally {
          setIsTranscribing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsTranscribing(false);
      setVoiceNotice('Unable to read recorded audio.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let newZoom = canvas.getZoom();
    if (direction === 'in') newZoom = Math.min(newZoom * 1.1, 20);
    else if (direction === 'out') newZoom = Math.max(newZoom / 1.1, 0.01);
    else newZoom = 1;

    if (direction === 'reset') {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      canvas.setZoom(1);
    } else {
      canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, newZoom);
    }
    setViewport(newZoom, [...canvas.viewportTransform]);
  };
  const { processUserPrompt } = useGeminiBrain();

  if (isViewerUrl) {
    return (
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
        <div className="absolute bottom-4 lg:bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto z-40">
           <div className="bg-slate-900/80 backdrop-blur-md text-white text-[13px] font-medium px-4 py-2.5 rounded-2xl shadow-lg border border-white/10 flex items-center gap-3">
             <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
             <span className="tracking-wide">{t('watchingTeacher', 'You are viewing the teacher’s board')}</span>
           </div>
        </div>
      </div>
    );
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [audioVolume, setAudioVolume] = useState(0);
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(0));

  const startVisualizer = useCallback((stream: MediaStream) => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext();
      }
      const context = audioContextRef.current;
      if (context.state === 'suspended') {
        context.resume();
      }
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 128; // Higher detail for visualizer
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Boost sensitivity for visualization
        const boostedData = new Uint8Array(dataArray.length);
        for(let i=0; i<dataArray.length; i++) {
          boostedData[i] = Math.min(255, dataArray[i] * 2);
        }
        setAudioData(boostedData);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setAudioVolume(average);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (e) {
      console.error("Visualizer setup failed:", e);
    }
  }, []);

  const stopVisualizer = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().then(() => {
        audioContextRef.current = null;
      });
    }
    setAudioVolume(0);
    setAudioData(new Uint8Array(0));
  }, []);

  useEffect(() => {
    return () => {
      stopVisualizer();
    };
  }, [stopVisualizer]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, agentMessage]);

  const handleVoiceToggle = async () => {
    if (isListening) {
      setIsListening(false);
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      stopVisualizer();
      if (mediaRecorderRef.current?.state === 'recording') {
        setIsTranscribing(true); mediaRecorderRef.current.stop();
      }
      return;
    }
    if (transcribeMode === 'upload_audio') { audioUploadInputRef.current?.click(); return; }
    useStore.getState().setWarningLanguage(useStore.getState().language);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceNotice('Microphone recording is unavailable. Open localhost/HTTPS or use text input.'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:voiceConfig.echoCancellation,noiseSuppression:voiceConfig.noiseSuppression,autoGainControl:voiceConfig.autoGainControl}});
      audioStreamRef.current = stream;
      setMicPermission('granted'); setVoiceNotice(null); setIsListening(true);
      setInput(''); setInterimInput(''); chunksRef.current=[]; startVisualizer(stream); sounds.play('mic_on');
      const mimeType=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
      const recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined);mediaRecorderRef.current=recorder;
      recorder.ondataavailable=e=>{if(e.data.size)chunksRef.current.push(e.data);};
      recorder.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());audioStreamRef.current=null;
        if(autoStopTimerRef.current)clearTimeout(autoStopTimerRef.current);
        setIsListening(false);setIsTranscribing(true);stopVisualizer();
        const blob=new Blob(chunksRef.current,{type:recorder.mimeType||'audio/webm'});
        const reader=new FileReader();
        reader.onloadend=async()=>{
          try {
            const response=await fetch('/api/voice/stt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base64Audio:reader.result,language:useStore.getState().language,engine:'sarvam'})});
            const result=await response.json();
            if(!response.ok)throw new Error(result.error||'Sarvam transcription failed.');
            if(!result.text?.trim())throw new Error('No speech recognised. Retry or type your command.');
            useStore.getState().setWarningLanguage(resolveSpeechLanguage(result).warningLanguage);
            useStore.getState().setLastVoiceCommand(result.text.trim());
            if(voiceConfig.autoSubmit)handleSubmitInternal(result.text.trim(), true);
            else {setInput(result.text.trim());useStore.getState().setChatInputText(result.text.trim());if(!isAiDrawerOpen)useStore.getState().toggleAiDrawer();}
          } catch(error) {const msg=error instanceof Error?error.message:'Sarvam unavailable. Use text input.';setVoiceNotice(msg);toast.warning(msg);}
          finally {setIsTranscribing(false);}
        };
        reader.onerror=()=>{setIsTranscribing(false);setVoiceNotice('Unable to read recorded audio.');};
        reader.readAsDataURL(blob);
      };
      recorder.start();
      autoStopTimerRef.current=setTimeout(()=>{if(recorder.state==='recording'){setIsListening(false);setIsTranscribing(true);stopVisualizer();recorder.stop();}},25000);
    } catch {audioStreamRef.current?.getTracks().forEach(t=>t.stop());setIsListening(false);setMicPermission('denied');setVoiceNotice('Allow microphone permission, or use text input.');}
  };

  const handleSendVoice = () => { if (isListening) void handleVoiceToggle(); };

  const handleCanvasImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      useStore.getState().addLog(`Image added to canvas: ${file.name}`);

      if (canvasRef.current) {
        window.fabric.Image.fromURL(base64, (img: any) => {
          const id = `img_${Date.now()}`;
          img.scaleToWidth(250);
          img.set({
            left: window.innerWidth/2, top: window.innerHeight/2, originX: 'center', originY: 'center', id: id,
            cornerColor: '#00f0ff', cornerSize: 10, transparentCorners: false
          });
          canvasRef.current.add(img);
          canvasRef.current.requestRenderAll();
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmitInternal(input);
  };

  const handleSubmitInternal = async (text: string, fromVoice = false) => {
    if (!fromVoice && text.trim() !== useStore.getState().lastVoiceCommand) useStore.getState().setWarningLanguage(useStore.getState().language);
    const attachedDoc = useStore.getState().attachedDocument;
    const defaultPrompt = attachedDoc 
      ? (attachedDoc.category === 'image' 
          ? t('pleaseAnalyzeImage', 'Please analyse this image.')
          : t('pleaseAnalyzeDocument', 'Please analyse this document and summarise its key points on the board.'))
      : (useStore.getState().lastUploadedImage ? t('pleaseAnalyzeImage', 'Please analyse this image.') : '');
    const finalTxt = text.trim() || defaultPrompt;
    if (!finalTxt || isThinking) return;
    setInput('');
    useStore.getState().addMessage({ role: 'user', text: finalTxt });
    await processUserPrompt(finalTxt, canvasRef);
  };

  const handleDeleteSelection = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj: any) => {
        canvas.remove(obj);
        if (obj.isDomPlaceholder) removeDomElement(obj.id);
      });
      canvas.discardActiveObject().requestRenderAll();
      useStore.getState().addLog(`Deleted ${activeObjects.length} object(s).`);
    }
  };

  const isBusy = isThinking || isActing || actionQueue.length > 0;

  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const ToolBtn = ({ tool, icon: Icon, isAction, onClick, className = '' }: { tool?: CreatorTool, icon: any, isAction?: boolean, onClick?: () => void, className?: string }) => {
    const isActive = tool && activeTool === tool;
    return (
      <motion.button
        whileHover={{ scale: isActive ? 1.05 : 1.02, backgroundColor: isActive ? '' : 'rgb(241 245 249)' }}
        whileTap={{ scale: 0.92 }}
        onClick={() => {
          if (tool) setActiveTool(tool);
          if (onClick) onClick();
        }}
        className={`flex items-center justify-center w-9.5 h-9.5 lg:w-10.5 lg:h-10.5 rounded-xl lg:rounded-[1.1rem] transition-colors ${
          isActive
            ? 'text-white bg-blue-600 shadow-[0_8px_16px_rgba(37,99,235,0.25)] ring-4 ring-blue-600/10'
            : 'text-slate-500 hover:text-blue-600'
        } ${className}`}
      >
        <Icon size={isActive ? 20 : 18} strokeWidth={isActive ? 2.5 : 2} />
      </motion.button>
    );
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">

      {/* Left Drawing Toolbar */}
      <DrawingToolbar
        canvasRef={canvasRef}
        onImageUpload={() => document.getElementById('canvas-upload')?.click()}
        onDeleteSelection={handleDeleteSelection}
        onZoom={handleZoom}
      />
      <input id="canvas-upload" type="file" className="hidden" accept="image/*" onChange={handleCanvasImageUpload} />

      {/* ====== BOTTOM CONTROLS ====== */}
      <div className="absolute bottom-4 lg:bottom-6 left-3 lg:left-6 right-3 lg:right-6 pointer-events-none flex flex-col md:flex-row items-center md:items-end md:justify-between z-40 gap-4">

        {/* Left: Empty for flex space */}
        <div className="flex-1 hidden md:block"></div>

        {/* Center: AI Status & Voice Control */}
        <div data-board-occluder="true" className="relative flex max-w-full flex-col items-center gap-2">

          {/* Persistent Voice Notice / Error Banner */}
          <AnimatePresence>
            {voiceNotice && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="pointer-events-auto w-[min(90vw,480px)] bg-amber-50/95 backdrop-blur-md rounded-2xl border border-amber-200/90 shadow-lg p-3 text-xs text-amber-900 flex items-start gap-2.5 z-50 mb-1"
              >
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">
                  {localizeWarning(voiceNotice, warningLanguage)}
                </div>
                <button
                  onClick={() => setVoiceNotice(null)}
                  className="text-amber-500 hover:text-amber-800 p-0.5 rounded cursor-pointer transition-colors"
                  title="Close"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Transcript bubble — expands UPWARD above the bar */}
          <AnimatePresence>
            {isListening && showTranscript && (input || interimInput || voiceNotice) && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95, pointerEvents: 'none' }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="pointer-events-auto w-[min(88vw,520px)] bg-white/97 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-blue-100 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    Transkripsi
                  </span>
                  <button
                    onClick={() => setShowTranscript(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    title="Sembunyikan"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto">
                  <p className="text-[13.5px] leading-relaxed text-slate-800">
                    {input}
                    {interimInput && <span className="text-slate-400 italic"> {interimInput}</span>}
                    {voiceNotice && !input && !interimInput && <span className="text-amber-600">{voiceNotice}</span>}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Show-transcript button when collapsed */}
          <AnimatePresence>
            {isListening && !showTranscript && (input || interimInput) && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setShowTranscript(true)}
                className="pointer-events-auto text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
              >
                <ChevronUp size={12} /> Tampilkan transkripsi
              </motion.button>
            )}
          </AnimatePresence>

          {/* Voice island bar — stays compact, never stretches sideways */}
          <AnimatePresence>
            {!isAiDrawerOpen && (
              <motion.div
                 initial={{ opacity: 0, y: 20, scale: 0.95 }}
                 animate={{ opacity: 1, y: 0, scale: 1 }}
                 exit={{ opacity: 0, y: 20, scale: 0.95, pointerEvents: 'none' }}
                 transition={{ type: "spring", stiffness: 400, damping: 25 }}
                 className="voice-control-dock pointer-events-auto flex max-w-full items-center gap-2 sm:gap-3 px-3 py-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200 origin-bottom"
              >
                 <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className={`hidden sm:flex items-center justify-center text-blue-600 transition-all ${isListening ? '' : 'w-11 h-11 rounded-[1.2rem] bg-blue-50/80 border border-blue-100 shadow-sm'}`}>
                       {isListening ? <AudioVisualizer isListening={isListening} audioData={audioData} /> :
                        isThinking ? <Loader2 size={20} className="animate-spin" /> :
                        isTranscribing ? <Activity size={20} className="animate-pulse" /> :
                        <Sparkles size={20} />}
                    </div>
                    <div className="flex min-w-0 flex-col">
                       <span className="text-xs sm:text-[13.5px] font-bold text-slate-800 leading-tight truncate">
                         {isThinking ? `${t('processingWithModel', 'Processing with AI…')} (${activeModelDisplay})` :
                          isTranscribing ? t('transcribingVoice', 'Transcribing…') :
                          isListening ? 'Recording with Sarvam…' :
                          voiceNotice ? '⚠️ Perhatian' :
                          aiReadiness}
                       </span>
                       <span className="text-[11px] font-medium text-slate-500 flex min-w-0 items-center gap-1.5 mt-0.5 whitespace-nowrap overflow-hidden">
                         {isListening || isThinking ? (
                            <span className="flex gap-1.5 items-center">
                              <span className={isOfflineMode ? "text-emerald-600 font-bold" : "text-blue-600 font-bold"}>
                                {activeModelDisplay} • {isOfflineMode ? 'Local AI (Ollama)' : liveAiStatus.mode === 'cline' ? 'Cline credits' : 'Cloud AI'}
                              </span>
                              <div className="flex gap-1">
                                <div className={`w-1.5 h-1.5 ${isOfflineMode ? 'bg-emerald-500' : 'bg-blue-500'} rounded-full animate-bounce`} />
                                <div className={`w-1.5 h-1.5 ${isOfflineMode ? 'bg-emerald-500' : 'bg-blue-500'} rounded-full animate-bounce`} style={{animationDelay: '0.1s'}} />
                                <div className={`w-1.5 h-1.5 ${isOfflineMode ? 'bg-emerald-500' : 'bg-blue-500'} rounded-full animate-bounce`} style={{animationDelay: '0.2s'}} />
                              </div>
                            </span>
                         ) : voiceNotice ? (
                            <span className="text-amber-500">{voiceNotice.slice(0, 40)}{voiceNotice.length > 40 ? '…' : ''}</span>
                         ) : (
                            <span className="flex items-center gap-1.5 font-medium">
                              <span className={`w-2 h-2 rounded-full ${isOfflineMode ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                              <span className="hidden sm:inline">{activeModelDisplay}</span>
                              <span className="hidden sm:inline text-slate-400">•</span>
                              <span className={isOfflineMode ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>
                                {!liveAiStatus.online ? 'Local activities available' : isOfflineMode ? 'Local AI' : liveAiStatus.mode === 'cline' ? 'Cline credits' : t('standbyMode', 'Standby mode')}
                              </span>
                            </span>
                         )}
                       </span>
                    </div>
                 </div>

                 <div className="flex items-center gap-1.5 border-l-2 border-slate-200/60 pl-4">
                    <AttachedDocumentBadge compact className="mr-2" />
                    <FileUploadButton
                      className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-[1.2rem] transition-colors active:scale-95"
                      icon={<Plus size={22} />}
                      title={t('uploadFileOrImage', 'Upload file / document / image')}
                    />

                    <button
                      onClick={() => { setShowTranscript(true); void handleVoiceToggle(); }}
                      disabled={isTranscribing || isThinking}
                      title={isListening ? 'Stop recording and transcribe with Sarvam' : 'Record speech with Sarvam'}
                      className={`w-12 h-12 flex items-center justify-center rounded-[1.3rem] text-white shadow-lg transition-all duration-300 ${isListening ? 'bg-red-500 shadow-red-500/25 animate-pulse scale-105 ring-4 ring-red-500/10' : 'bg-blue-600 shadow-blue-600/30 hover:scale-105 hover:bg-blue-500'} disabled:opacity-50 disabled:pointer-events-none active:scale-95 shrink-0`}
                    >
                      <Mic size={20} />
                    </button>

                    {(isThinking || isActing || actionQueue.length > 0) && (
                      <button
                        onClick={() => abortTask()}
                        className="w-12 h-12 flex items-center justify-center bg-rose-50 text-red-500 rounded-[1.3rem] hover:bg-red-100 hover:text-red-600 transition-all font-bold group active:scale-95 border border-red-100 shrink-0"
                        title={t('cancelProcess', 'Cancelkan Proses')}
                      >
                        <Square size={16} className="fill-current group-hover:scale-90 transition-transform" />
                      </button>
                    )}
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Zoom Controls & History Controls */}
        <div className="pointer-events-auto flex-1 hidden md:flex justify-end gap-3">
           {/* Sleek History & Action Card */}
           <motion.div
             data-board-occluder="true"
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.5, delay: 0.05 }}
             className="flex items-center gap-1 px-2.5 py-1.5 bg-white/95 backdrop-blur-xl rounded-full border border-slate-200/80 shadow-[0_20px_40px_rgb(0,0,0,0.08)]"
           >
             <button
               onClick={() => undoCanvas()}
               title={language === 'en' ? 'Undo' : 'Undo'}
               className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-colors active:scale-90"
             >
               <Undo2 size={16} />
             </button>
             <button
               onClick={() => redoCanvas()}
               title={language === 'en' ? 'Redo' : 'Redo'}
               className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-colors active:scale-90"
             >
               <Redo2 size={16} />
             </button>
             <div className="w-px h-5 bg-slate-200/80 mx-1.5" />
             <button
               onClick={handleDeleteSelection}
               title={language === 'en' ? 'Delete Selected Element' : 'Delete selected element'}
               className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors active:scale-90"
             >
               <Trash2 size={16} />
             </button>
           </motion.div>

           {/* Zoom Controls Card */}
           <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.5, delay: 0.1 }}
             className="flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur-xl rounded-4xl shadow-[0_20px_40px_rgb(0,0,0,0.08)] border border-white/80"
           >
             <button onClick={() => handleZoom('out')} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-[1.1rem] transition-colors active:scale-95">
               <Minus size={18} />
             </button>
             <span className="text-[13.5px] font-extrabold text-slate-700 min-w-14 text-center tracking-tight">
                {Math.round(zoom * 100)}%
             </span>
             <button onClick={() => handleZoom('in')} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-[1.1rem] transition-colors active:scale-95">
               <Plus size={18} />
             </button>
             <div className="w-0.5 h-5 bg-slate-200/80 mx-1.5 rounded-full" />
             <button onClick={() => handleZoom('reset')} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-[1.1rem] transition-colors active:scale-95" title={t('fitToScreen', 'Paskan ke Layar')}>
               <Maximize size={18} />
             </button>
           </motion.div>
        </div>

        {/* Hidden Audio File Input for Audio Upload Transcribe */}
        <input
          ref={audioUploadInputRef}
          type="file"
          accept="audio/mp3,audio/wav,audio/webm,audio/ogg,audio/m4a,audio/*"
          className="hidden"
          onChange={handleAudioFileUpload}
        />
      </div>
    </div>
  );
};
