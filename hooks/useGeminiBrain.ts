import React, { useCallback } from 'react';
import { useStore } from '../store';
import { AiServiceError, generateAgentActions } from '../services/aiService';
import { Point, CanvasObjectData, AgentAction, LessonPlan } from '../types';
import { CALCULATOR_TEMPLATE, TIMER_TEMPLATE } from '../services/componentTemplates';
import { createLogger } from '../utils/logger';
import { sounds } from '../utils/sounds';
import { layoutMindmap, expandMindmapNodes, findMatchingMindmapNode, NODE_STYLE_CONFIG, MindmapInputNode, MindmapLayoutNode } from '../utils/mindmapLayout';
import { matchReflex } from '../utils/reflexGrammar';
import { normalizeIndicText, detectBoardLanguage } from '../utils/indicNormalize';
import { approveClassroomProposal } from '../services/classroomActions';
import { stopSpeaking } from '../services/speechService';
import { getBoardLayoutContext, layoutCardActions } from '../utils/boardLayout';
import { localizeWarning } from '../utils/warningLanguage';

const logger = createLogger('gemini-brain');

// Global request lock to prevent overlapping calls across instances
let isProcessingGlobal = false;

// ============================================================================
// SYNTHESIZED FALLBACK TEXT (tidak bergantung pada model)
// ============================================================================
const synthesizeFallbackResponse = (calls:any[], lessonPlan:LessonPlan|null):string => calls.length ? 'Board updated. You can ask for the next activity or undo this turn.' : 'How can I help with your lesson?';

// ============================================================================
// JEV SYSTEM 1 REFLEX CLASSIFIER (<15ms INSTANT DECISION ENGINE)
// ============================================================================
export interface JevReflexResult {
  handled: boolean;
  message?: string;
  actionTaken?: string;
  lockIntent?: 'modification' | 'creation' | 'question';
  targetObjectId?: string;
}

export function evaluateJevSystemOne(
  prompt: string,
  storeState: any,
  canvas: any
): JevReflexResult {
  const reflex = matchReflex(prompt);
  if (reflex) {
    const hi = storeState.language === 'hi';
    let message = hi ? 'हो गया।' : 'Done.';
    switch (reflex.id) {
      case 'UNDO': storeState.undoCanvas?.(); message = hi ? 'पिछला काम हटा दिया।' : 'Last board action undone.'; break;
      case 'REDO': storeState.redoCanvas?.(); break;
      case 'READ_BOARD': window.dispatchEvent(new Event('vaani:read-board')); message = hi ? 'बोर्ड पढ़ रहा हूँ।' : 'Reading the board.'; break;
      case 'STOP_SPEAK': stopSpeaking(); break;
      case 'ACCEPT_PROPOSAL': {
        const p = storeState.proposals?.[0];
        if (p) approveClassroomProposal(p.id, canvas);
        else message = hi ? 'कोई सुझाव नहीं है।' : 'No suggestion to approve.';
        break;
      }
      case 'REJECT_PROPOSAL': {
        const p = storeState.proposals?.[0]; if (p) storeState.dismissProposal?.(p.id); break;
      }
      case 'TIMER': {
        const v = canvas?.viewportTransform || [1, 0, 0, 1, 0, 0];
        storeState.addAction?.({ id: crypto.randomUUID(), type: 'RENDER_HTML', status: 'PENDING', payload: {
          html: '<div>Timer</div>', componentType: 'TIMER', config: { seconds: reflex.seconds || 300, mode: 'TIMER', isRunning: true },
          x: ((canvas?.width || 1000) / 2 - v[4]) / v[0], y: ((canvas?.height || 700) / 2 - v[5]) / v[0], width: 320, height: 360,
        }}); break;
      }
      case 'ZOOM_IN': case 'ZOOM_OUT':
        if (canvas) { canvas.setZoom(Math.max(.2, Math.min(4, canvas.getZoom() * (reflex.id === 'ZOOM_IN' ? 1.25 : .8)))); canvas.requestRenderAll(); } break;
    }
    return { handled: true, actionTaken: reflex.id, message };
  }
  const norm = normalizeIndicText(prompt);
  if (/^(?:open calculator|calculator kholo)$/.test(norm)) { storeState.toggleCalculator?.(); return {handled:true,actionTaken:'TOGGLE_CALCULATOR',message:'Calculator opened.'}; }
  if (/edit|update|change|badlo|बदलो|tambah cabang|ubah/i.test(norm)) {
    const diagrams = Object.entries(storeState.domElements || {}).filter(([_, el]:any) => /MERMAID|MARKMAP/.test(el.componentType || ''));
    return {handled:false,lockIntent:'modification',targetObjectId:diagrams.at(-1)?.[0]};
  }

  return { handled: false };
}

// ============================================================================
// TOOL CALL VALIDATION & AUTO-CORRECTION
// ============================================================================
interface ToolCallError {
  tool: string;
  error: string;
  suggestedFix?: any;
}

const validateAndFixToolCall = (call: any): { valid: boolean; fixed?: any; error?: string } => {
  const args = call.args || {};
  switch (call.name) {
    case 'render_mermaid':
      if (!args.code) {
        return {
          valid: false,
          error: 'Missing required code for render_mermaid',
          fixed: { ...args, code: 'mindmap\n  root((Concept map))\n    Branch 1\n    Branch 2' }
        };
      }
      return { valid: true };

    case 'add_mindmap_node':
      if (!args.text) {
        return {
          valid: false,
          error: 'Missing required field: text',
          fixed: { ...args, text: 'Node baru' }
        };
      }
      // ✅ FIX: Match exactly what aiTools.ts defines
      const validStyles = ['MAIN_TOPIC', 'SUBTOPIC', 'DETAIL', 'HIGHLIGHT'];
      if (args.style && !validStyles.includes(args.style)) {
        return {
          valid: false,
          error: `Invalid style: ${args.style}`,
          fixed: { 
            ...args, 
            // Smart fallback based on whether it has a parent
            style: args.parentNodeText ? 'SUBTOPIC' : 'MAIN_TOPIC'
          }
        };
      }
      return { valid: true };

    case 'add_component':
      if (!args.componentType) {
        return {
          valid: false,
          error: 'Missing componentType',
          fixed: { ...args, componentType: 'MARKDOWN_NOTE' }
        };
      }
      if (args.configJson) {
        try {
          JSON.parse(args.configJson);
        } catch (_) {
          return {
            valid: false,
            error: 'Invalid configJson string',
            fixed: { ...args, configJson: '{}' }
          };
        }
      }
      return { valid: true };

    case 'modify_object':
      if (!args.objectId) {
        return {
          valid: false,
          error: 'Missing objectId for modify_object',
          fixed: null
        };
      }
      const validActions = ['MOVE_TO_GRID', 'DELETE', 'UPDATE_TEXT', 'RESIZE', 'CHANGE_COLOR', 'CHANGE_STROKE'];
      if (!args.action || !validActions.includes(args.action)) {
        return {
          valid: false,
          error: `Invalid action: ${args.action}`,
          fixed: { ...args, action: 'MOVE_TO_GRID', value: 'CENTER' }
        };
      }
      return { valid: true };

    case 'add_interactive_app':
      if (!args.html && !args.js) {
        return {
          valid: false,
          error: 'Empty interactive app code',
          fixed: { ...args, html: '<h3>Aplikasi Kustom</h3>' }
        };
      }
      return { valid: true };

    case 'add_text_label':
      if (!args.text) {
        return {
          valid: false,
          error: 'Missing text in add_text_label',
          fixed: { ...args, text: 'Label' }
        };
      }
      return { valid: true };

    default:
      return { valid: true };
  }
};

const classifyIntent = (prompt: string): 'question' | 'creation' | 'modification' | 'navigation' => {
  const modificationWords = /edit|delete|move|update|change|drag|reposition|align|badlo|hatao|बदलो|हटाओ/i;
  const creationWords = /create|draw|add|write|generate|arrow|line|connect|shape|mind.?map|diagram|quiz|game|visual|banao|dikhao|बनाओ|दिखाओ/i;
  const navigationWords = /pergi|go|zoom|pan|navigasi|navigate|ke halaman|page/i;
  const questionWords = /(apa|bagaimana|mengapa|kapan|siapa|berapa|what|how|why|when|who|jelaskan|terangkan)/i;

  // If prompt explicitly asks to create or draw visual artifacts, prioritize creation even if it contains questions
  if (creationWords.test(prompt)) return 'creation';
  if (modificationWords.test(prompt)) return 'modification';
  if (navigationWords.test(prompt)) return 'navigation';
  if (questionWords.test(prompt.trim())) return 'question';
  return 'creation'; // default
};

interface ParsedLesson {
  isLessonStart: boolean;
  subject?: string;
  topic?: string;
  gradeLevel?: string;
}

const detectLessonStart = (prompt: string): ParsedLesson => {
  const subjectMap: Record<string,string> = {science:'Science',maths:'Mathematics',math:'Mathematics',evs:'EVS',hindi:'Hindi',english:'English','विज्ञान':'Science','गणित':'Mathematics'};
  const gradePattern = /(?:class|grade|कक्षा)\s*(\d+)/i;
  const lessonStartWords = /^(aaj|today|teach|lesson about|आज)/i;
  const subjectPattern = new RegExp(Object.keys(subjectMap).join('|'), 'i');
  
  const hasLessonStart = lessonStartWords.test(prompt.trim());
  const hasSubject = subjectPattern.test(prompt);
  const gradeMatch = prompt.match(gradePattern);
  
  if (!hasLessonStart && !hasSubject) {
    return { isLessonStart: false };
  }
  
  // Extract subject
  let detectedSubject = 'General';
  for (const [key, value] of Object.entries(subjectMap)) {
    if (prompt.toLowerCase().includes(key)) {
      detectedSubject = value;
      break;
    }
  }
  
  // Extract grade
  let detectedGrade = '';
  if (gradeMatch) {
    detectedGrade = `Class ${gradeMatch[1] || ''}`.trim();
    if (prompt.toLowerCase().includes('sd')) detectedGrade += ' SD';
    if (prompt.toLowerCase().includes('smp')) detectedGrade += ' SMP';
    if (prompt.toLowerCase().includes('sma')) detectedGrade += ' SMA';
  }
  
  // Extract topic cleanly from the first line or sentence to prevent bloated topic strings
  const firstLineOrSentence = prompt.split(/[\n.?!]/)[0];
  let topic = firstLineOrSentence
    .replace(subjectPattern, '')
    .replace(gradePattern, '')
    .replace(lessonStartWords, '')
    .replace(/kelas|hari ini|materi|topik|untuk/gi, '')
    .trim();
  
  if (!topic || topic.length < 3) {
    topic = prompt.split('\n')[0].slice(0, 60).trim();
  } else if (topic.length > 70) {
    topic = topic.slice(0, 70).trim() + '...';
  }
  
  return {
    isLessonStart: true,
    subject: detectedSubject,
    topic: topic || 'Lesson topic',
    gradeLevel: detectedGrade || 'Not specified'
  };
};

export const useGeminiBrain = () => {
  const { setThinking, addAction, addLog, addMessage, setAgentMessage } = useStore();
  const isProcessingRef = React.useRef(false); // Ref Lock

  const processUserPrompt = useCallback(async (
    prompt: string,
    canvasRef: React.MutableRefObject<any>
  ) => {
    const entryState = useStore.getState();
    if (prompt.trim() !== entryState.lastVoiceCommand?.trim()) entryState.setWarningLanguage(entryState.language);
    const overrideLanguage = detectBoardLanguage(prompt);
    if (overrideLanguage) useStore.getState().setBoardLanguage(overrideLanguage);
    if (/nipun|निपुण/i.test(prompt)) useStore.getState().setLessonMode('nipun');
    // Lock guard to prevent concurrent requests
    if (isProcessingGlobal || isProcessingRef.current || useStore.getState().isActing || useStore.getState().actionQueue.length) {
       addLog('The previous request is still processing. Please wait.');
      addMessage({ 
        role: 'model', 
        text: 'Please wait while I finish the previous request.'
      });
      return;
    }

    isProcessingGlobal = true;
    isProcessingRef.current = true;

    if (!canvasRef.current) {
      isProcessingGlobal = false;
      isProcessingRef.current = false;
      return;
    }
    const canvas = canvasRef.current;
    const storeState = useStore.getState();

    // ── JEV SYSTEM 1 REFLEX GATE (Instant Classifier <15ms) ───────────
    const isJevActive = true;
    let jevLockedTargetId: string | undefined = undefined;

    if (isJevActive) {
      const jevResult = evaluateJevSystemOne(prompt, storeState, canvas);
      if (jevResult.handled) {
        sounds.play('pop');
        const reply = jevResult.message || 'Command completed.';
        addMessage({
          role: 'model',
          text: reply
        });
        setAgentMessage(reply);
        addLog(`⚡ Jev System 1 Reflex: ${jevResult.actionTaken} (<15ms)`);
        isProcessingGlobal = false;
        isProcessingRef.current = false;
        return;
      }
      if (jevResult.lockIntent === 'modification') {
        jevLockedTargetId = jevResult.targetObjectId;
      }
    }

    setThinking(true);
    sounds.play('thinking');
    addLog('Reading board context…');

    const abortController = new AbortController();
    useStore.getState().setTaskAbortController(abortController);

    const lessonDetection = detectLessonStart(prompt);
    if (lessonDetection.isLessonStart) {
      storeState.startLesson(
        lessonDetection.subject!,
        lessonDetection.topic!,
        lessonDetection.gradeLevel!
      );
      addLog(`📚 Lesson started: ${lessonDetection.subject} - ${lessonDetection.topic}`);
    }

    try {
      // --- 1. VIEWPORT CAPTURE ---
      const vpt = [...canvas.viewportTransform];
      const width = canvas.width;
      const height = canvas.height;

      const invVpt = window.fabric.util.invertTransform(vpt);
      const tl = window.fabric.util.transformPoint({ x: 0, y: 0 }, invVpt);
      const br = window.fabric.util.transformPoint({ x: width, y: height }, invVpt);

      const screenToWorld = (screenX: number, screenY: number): Point => {
        const point = window.fabric.util.transformPoint({ x: screenX, y: screenY }, invVpt);
        return { x: point.x, y: point.y };
      };

      // --- 2. CONTEXT GATHERING ---
      // 0.3x resolution — 40% fewer image tokens vs 0.5x, still sufficient for shape/text
      const dataUrl = canvas.toDataURL({
        format: 'png',
        multiplier: 0.3,
        left: tl.x, top: tl.y,
        width: br.x - tl.x, height: br.y - tl.y
      });

      const rawObjects = canvas.getObjects();
      const objectsJson: CanvasObjectData[] = rawObjects
        .map((obj: any) => {
          const inView = obj.left > tl.x - 500 && obj.left < br.x + 500 && obj.top > tl.y - 500 && obj.top < br.y + 500;
          if (!inView && rawObjects.length > 20) return null;

          const baseData: CanvasObjectData = {
            id: obj.id || `obj_${Math.random().toString(36).substr(2, 9)}`,
            type: obj.type,
            left: Math.round(obj.left || 0),
            top: Math.round(obj.top || 0),
            fill: typeof obj.fill === 'string' ? obj.fill : 'mixed',
            angle: Math.round(obj.angle || 0),
            width: Math.round(obj.width * (obj.scaleX || 1)),
            height: Math.round(obj.height * (obj.scaleY || 1)),
          };

          if (obj.isDomPlaceholder) {
            baseData.htmlContent = storeState.domElements[obj.id]?.html;
          } else if (obj.svgSource) {
            baseData.svgContent = obj.svgSource;
          } else if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
            baseData.textContent = obj.text;
          } else if (obj.type === 'group' && typeof obj.getObjects === 'function') {
            for (const inner of obj.getObjects()) {
              if ((inner.type === 'i-text' || inner.type === 'text' || inner.type === 'textbox') && inner.text) {
                baseData.textContent = inner.text;
                break;
              }
            }
          }
          return baseData;
        })
        .filter(Boolean);

      // --- 3. AI REQUEST ---
      const intent = classifyIntent(prompt);
      const currentStoreState = useStore.getState();
      const { lessonPlan, activeMindmapNodes, attachedDocument } = currentStoreState;

      // Build document context if user attached a document/PDF/file
      const docContextStr = attachedDocument ? `
[ATTACHED FILE/DOCUMENT: ${attachedDocument.name}]
[TYPE: ${attachedDocument.category.toUpperCase()} | SIZE: ${(attachedDocument.size / 1024).toFixed(1)} KB${attachedDocument.pageCount ? ` | PAGES: ${attachedDocument.pageCount}` : ''}${attachedDocument.wordCount ? ` | WORDS: ${attachedDocument.wordCount}` : ''}]
--- DOCUMENT CONTENT START ---
${attachedDocument.text.slice(0, 120000)}
--- DOCUMENT CONTENT END ---
NOTE: The user has attached this document. Use its factual details, structure, and text to fulfill their request (such as answering questions, generating whiteboard mindmaps, summaries, diagrams, or explanations).
` : '';

      // Build lesson context string
      const lessonContextStr = lessonPlan 
        ? `
LESSON CONTEXT:
- Subject: ${lessonPlan.subject}
- Topic: ${lessonPlan.topic}  
- Grade: ${lessonPlan.gradeLevel}
- Current Phase: ${lessonPlan.phase}
- Completed: ${lessonPlan.completedSteps.length} steps done
`
        : '';

      // Build existing mindmap context
      const mindmapContextStr = activeMindmapNodes.length > 0
        ? `
EXISTING MINDMAP NODES (DO NOT RECREATE THESE):
${activeMindmapNodes.map(n => 
  `- "${n.text}" (${n.style})${n.parentNodeText ? ` → child of "${n.parentNodeText}"` : ' → ROOT'}`
).join('\n')}

INSTRUCTIONS FOR CONTINUING / EXPANDING / MODIFYING MINDMAP:
- To EXPAND / CONTINUE this mindmap: call add_mindmap_node with text and parentNodeText set to the exact branch/node to extend.
- To MODIFY a node: call modify_object with elementText (e.g. UPDATE_TEXT, CHANGE_COLOR) or drag_element.
- To TIDY UP or REDESIGN layout: call relayout_mindmap.
- To CREATE NEW mindmap: previous mindmap nodes will be cleared first.
`
        : '';

      const isLongPrompt = prompt.length > 200 || prompt.includes('\n') || prompt.split(/\s+/).length > 30;
      const longPromptDirective = isLongPrompt ? `
[MULTI-STEP / LONG PROMPT DIRECTIVE]
The user provided a detailed, multi-step, or structured request.
1. Fulfill EVERY item, question, and visual requirement specified in the user message.
2. Do not stop after the first step or truncate output; deliver both complete textual explanation and all required visual tool calls.
3. Use clear markdown formatting with headings and bullet points.
` : '';

      const jevDirective = jevLockedTargetId ? `
[JEV SYSTEM 1 DECISION: IN-PLACE MUTATION ONLY]
Target Component ID: "${jevLockedTargetId}".
DO NOT create a new widget. Call update_component targeting "${jevLockedTargetId}" with the updated code.
` : '';

      const enrichedPrompt = `
${docContextStr}
${longPromptDirective}
${lessonContextStr}
${mindmapContextStr}
${jevDirective}
[USER INTENT: ${intent.toUpperCase()}]
[USER MESSAGE]: ${prompt}
`.trim();

      const forceTools = intent === 'creation' || intent === 'modification';

      const lessonContextObj = lessonPlan ? {
        subject: lessonPlan.subject,
        topic: lessonPlan.topic,
        gradeLevel: lessonPlan.gradeLevel,
        phase: lessonPlan.phase,
        existingMindmapNodes: activeMindmapNodes.map(n => n.text),
        completedSteps: lessonPlan.completedSteps
      } : undefined;

      const inputDocMedia = storeState.attachedDocument?.dataUrl || storeState.lastUploadedImage;

      const expConfig = storeState.experimentalConfig;
      const historyDepth = (expConfig?.enabled && expConfig?.breakTheLimitAi !== false) ? 20 : 8;

      const _aiResult = await generateAgentActions(
        enrichedPrompt,
        dataUrl,
        objectsJson,
        { width: br.x - tl.x, height: br.y - tl.y },
        inputDocMedia,
        storeState.messages.slice(-historyDepth).map(m => ({ role: m.role, text: m.text })),
        { current: storeState.currentPageIndex, total: storeState.pages.length },
        storeState.domElements,
        intent,
        forceTools,
        lessonContextObj,
        abortController.signal
      );

      // Check if user clicked cancel during network generation
      if (abortController.signal.aborted || !useStore.getState().isThinking) {
        logger.info('[GeminiBrain] Task was aborted by user during AI generation. Halting pipeline.');
        return;
      }

      let functionCalls = Array.isArray(_aiResult.functionCalls) ? _aiResult.functionCalls : [];
      useStore.getState().setClassroomEngine(_aiResult.engine === 'local' ? 'Local deterministic tools' : 'Cline SDK agent');
      if (_aiResult.engine) useStore.getState().addLog(`Engine: ${_aiResult.engine} · ${(_aiResult.events || []).join(' → ')}`);
      if (Array.isArray(_aiResult.proposals)) useStore.getState().setProposals(_aiResult.proposals);
      if (Array.isArray(_aiResult.citations)) useStore.getState().setCitations(_aiResult.citations);
      const { textResponse, thought } = _aiResult;

      if (thought) addLog(`AI Thoughts: ${thought}`);
      useStore.getState().setAttachedDocument(null);
      useStore.getState().setLastUploadedImage(null);

      let cleanMsg = textResponse?.trim() || "";

      // Defense-in-depth: If raw JSON or markdown JSON blocks leak into textResponse, sanitize them
      if (cleanMsg.startsWith('{') || cleanMsg.startsWith('```json') || cleanMsg.includes('"functionCalls"') || cleanMsg.includes('"textResponse"') || cleanMsg.includes('json\n') || cleanMsg.includes('Salin\n{')) {
        try {
          const jsonMatch = cleanMsg.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const innerMatch = jsonMatch[0].match(/"textResponse"\s*:\s*"([\s\S]*?)(?<!\\)"/);
            if (innerMatch && innerMatch[1]) {
              cleanMsg = innerMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            } else {
              cleanMsg = cleanMsg.replace(/```(?:json)?[\s\S]*?```/gi, '').replace(/\{[\s\S]*\}/g, '').replace(/json\s+Salin\s*/gi, '').trim();
            }
          }
        } catch (_) {}
      }

      const msg = cleanMsg.trim() || synthesizeFallbackResponse(functionCalls, storeState.lessonPlan);
      const tele = _aiResult?.telemetry;
      addMessage({
        role: 'model',
        text: msg,
        telemetryId: tele?.id,
        tokens: tele?.totalTokens,
        latencyMs: tele?.latencyMs,
        costInr: tele?.costInr,
        model: tele?.model || _aiResult?.model || storeState.selectedOllamaModel || storeState.selectedGeminiModel || storeState.selectedVertexModel,
        provider: tele?.provider || _aiResult?.provider || storeState.aiPreference
      });
      setAgentMessage(msg);

      // --- 4. POST-PROCESSING PIPELINE ---

      // Stage 0: Validation & Auto-Correction
      const errors: ToolCallError[] = [];
      functionCalls = functionCalls.map((call: any) => {
        const validation = validateAndFixToolCall(call);
        if (!validation.valid) {
          errors.push({
            tool: call.name,
            error: validation.error!,
            suggestedFix: validation.fixed
          });
          logger.warn(`⚠️ AI tool call auto-corrected: ${call.name}`, {
            original: call.args,
            fixed: validation.fixed,
            reason: validation.error
          });
          if (validation.fixed) {
            return null;
          }
        }
        return call;
      }).filter(Boolean);

      if (errors.length > 0) {
        addLog(`Auto-corrected ${errors.length} AI argument errors.`);
      }

      // Stage 1: Hard cap on total calls (Break-The-Limit: 60 in experimental, 18 standard)
      const MAX_CALLS = (expConfig?.enabled && expConfig?.breakTheLimitAi !== false) ? 60 : 18;
      if (functionCalls.length > MAX_CALLS) {
        logger.warn(`[Cap] Clamping ${functionCalls.length} calls to ${MAX_CALLS}`);
        functionCalls = functionCalls.slice(0, MAX_CALLS);
      }

      // Stage 2: Deduplication
      const seenSigs = new Set<string>();
      functionCalls = functionCalls.filter(call => {
        const args = call.args || {};
        const sig = JSON.stringify({name:call.name,args});
        if (seenSigs.has(sig)) { logger.warn(`[Dedup] Skipped: ${sig}`); return false; }
        seenSigs.add(sig);
        return true;
      });

      // Stage 3: Separate mindmap nodes from other calls
      const mindmapCalls = functionCalls.filter(c => c.name === 'add_mindmap_node');
      const otherCalls = functionCalls.filter(c => c.name !== 'add_mindmap_node' && c.name !== 'connect_nodes');
      // connect_nodes is only used for non-mindmap diagrams
      let connectCalls = functionCalls.filter(c => c.name === 'connect_nodes');

      // 🛑 HARD RULE: Jika ada mindmap, buang SEMUA connect_nodes
      // (koneksi mindmap sudah auto-generate dari parentNodeText)
      if (mindmapCalls.length > 0 && connectCalls.length > 0) {
        logger.warn(`[Safety] Dropped ${connectCalls.length} connect_nodes calls (mindmap present, connections auto-generated)`);
        connectCalls = [];
      }

      // Validasi connect_nodes
      connectCalls = connectCalls.filter(c => {
        const from = (c.args?.fromNodeText || '').trim();
        const to = (c.args?.toNodeText || '').trim();
        const direction = c.args?.direction;
        const hasCoords = typeof c.args?.fromX === 'number' || typeof c.args?.toX === 'number';

        if (hasCoords || direction) return true;

        const garbageValues = ['MAIN_TOPIC', 'SUBTOPIC', 'DETAIL', 'HIGHLIGHT', 'root', '//root//'];
        if (garbageValues.includes(from.toUpperCase()) || garbageValues.includes(to.toUpperCase())) {
          logger.warn(`[Safety] Rejected placeholder connect_nodes call: "${from}" -> "${to}"`);
          return false;
        }
        return Boolean(from || to);
      });

      // ── Viewport center (world coords) ─────────────────────────────────────
      const centerX = (tl.x + br.x) / 2;
      const centerY = (tl.y + br.y) / 2;
      let lastWorldPos = { x: centerX, y: centerY };

      const getGridPos = (gridPos?: string) => {
        if (!gridPos) return lastWorldPos;
        const vWidth = br.x - tl.x;
        const vHeight = br.y - tl.y;
        const gw = vWidth / 3, gh = vHeight / 3;
        let pt = { x: tl.x + vWidth / 2, y: tl.y + vHeight / 2 };
        if (gridPos.includes('TOP')) pt.y = tl.y + gh / 2;
        if (gridPos.includes('BOTTOM')) pt.y = tl.y + vHeight - gh / 2;
        if (gridPos.includes('LEFT')) pt.x = tl.x + gw / 2;
        if (gridPos.includes('RIGHT')) pt.x = tl.x + vWidth - gw / 2;
        lastWorldPos = pt;
        return pt;
      };

      // ── ACTION QUEUES (nodes first, then connections, then everything else) ──
      const shapeActions: AgentAction[] = [];
      const pathActions: AgentAction[] = [];
      const otherActions: AgentAction[] = [];

      // ── Mind map via Mermaid Engine (Pure Interactive Diagram) ─────────────
      if (mindmapCalls.length > 0) {
        const rootCall = mindmapCalls.find(c => c.args.style === 'MAIN_TOPIC' || !c.args.parentNodeText) || mindmapCalls[0];
        const rootTitle = (rootCall.args.text || 'Concept map').replace(/["'()\[\]{}]/g, '').trim();
        
        let mermaidCode = `mindmap\n  root((${rootTitle}))\n`;
        const otherNodes = mindmapCalls.filter(c => c !== rootCall);
        
        for (const node of otherNodes) {
          const cleanText = (node.args.text || 'Branch').replace(/["'()\[\]{}]/g, '').trim();
          mermaidCode += `    ${cleanText}\n`;
        }

        otherActions.push({
          id: `action_mermaid_mindmap_${Date.now()}`,
          type: 'RENDER_HTML',
          payload: {
            html: '<div>MERMAID</div>',
            x: centerX,
            y: centerY,
            width: 760,
            height: 580,
            componentType: 'MERMAID_DIAGRAM',
            config: {
              title: `Concept map: ${rootTitle}`,
              code: mermaidCode
            }
          },
          status: 'PENDING'
        });
      }

      // ── Freeform connect_nodes (non-mindmap) ───────────────────────────────
      connectCalls.forEach((call, idx) => {
        pathActions.push({
          id: `action_conn_free_${Date.now()}_${idx}`,
          type: 'DRAW_PATH',
          payload: {
            fromNodeText: call.args.fromNodeText,
            toNodeText: call.args.toNodeText,
            fromX: call.args.fromX,
            fromY: call.args.fromY,
            toX: call.args.toX,
            toY: call.args.toY,
            direction: call.args.direction,
            lineStyle: call.args.lineStyle || 'ARROW_STRAIGHT',
            strokeColor: call.args.strokeColor || '#3B82F6',
            isArrow: call.args.isArrow !== false
          },
          status: 'PENDING'
        });
      });

      // ── All other tool calls ────────────────────────────────────────────────
      otherCalls.forEach((call, index) => {
        const args = (call.args || {}) as Record<string, any>;
        let actionType: AgentAction['type'] | null = null;
        let payload: any = {};

        if (call.name === 'draw_arrow_or_line') {
          actionType = 'DRAW_PATH';
          payload = {
            fromNodeText: args.fromText || args.fromNodeText,
            toNodeText: args.toText || args.toNodeText,
            fromX: args.fromX,
            fromY: args.fromY,
            toX: args.toX,
            toY: args.toY,
            direction: args.direction,
            lineStyle: args.lineStyle || 'ARROW_STRAIGHT',
            strokeColor: args.color || args.strokeColor || '#3B82F6',
            isArrow: args.isArrow !== false
          };

        } else if (call.name === 'add_text_label') {
          actionType = 'WRITE_TEXT';
          const pos = getGridPos(args.gridPosition);
          let fontSize = 24;
          if (args.size === 'TITLE') fontSize = 48;
          if (args.size === 'SUBTITLE') fontSize = 32;
          payload = { text: args.text, x: pos.x, y: pos.y, fontSize, color: '#000000' };

        } else if (call.name === 'update_component') {
          actionType = 'EDIT_HTML';
          let parsedUpdateConfig: any = {};
          if (args.configJson) {
            try {
              parsedUpdateConfig = typeof args.configJson === 'string' ? JSON.parse(args.configJson) : args.configJson;
            } catch (_) {
              parsedUpdateConfig = {};
            }
          }
          payload = {
            objectId: args.objectId || args.componentId,
            componentTitle: args.componentTitle,
            action: args.action || 'REPLACE',
            config: parsedUpdateConfig
          };

        } else if (call.name === 'update_mindmap_node') {
          actionType = 'MODIFY_PROPERTY';
          payload = {
            elementText: args.targetText,
            newText: args.newText,
            newStyle: args.newStyle,
            newParentNodeText: args.newParentNodeText,
            property: 'mindmap_node'
          };

        } else if (call.name === 'add_component') {
          actionType = 'RENDER_HTML';
          const pos = getGridPos(args.gridPosition);
          let html = `<div>${args.componentType}</div>`;
          let configObj: any = undefined;
          let pWidth = 450, pHeight = 400;
          let cType = args.componentType;

          if (args.configJson) {
            try {
              configObj = typeof args.configJson === 'string' ? JSON.parse(args.configJson) : args.configJson;
            } catch (e) {
              configObj = {};
            }
          }
          if (!configObj) {
            configObj = {
              title: args.title || 'Lesson notes',
              markdown: args.markdown || args.content || args.text || '',
              ...(args.questions ? { questions: args.questions } : {}),
              ...(args.seconds ? { seconds: args.seconds } : {})
            };
          }
          configObj.lang = configObj.lang || useStore.getState().boardLanguage;
          if (useStore.getState().lessonMode === 'nipun') configObj.nipunMode = true;

          if (cType === 'DOCUMENT_PAGE' || cType === 'MARKDOWN_NOTE') {
            pWidth = 660; pHeight = Math.min(640,Math.max(360,(br.y-tl.y)*0.76));
          } else if (cType === 'LABELLED_DIAGRAM') {
            pWidth = 700; pHeight = configObj.template==='digestive-system'?660:560;
          } else if (cType === 'QUIZ_MULTIPLE_CHOICE') {
            pWidth = 480; pHeight = 520;
            if (configObj?.questions && Array.isArray(configObj.questions) && configObj.questions.length > 1) {
              cType = 'QUIZ_APP';
              pWidth = 540; pHeight = 620;
            }
          } else if (cType === 'QUIZ_TRUE_FALSE') {
            pWidth = 440; pHeight = 380;
          } else if (cType === 'QUIZ_APP') {
            pWidth = 540; pHeight = 620;
          } else if (cType === 'CALCULATOR') {
            html = CALCULATOR_TEMPLATE; pWidth = 350; pHeight = 500;
          } else if (cType === 'TIMER') {
            html = TIMER_TEMPLATE(configObj?.seconds || 300); pWidth = 300; pHeight = 250;
          } else if (cType === 'ATTENDANCE' || cType === 'PRESENSI') {
            pWidth = 440; pHeight = 520;
          } else if (cType === 'TODOLIST') {
            pWidth = 380; pHeight = 480;
          } else if (cType === 'MARKMAP_MINDMAP' || cType === 'MERMAID_DIAGRAM') {
            pWidth = 680; pHeight = 540;
          }

          payload = { html, x: pos.x, y: pos.y, width: pWidth, height: pHeight, componentType: cType, config: configObj };

        } else if (call.name === 'render_markmap') {
          actionType = 'RENDER_HTML';
          const pos = getGridPos(args.gridPosition || 'CENTER');
          payload = {
            html: '<div>MERMAID</div>',
            x: pos.x,
            y: pos.y,
            width: 720,
            height: 560,
            componentType: 'MERMAID_DIAGRAM',
            config: {
              title: args.title || 'Concept map',
              markdown: args.markdown
            }
          };

        } else if (call.name === 'render_mermaid') {
          actionType = 'RENDER_HTML';
          const pos = getGridPos(args.gridPosition || 'CENTER');
          payload = {
            html: '<div>MERMAID</div>',
            x: pos.x,
            y: pos.y,
            width: 720,
            height: 560,
            componentType: 'MERMAID_DIAGRAM',
            config: { title: args.title || 'Diagram', code: args.code, lang: useStore.getState().boardLanguage, citations: _aiResult.citations || [] }
          };

        } else if (call.name === 'mark_attendance') {
          const doms = useStore.getState().domElements;
          const attendEntry = Object.entries(doms).find(([_, el]) => el.componentType === 'ATTENDANCE' || el.componentType === 'PRESENSI');
          if (attendEntry) {
            actionType = 'EDIT_HTML';
            const [id, el] = attendEntry;
            const students = Array.isArray(el.config?.students) ? [...el.config.students] : [];
            const idx = students.findIndex((s: any) => s.name?.toLowerCase().includes((args.studentName || '').toLowerCase()));
            if (idx >= 0) {
              students[idx] = { ...students[idx], status: args.status, note: args.note };
            } else {
              students.push({ id: `std_${Date.now()}`, name: args.studentName, status: args.status, note: args.note });
            }
            payload = { objectId: id, config: { ...el.config, students } };
          } else {
            actionType = 'RENDER_HTML';
            payload = {
              html: '<div>Attendance</div>',
              x: 960,
              y: 540,
              width: 380,
              height: 480,
              componentType: 'ATTENDANCE',
              config: {
                title: 'Class attendance',
                students: [{ id: `std_${Date.now()}`, name: args.studentName, status: args.status, note: args.note }]
              }
            };
          }

        } else if (call.name === 'spin_wheel') {
          actionType = 'RENDER_HTML';
          payload = {
            html: '<div>Random picker</div>',
            x: 960,
            y: 540,
            width: 440,
            height: 480,
            componentType: 'SPIN_WHEEL',
            config: { title: args.title || 'Random pupil picker', items: args.items }
          };

        } else if (call.name === 'plot_math_function') {
          actionType = 'RENDER_HTML';
          payload = {
            html: '<div>Graph</div>',
            x: 960,
            y: 540,
            width: 460,
            height: 440,
            componentType: 'MATH_GRAPH',
            config: { title: args.title || 'Mathematics graph', type: args.type, a: args.a, b: args.b, c: args.c }
          };

        } else if (call.name === 'update_scoreboard') {
          const doms = useStore.getState().domElements;
          const scoreEntry = Object.entries(doms).find(([_, el]) => el.componentType === 'SCOREBOARD' || el.componentType === 'PAPAN_SKOR');
          if (scoreEntry) {
            actionType = 'EDIT_HTML';
            const [id, el] = scoreEntry;
            const teams = Array.isArray(el.config?.teams) ? [...el.config.teams] : [];
            const idx = teams.findIndex((t: any) => t.name?.toLowerCase().includes((args.teamName || '').toLowerCase()));
            if (idx >= 0) {
              teams[idx] = { ...teams[idx], score: (teams[idx].score || 0) + args.deltaScore };
            }
            payload = { objectId: id, config: { ...el.config, teams } };
          } else {
            actionType = 'RENDER_HTML';
            payload = {
              html: '<div>Scoreboard</div>',
              x: 960,
              y: 540,
              width: 420,
              height: 380,
              componentType: 'SCOREBOARD',
              config: {
                title: 'Team scoreboard',
                teams: [{ name: args.teamName, score: Math.max(0, args.deltaScore) }]
              }
            };
          }

        } else if (call.name === 'pan_camera') {
          actionType = 'PAN_CAMERA';
          payload = { objectId: args.targetObjectId, direction: args.direction };

        } else if (call.name === 'modify_object') {
          if (args.action === 'MOVE_TO_GRID') {
            actionType = 'DRAG_OBJECT';
            const pos = getGridPos(args.value);
            payload = { objectId: args.objectId, elementText: args.elementText, toX: pos.x, toY: pos.y };
          } else if (args.action === 'DELETE') {
            actionType = 'DELETE_OBJECT';
            payload = { objectId: args.objectId, elementText: args.elementText };
          } else if (args.action === 'UPDATE_TEXT') {
            actionType = 'MODIFY_PROPERTY';
            payload = { objectId: args.objectId, elementText: args.elementText, property: 'text', value: args.value };
          } else if (args.action === 'CHANGE_COLOR') {
            actionType = 'MODIFY_PROPERTY';
            payload = { objectId: args.objectId, elementText: args.elementText, property: 'fill', value: args.value };
          } else if (args.action === 'CHANGE_STROKE') {
            actionType = 'MODIFY_PROPERTY';
            payload = { objectId: args.objectId, elementText: args.elementText, property: 'stroke', value: args.value };
          } else if (args.action === 'RESIZE') {
            actionType = 'RESIZE_OBJECT';
            const parts = (args.value || '').split('x');
            payload = { objectId: args.objectId, elementText: args.elementText, width: Number(parts[0]) || 400, height: Number(parts[1]) || 300 };
          } else {
            actionType = 'MODIFY_PROPERTY';
            payload = { objectId: args.objectId, elementText: args.elementText, property: 'style', value: args.value };
          }

        } else if (call.name === 'relayout_mindmap') {
          actionType = 'RELAYOUT_MINDMAP';
          payload = {
            layoutType: args.layoutType || 'RADIAL',
            centerX: args.centerX || centerX,
            centerY: args.centerY || centerY
          };

        } else if (call.name === 'reorganize_canvas') {
          actionType = 'REORGANIZE_CANVAS';
          payload = { style: args.style || 'AUTO_UNTANGLE' };

        } else if (call.name === 'drag_element') {
          actionType = 'DRAG_OBJECT';
          payload = { objectId: args.objectId, elementText: args.elementText, toX: args.toX, toY: args.toY };

        } else if (call.name === 'drag_all_elements') {
          actionType = 'DRAG_ALL_ELEMENTS';
          payload = { deltaX: args.deltaX, deltaY: args.deltaY };

        } else if (call.name === 'click_element') {
          actionType = 'CLICK_ELEMENT';
          payload = { objectId: args.objectId, elementText: args.elementText, x: args.x, y: args.y };

        } else if (call.name === 'create_shape') {
          actionType = 'CREATE_SHAPE';
          payload = {
            shapeType: args.shapeType,
            x: args.x,
            y: args.y,
            width: args.width,
            height: args.height,
            fill: args.fill,
            stroke: args.stroke || args.strokeColor,
            strokeWidth: args.strokeWidth,
            text: args.text
          };

        } else if (call.name === 'add_interactive_app') {
          actionType = 'RENDER_HTML';
          const pos = getGridPos(args.gridPosition);
          payload = {
            html: '', x: pos.x, y: pos.y, width: 800, height: 600,
            componentType: 'INTERACTIVE_APP',
            config: { html: args.html || '', css: args.css || '', js: args.js || '', title: args.title || 'Interactive App' }
          };
        }

        if (!actionType) return;
        otherActions.push({ id: `action_${Date.now()}_${index}`, type: actionType, payload, status: 'PENDING' });
      });

      // Grid anchors remain useful for text and explicit MOVE_TO_GRID. New cards
      // are sized/placed together instead of repeatedly sharing those anchors.
      const actions = layoutCardActions([...shapeActions, ...pathActions, ...otherActions], getBoardLayoutContext(canvas, useStore.getState().domElements));
      // One queue publication ensures the processor sees the complete turn.
      useStore.setState(state => ({ actionQueue: [...state.actionQueue, ...actions] }));

    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.message?.includes('dibatalkan') || !useStore.getState().isThinking) {
        logger.info('[GeminiBrain] Task was aborted cleanly by user. Suppressing error alerts.');
        return;
      }

      logger.error('Failed to process prompt', error);

      let errorMsg = 'Unable to update the board. Try again or check the AI connection.';
      if (error instanceof AiServiceError) {
        errorMsg = error.message;
      } else if (error.message?.includes('Ollama Error')) {
        errorMsg = `Local AI error: ${error.message.replace('Ollama Error: ', '')}`;
        if (error.message.includes('memory')) errorMsg += ' (Not enough system memory)';
      }

      const localizedError = localizeWarning(errorMsg, useStore.getState().warningLanguage);
      addMessage({ role: 'model', text: localizedError });
      addLog(`AI error: ${errorMsg}`);
      setAgentMessage(localizedError);
    } finally {
      useStore.getState().setTaskAbortController(null);
      setThinking(false);
      sounds.stop('thinking');
      isProcessingGlobal = false;
      isProcessingRef.current = false;
    }
  }, [setThinking, addAction, addLog, addMessage, setAgentMessage]);

  return { processUserPrompt, isProcessing: () => isProcessingGlobal || isProcessingRef.current };
};
