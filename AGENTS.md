<!-- ===================================================================== -->
<!-- CRITICAL REPO DIRECTIVE: DO NOT DELETE THIS FILE                      -->
<!-- This file serves as the definitive agent runbook, architecture map,  -->
<!-- and anti-thrashing execution protocol for AI agents (Hermes, Claude,  -->
<!-- Cursor, Copilot). Deleting this causes severe agent performance loss. -->
<!-- ===================================================================== -->

# Vaani Board / Trido AI Architecture & Agent Runbook (DO NOT DELETE)

## Core Architecture Map
- Constants & Defaults: `constants.ts`; provider model IDs are configurable via server environment. Vertex must use the deployer's project.
- Classroom agent: `server/cline/clineAdapter.ts` (`@cline/sdk`, custom tools only), `server/cline/classroomTools.ts`, provider routing and explicit deterministic local classroom commands.
- Curriculum: `server/rag/index.ts`, `scripts/ingest_syllabus.ts`; Class 9 NCERT PDFs and derived full index under gitignored `data/`.
- Indic voice: `server/voiceRouter.ts`, `utils/languages.ts`, `utils/reflexGrammar.ts`, `services/speechService.ts`.
- Classroom UI: `components/ClassroomPanel.tsx`, `components/fln/*`; teacher proposals are private until approval.
- Undo: `utils/boardHistory.ts` snapshots both Fabric and DOM content; `useAgentProcessor` wraps one request into one history transaction.
- Global State: `store.ts` (Zustand: active tools, pages, session history, chat messages, whiteboard canvas state)
- AI Adapters & Routing:
  - Vertex AI: `server/vertexAdapter.ts`
  - Google AI Studio: `server/geminiAdapter.ts`
  - Ollama: `server/ollamaAdapter.ts`
  - Tool Routing & Execution: `server/aiTools.ts`
  - Express API Router: `server/aiRouter.ts`
  - Vercel Serverless: `api/ai/*.ts` (generate, status, transcribe, tool-content, pull-model)
- UI Badges & Status:
  - Header Model Badge: `components/AiStatusBadge.tsx`
  - AI State Strings & Polling: `hooks/useAiStatus.ts`
  - Settings Modal: `components/SettingsView.tsx`
  - Chat Drawer: `components/ChatMessageItem.tsx` and `App.tsx`
  - Canvas Manager: `components/CanvasManager.tsx`
  - Export/Import Dialog: `components/ExportDialog.tsx`

## Strict Agent Rules (Zero-Thrashing Protocol)
1. Fast Typecheck: DO NOT run `npm run build` or full linter repeatedly during iteration. Run `npm run check` (`tsc --noEmit`) which completes in < 3 seconds.
2. Single-Pass Whole-File Reads: For files under 400-500 lines, read the entire file in one call. Never read files in disjointed 30-80 line micro-slices.
3. Batched Multi-Hunk Patches: Combine all edits for a single file into one patch call instead of multiple successive single-line patches.
4. Scoped Search First: Before editing or when investigating strings/badges, run a single scoped grep across target directories (`server/`, `api/`, `components/`, `hooks/`). Do not perform repeated blind global greps.
5. No Live Network Smoke Scripts: Do not write ad-hoc network test scripts that hit live Vertex or Gemini endpoints to verify compile-time renames. Trust `tsc --noEmit` and unit assertions.
6. Targeted Redirection: When redirected or debugging UI text, inspect `hooks/useAiStatus.ts` and `components/AiStatusBadge.tsx` first instead of broad global scans.
