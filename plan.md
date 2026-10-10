# plan.md — "Vaani Board": India-first, Voice-first AI Classroom Whiteboard

> **Status:** Implementation-ready plan · **Date:** 10 Oct 2026 · **Event:** Cline AI Builder Hackathon, Round 2 (8-hour build)
> **Base:** fork of [`Ardelyo/trido`](https://github.com/Ardelyo/trido) @ `16b36ae` (Gemma 4 Good Hackathon winner), MIT licensed
> **Target repo:** `github.com/medharmurthy/Cline-AI-Hackathon`
> **Working product name:** **Vaani Board** (वाणी = "voice/speech"). Rename freely; nothing in the plan depends on the name.

---

## 0. TL;DR

We will turn Trido (a voice-controlled AI whiteboard built for an Indonesian teacher with motor disabilities) into an **India-first classroom assistant for primary teachers** in government, rural, multilingual and low-resource schools, including teachers with visual or motor disabilities.

Teachers will be able to say things like *"Board pe water cycle ka mind map banao"*, *"Assamese mein ek simple counting activity banao"* or *"Is chapter ka exercise dikhao"* and get a curriculum-aligned visual lesson on the board.

**The 6 big moves:**

| # | Move | Why it matters | Where |
|---|------|----------------|-------|
| 1 | **Use the Cline SDK (`@cline/sdk`) as the AI brain** (an `Agent` with custom tools, hooks and events). It replaces the hand-rolled single-shot Gemini/Vertex/Ollama function-calling loops. | Hackathon bonus for Cline *inside* the product. Multi-step tool use (search the syllabus, *then* draw). Provider gateway including **Sarvam** (Indic LLM), Gemini, Vertex and Ollama (offline). | `server/cline/*` (new), `server/aiRouter.ts` |
| 2 | **Remove Bahasa Indonesia and add Indian vernacular voice:** Hindi, Hinglish (code-mixed), Assamese, Bengali, Tamil, Telugu and Marathi in the MVP. The rest of the 22 scheduled languages come through config. | This is the core of "India-first". | `types.ts`, `utils/translations.ts`, `store.ts`, voice hooks, prompts |
| 3 | **Syllabus RAG:** an offline-first, chapter-aware index of NCERT/SCERT books with exercises and answer keys tagged. **The demo corpus is the public NCERT Class 9 Science + Maths books** (§8.1). Primary books slot in by config. Supports "Bring up exercise for this chapter". | Grounded, curriculum-aligned output that cites its sources. | `server/rag/*` (new), `scripts/ingest_syllabus.ts` |
| 4 | **Teaching Assistant:** builds on the teacher's explanation and answers student doubts, grounded in the syllabus with citations. The teacher approves anything before it goes on the board. | Real classroom usefulness and child safety. | `server/cline/tools/assistantTools.ts`, `components/AssistantPanel.tsx` |
| 5 | **NIPUN Bharat mode and FLN widgets:** deterministic, offline Varnamala game, counting activity and arithmetic generator. | Teachers trust correct maths and letters more than LLM-generated HTML. | `components/fln/*`, `data/` (new) |
| 6 | **Accessibility-first voice ops:** read the board aloud, numbered voice targets, undo of a whole AI turn, screen-reader announcements, high contrast. | Serves visually and motor-impaired teachers. It also fixes a **verified undo bug**. | `hooks/useBoardReader.ts`, `CanvasManager.tsx`, `useGeminiBrain.ts` |

**MVP target for the 8-hour build:** the 8 example commands from the brief all work end to end in Hindi/Hinglish. "Assamese counting" works with Assamese digits and labels. "Exercise for this chapter" works on the ingested **NCERT Class 9** Science (13 chapters) and Maths Part I (8 chapters) books. All of it runs through the Cline SDK agent. Section 13 has the hour-by-hour schedule.

---

## 1. Hackathon fit (Cline AI Builder Hackathon, Round 2)

**Problem statement (summarised from the PS PDF):** pick one real problem Indian society faces and build a working AI product in 8 hours, using Cline as the AI coding partner from first commit to last. Cline can also be built into the product itself (e.g. with the Cline SDK). Bonus points go to solutions that use Cline inside the product.

**Problem we pick (education):** *"A student studies from notes written in a language she does not think in."* A primary teacher in a government school often teaches multi-grade classes in two or more languages, with no prep time, no smart content in her language, and sometimes a disability that makes clicking, dragging and typing hard. Vaani Board lets her **speak** in her own language mix and get syllabus-aligned visuals, activities and answers in her pupils' language.

### 1.1 How we score against each criterion

| Criterion | Our evidence |
|-----------|--------------|
| Creativity & uniqueness | A voice-first board that understands Hinglish and Assamese, plus a NIPUN-mode converter and FLN games that are generated deterministically. |
| Innovation | The Cline SDK agent is the classroom brain. Syllabus RAG and the Teaching Assistant run as agent tools, and the teacher approves board changes. |
| Real-world usefulness | Built for government school realities: offline Tier-0, a ₹25k laptop plus projector, multi-grade classes, NCERT/SCERT books, and teachers with disabilities. |
| **Effective use of Cline** | (a) **In the build:** Plan/Act mode, `.clinerules`, workflows, checkpoints, task history shown in the demo video. (b) **Inside the product:** `@cline/sdk` `Agent`, `createTool`, hooks, event stream, provider gateway (Sarvam, Gemini, Vertex, Ollama), and an `AgentPlugin` that also runs in Cline CLI for content teams (§5.7). |
| Product usability & execution | The 8 example commands demoed live. Large voice targets, read-aloud, undo. |
| Technical implementation | Typed tool bridge, unit tests for every new module, a RAG eval set, and a typecheck gate (`npm run check`). |

### 1.2 Mandatory deliverables (from the PS) and owners

| Deliverable | Plan section | Owner lane |
|-------------|--------------|------------|
| Public GitHub repo with a README covering problem, solution, architecture, stack, setup, **how Cline was used** | §14.3 | D |
| PPT: problem, solution, architecture, models and tools, Cline usage (build and in-product), challenges, future scope | §14.4 | D |
| **Demo video (mandatory):** real user scenario plus Cline in action during the build | §14.2 | D (recording), all (Cline screen captures) |
| Social post tagging Cline (brownie points) | §14.4 | D |

---

## 2. Current state of the repository (verified on 10 Oct 2026)

Everything in this section was checked against the code at commit `16b36ae`. `npm ci` was run, then `npm run check` (`tsc --noEmit`) exited with **0**, and `npx vitest run` passed **16 files / 110 tests**.

### 2.1 Stack

| Layer | Technology (from `package.json`) |
|-------|----------------------------------|
| Frontend | React 19, Vite 6, Tailwind 4, Zustand 5 (`store.ts`, 934 lines), Fabric.js canvas (`window.fabric`), DOM overlay widgets, Mermaid, Markmap, KaTeX, GSAP, `motion` |
| Backend | Express 5 (`server.ts`) with Vite middleware in dev, Socket.IO 4 for live rooms, `/api/ai/*` router |
| AI providers | `@google/genai` (Gemini), `@google-cloud/vertexai` (Vertex), raw HTTP to Ollama (`gemma4:e2b` / `trido-model:latest`), faster-whisper via Python subprocess |
| Validation | `zod` ^4.4.3. This is compatible with the Cline SDK's `zod ^4.3.6`. |
| Packaging | PWA (`vite-plugin-pwa`), Electron 42 (esbuild server bundle targets **node18**, which must be bumped, see §5.8), Vercel functions `api/ai/*.ts` |
| Tests | Vitest + jsdom, `tests/*.test.ts` |
| Local runtime | Node v25.2.1, npm 11.6.2, Python 3.11.9 (on the dev Mac) |

### 2.2 Request pipeline today

```
Teacher voice ──► ChatInterface.tsx / useAmbientListener.ts
   │   Web Speech API (recognition.lang = 'en-US' | 'id-ID')  OR  MediaRecorder → POST /api/ai/transcribe
   ▼                                                            (faster_whisper | gemini | vertex)
hooks/useGeminiBrain.ts
   ├─ evaluateJevSystemOne()   ← regex "System-1" reflexes (Indonesian: buka/tutup/batalkan/...)
   ├─ builds enrichedPrompt (doc context, lesson plan, mindmap nodes, intent)
   └─ services/aiService.ts → POST /api/ai/generate
                                   ▼
server/aiRouter.ts  (status probe cache, provider fallback chain, telemetry)
   └─ vertexAdapter | geminiAdapter | ollamaAdapter
        └─ buildSystemInstruction() + tools[] from server/aiTools.ts  (19 function declarations)
        └─ ONE model call → { functionCalls, textResponse, thought, usageMetadata }
                                   ▼
useGeminiBrain.ts post-processing (validate, cap, dedupe, mindmap → Mermaid, grid placement)
   └─ AgentAction queue → hooks/useAgentProcessor.ts (animated cursor, Fabric + DOM widgets)
        └─ hooks/useSocketSync.ts → students' browsers
```

**Key observation:** every provider adapter makes a **single model call**. The model cannot look something up (for example in a syllabus) and then act on what it finds. This is the main architectural gap the Cline SDK `Agent` loop closes.

### 2.3 Board tools that exist today (`server/aiTools.ts`)

`render_mermaid`, `connect_nodes`, `add_text_label`, `pan_camera`, `add_component` (QUIZ_MULTIPLE_CHOICE, QUIZ_ESSAY, QUIZ_TRUE_FALSE, QUIZ_DRAG_MATCH, FLASHCARD, CALCULATOR, TIMER, ATTENDANCE, TODOLIST, MARKDOWN_NOTE, DOCUMENT_PAGE, MARKMAP_MINDMAP, MERMAID_DIAGRAM, INTERACTIVE_APP, STEM_SIMULATION, APP_BUILDER), `update_component`, `modify_object`, `relayout_mindmap`, `reorganize_canvas`, `add_interactive_app`, `drag_element`, `drag_all_elements`, `click_element`, `create_shape`, `render_markmap`, `mark_attendance`, `spin_wheel`, `plot_math_function`, `update_scoreboard`.

We keep all of them. They become Cline SDK tools through a bridge (§5.3), so the whole client rendering pipeline stays intact.

### 2.4 Defects and risks found during inspection (fix as part of this plan)

| ID | Finding (verified) | Impact | Fix |
|----|--------------------|--------|-----|
| **BUG-1** | The reflex "undo" calls `window.__tridoUndo`, but **nothing in the codebase ever assigns it**. The only references are `hooks/useGeminiBrain.ts:110,114`. | *"Pichhla action undo karo"* currently does nothing. | Call `useStore.getState().undoCanvas()` instead (it is set by `CanvasManager.tsx:631`). See §7.4. |
| **BUG-2** | Undo history (`CanvasManager.tsx:556-631`) only snapshots **Fabric JSON**. AI widgets (mind maps, quizzes, documents) live in `domElements` and are **not** in history. | Undo after an AI-made mind map won't remove it. | Unified `{canvas, dom}` snapshots, plus "turn-level" undo that groups one AI turn into one step (§7.4). |
| SEC-1 | `DomOverlay.tsx:326,334` renders model-supplied HTML via `dangerouslySetInnerHTML`. | XSS / prompt-injection risk on a children's classroom screen. | Sanitize with an allow-list, or route through a sandboxed iframe. |
| SEC-2 | `AppBuilderTool.tsx:117` uses `sandbox="allow-scripts allow-same-origin"`. That combination lets the frame escape its sandbox. | Same as above. | Drop `allow-same-origin`. |
| SEC-3 | Vertex project ID `gemma4good-494311` is hard-coded in `constants.ts` and `api/ai/generate.ts`. | Uses the original author's GCP project. | Read only from env. Fail clearly if missing. |
| OPS-1 | The Electron server bundle targets `node18`. The Cline SDK requires **Node ≥ 22**. | Desktop build would break. | Set `target: 'node22'` in `scripts/build-electron.js`. Electron 42 ships Node 22+. |
| OPS-2 | `api/ai/generate.ts` (Vercel) duplicates the Vertex logic and ignores the Express router. | Behaviour drifts between deployments. | Re-export the shared adapter (§5.8). |
| OPS-3 | `whisperAdapter.ts` shells out to `python` (not `python3`). | Fails on machines where only `python3` exists. | Use `process.env.PYTHON_BIN \|\| 'python3'`. |

### 2.5 How deeply Indonesian is wired in (grep inventory)

Indonesian is not just a translation file. It is in prompts, reflex regexes, defaults, sample data and currency. A scoped grep for Indonesian UI words found these files (count = matching lines):

```
22 utils/translations.ts          18 components/AttendanceTool.tsx (H/I/S/A statuses, Indonesian names)
15 components/QuickGuideModal.tsx 12 hooks/useGeminiBrain.ts (reflex regexes, fallback replies)
11 App.tsx                        10 utils/smartExport.ts
10 components/landing/content.ts   9 components/SaveMenu.tsx
 8 server/aiTools.ts (system prompt, subject defaults IPA/IPS/Bahasa Indonesia, examples)
 6 store.ts (default language 'id', voice 'id-ID')   6 components/HistoryView.tsx
 5 hooks/useAmbientListener.ts (kuis/ulangan keywords, 'id-ID')
 4 ChatInterface.tsx (lang = language==='en' ? 'en-US' : 'id-ID')   4 CanvasManager.tsx
 + ~25 more components with 1–5 strings each
 + server/telemetryService.ts (USD_TO_IDR_RATE, costIdr), server/multiAgentOrchestrator.ts (keyword heuristics)
 + components/ChatMessageItem.tsx:189 (TTS hard-coded utterance.lang = 'id-ID')
 + docs/*_ID.md, NASKAH_/REVIEW_PRESENTASI_*; LICENSE header (keep: attribution required by MIT)
```

The original upstream roadmap `plan.md` (in Indonesian) has been moved to `docs/legacy/TRIDO_UPSTREAM_PLAN_ID.md` so this file can replace it.

---

## 3. Product definition

### 3.1 Personas (we design for all four and demo the first two)

| Persona | Context | Primary need | Design response |
|---------|---------|--------------|-----------------|
| **Sunita Devi**, Class 1–3, government primary school, Sitapur (UP) | Multi-grade room, 1 projector + old laptop, patchy 4G, speaks Hindi/Awadhi, English terms mixed in | "I have 3 grades at once. Give me a quick activity for each." | Hinglish voice, NIPUN mode, offline FLN widgets |
| **Rupjyoti Bora**, Class 2, Assamese-medium school, Jorhat (Assam) | Assamese textbooks (SCERT Assam), very little Assamese digital content | Activities in **Assamese script with Assamese numerals** | `as` language profile, Assamese digits ০–৯, Sarvam `as-IN` STT |
| **Mohd. Irfan**, Class 9 Science teacher, low vision *(the RAG demo persona; uses the NCERT Class 9 book)* | Uses a screen reader. Can't see what the AI drew. | "Tell me what's on the board." | Board reader, live announcements, spatial queries |
| **Lakshmi R.**, Class 3 teacher, cerebral palsy (limited hand control) | Can't drag or click small targets reliably | Do *everything* by voice | Numbered targets, voice move/resize, AI-turn undo |

### 3.2 North-star scenario (this also forms the demo script spine, §14.2)

1. The teacher opens Vaani Board, picks **Class 9 · Science · Ch 13 "Earth as a System"** from the Syllabus panel, or says *"Aaj Class 9 science ka Earth as a System wala chapter padhayenge"*. *(Demo corpus = NCERT Class 9; in production, Sunita picks her Class 3 EVS book the same way.)*
2. *"Board pe water cycle ka mind map banao."* → The agent searches the syllabus, then draws a Hindi mind map. A citation chip shows the source chapter and page.
3. *"Is chapter ka exercise dikhao."* → The textbook's exercises appear verbatim with page numbers. One tap (or *"isko quiz bana do"*) turns them into an interactive quiz.
4. A pupil asks *"Baarish kyun hoti hai?"*. Sunita says *"Ek bachche ka sawaal hai: baarish kyun hoti hai?"* → The Assistant panel proposes a 3-sentence Hindi answer, an analogy and a check question. She says *"haan, board pe daalo"*.
5. *"Is lesson ko NIPUN mode mein convert karo."* → Text is simplified to grade level, fonts get larger, and FLN practice and an oral activity are added, each tagged with a NIPUN competency.
6. *"Pichhla action undo karo."* → The whole last AI turn is removed.
7. Irfan, in the next period: *"Board par jo likha hai, use mujhe bolkar batao."* → The board is read aloud in Hindi, top to bottom.

### 3.3 Scope

| In MVP (8 hours) | Stretch (same day if time permits) | Post-hackathon |
|------------------|------------------------------------|----------------|
| Cline SDK agent behind `/api/ai/generate` (Gemini + Sarvam + Ollama providers) | SSE progress stream of agent events into `ProcessingStatusHud` | ClineCore sessions, subagents for "Lesson Pack Studio" |
| Indonesian removed; `en`, `hi`, `as`, `bn`, `ta`, `te`, `mr` UI profiles (full strings for `en` and `hi`; others fall back to `en` for chrome, while content is native) | Remaining 22 scheduled languages via config | Human-reviewed UI strings for all languages |
| Hinglish + Devanagari reflex grammar for undo, redo, read board, zoom, open/close tools | Numbered voice targets ("number 3 ko bada karo") | Wake word, switch access |
| Sarvam STT (`saaras:v4`, `codemix`), browser TTS, Sarvam TTS (`bulbul:v3`) | Bhashini TTS for Assamese | On-device Indic TTS |
| Syllabus RAG: BM25 over NCERT Class 9 Science (`iesc1`, 13 ch.) + Maths Part I (`iemh1`, 8 ch.), with exercise + answer-key extraction | Dense embeddings (hybrid) | Full Class 1–5 NCERT + SCERT Assam, teacher uploads shared per cluster |
| Teaching Assistant panel (doubt to grounded answer, then teacher approval) | Ambient "augment my explanation" suggestions | Student-device doubt submission via room link |
| NIPUN mode converter + `LETTER_GAME`, `COUNTING_ACTIVITY`, math practice generator | Labelled-diagram SVG templates (plant, water cycle) | NIPUN progress tracking per child (privacy-reviewed) |
| BUG-1/BUG-2 fixes, board reader, ARIA live announcements | High-contrast theme | Full WCAG 2.2 AA audit |

---

## 4. Target architecture

```
┌──────────────────────────── Browser / PWA / Electron (teacher laptop + projector) ─────────────────────────────┐
│ Voice: VoiceInput (push-to-talk, big button, Space key)                                                         │
│   ├─ Web Speech API (lang from LanguageProfile.bcp47, e.g. hi-IN / as-IN*)   *browser support varies           │
│   └─ MediaRecorder (Opus 16 kHz) ─────────────────────────────► POST /api/voice/stt                            │
│ utils/indicNormalize.ts  (NFC, Devanagari/Bengali digits→ASCII, loanword map माइंड मैप→mind map, synonyms)      │
│ hooks/useGeminiBrain.ts → evaluateReflex() [System-1, <15 ms, no LLM]                                          │
│      undo/redo/zoom/open-close/read-board/language-switch ─► executed locally                                 │
│      everything else ─► POST /api/ai/generate  { prompt, lang, activeChapter, lessonMode, canvas, dom }       │
│ Agent actions ► useAgentProcessor (unchanged) ► Fabric + DomOverlay widgets (+ new FLN widgets)                │
│ AssistantPanel (proposals needing approval) · SyllabusPanel (class/subject/chapter) · BoardReader (TTS + ARIA)  │
└──────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                               │ HTTP / Socket.IO (students' screens unchanged)
┌──────────────────────────────── Express server (Node ≥ 22) ──▼─────────────────────────────────────────────────┐
│ server/aiRouter.ts  ── AI_ENGINE=cline (default) ──► server/cline/clineAdapter.ts                              │
│                    └─ AI_ENGINE=legacy ───────────► existing vertex/gemini/ollama adapters (kept as fallback)  │
│                                                                                                                │
│ ┌──────────────── @cline/sdk  Agent  (one per request, stateless) ─────────────────────────────────────┐      │
│ │ providerId: gemini | vertex | sarvam | ollama | openai-compatible     (provider gateway @cline/llms)  │      │
│ │ systemPrompt: buildSystemInstruction() + Indic language policy + pedagogy rules (+ NIPUN rules)      │      │
│ │ tools:                                                                                               │      │
│ │   Board tools (bridged from aiTools.ts)  → buffered → returned as functionCalls to the client        │      │
│ │   Knowledge tools (executed server-side) → search_syllabus · get_chapter_exercises · get_nipun_targets│      │
│ │                                           generate_math_practice · get_varnamala · get_board_text    │      │
│ │   Assistant tools                        → propose_board_addition · ask_check_question               │      │
│ │ hooks: beforeTool (budget, safety, language), afterRun (telemetry INR)                               │      │
│ │ subscribe(): tool-started/finished, assistant-text-delta, usage-updated → logs (+ SSE stretch)       │      │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────────┘      │
│ server/rag/*      BM25 (+ optional embeddings) over data/syllabus/index/*.json   (offline, no new infra)     │
│ server/voice/*    Sarvam STT (saaras:v4) · Sarvam TTS (bulbul:v3) · faster-whisper (offline) · Bhashini*    │
│ data/             nipun/lakshya.json · scripts/varnamala/{hi,as,bn,...}.json · syllabus/ (gitignored PDFs) │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Design principles

1. **Keep the renderer and swap the brain.** `useAgentProcessor`, `DomOverlay` and the widgets already work. The new agent returns the same `{ functionCalls, textResponse, thought, usageMetadata }` contract that `aiRouter.ts` expects (verified at `aiRouter.ts:465-480`). The client changes are therefore small and additive.
2. **Deterministic where correctness matters.** Arithmetic, letters (Varnamala), numerals and counting come from **code and data**, not LLM-generated HTML. The LLM picks *what* to show. Code makes sure it is *right*.
3. **Grounded, then generative.** For curriculum content the agent must call `search_syllabus` first. A `beforeRun`/system rule enforces this, and it is checked in tests. Answers carry citations. With no evidence, the answer is labelled "general knowledge".
4. **Teacher in the loop.** Assistant suggestions and student doubts are *proposals*. Nothing reaches the shared board without a teacher's voice or tap confirmation.
5. **Offline-first tiers** (§11.2). Every feature degrades gracefully: cloud Indic STT, then offline Whisper, then typed input. Sarvam TTS, then browser voice, then on-screen highlight.
6. **One language model of the world.** A single `LanguageProfile` (§6.2) drives STT language, TTS voice, UI strings, board script, numerals, fonts and the prompt's language policy.

---

## 5. Cline SDK inside the product (core of the change)

### 5.1 Verified SDK facts (from npm registry and docs.cline.bot, 10 Oct 2026)

| Fact | Value / evidence |
|------|------------------|
| Package | `@cline/sdk@0.0.92`, which re-exports `@cline/core` → `@cline/agents`, `@cline/llms`, `@cline/shared` |
| Engine | `"node": ">=22"`. Our dev machine runs Node 25.2.1. |
| Primitives | `Agent` (alias of `AgentRuntime`), `createAgent`, `createTool`, `ClineCore`, `AgentPlugin`, `createBuiltinTools` |
| `Agent` config | `providerId`, `modelId`, `apiKey`, `baseUrl`, `systemPrompt`, `tools`, `toolPolicies`, `hooks`, `plugins`, `maxIterations`, `initialMessages` |
| `Agent` methods | `run(input)`, `continue(input?)`, `abort(reason?)`, `subscribe(listener)`, `restore(messages)`, `snapshot()` |
| Run input | `string \| AgentMessage \| AgentMessage[]`. Message parts include `{type:"text"}` and `{type:"image", image, mediaType}`, so **the canvas screenshot can be passed in.** |
| `createTool` | `{ name, description, inputSchema: zod \| JSON Schema, execute(input, ctx), lifecycle?: { completesRun }, executionMode?: "sequential"\|"parallel", timeoutMs?, retryable?, maxRetries? }` |
| Hooks | `beforeRun`, `afterRun`, `beforeModel`, `afterModel`, `beforeTool` (can `skip`/`stop`/rewrite `input`), `afterTool`, `onEvent` |
| Events | `run-started`, `assistant-text-delta`, `reasoning-delta`, `tool-started`, `tool-finished`, `usage-updated`, `message-added`, `run-finished`, `run-failed` |
| Result | `AgentRunResult { status, iterations, outputText, messages, usage, error? }` |
| Provider IDs (from `@cline/llms` catalog) | `gemini`, `vertex`, **`sarvam`** (models `sarvam-105b`, `sarvam-30b`; env `SARVAM_API_KEY`; base `https://api.sarvam.ai/v1`), `ollama` (default `http://localhost:11434`, key optional), `openai-compatible`, `openrouter`, `groq`, `lmstudio`, `cline` … (~200) |
| Gemma 4 | Present in the catalog (e.g. `gemma-4-26b-a4b-it`, `gemma-4-31…`), so the Gemma story from the original project carries over |
| Transcription | `@cline/llms` exports `transcribeAudio({ providerConfig, modelId, audio })`. **Caveat:** it routes through AI SDK / OpenAI-compatible transcription endpoints. Sarvam's STT is a separate REST API (`POST https://api.sarvam.ai/speech-to-text`), so we call it directly (§6.4). |
| Plugins | `AgentPlugin { name, manifest:{capabilities}, setup(api){ api.registerTool / registerRule / registerCommand }, hooks }`. Loadable by `ClineCore` (`extensions`, `pluginPaths`) and by the Cline CLI. |

> **Why `Agent` and not `ClineCore` for the request path:** `ClineCore` adds file/shell tools, workspace sessions and on-disk persistence. In a classroom server those are a liability: we must never give a model shell access on a teacher's laptop. `Agent` gives us the loop, custom tools, hooks and the provider gateway with **zero built-in tools**. We use `ClineCore` only for the optional offline "Lesson Pack Studio" (§5.7), where tool policies stay locked down.

### 5.2 Install and wire up

```bash
npm i @cline/sdk            # adds @cline/core/agents/llms/shared; zod already present
```

New env vars (append to `.env.example`):

```dotenv
# ── AI engine ────────────────────────────────────────────────────────────────
AI_ENGINE=cline                 # cline (default) | legacy  (legacy = old single-shot adapters)
CLINE_PROVIDER=gemini           # gemini | vertex | sarvam | ollama | openai-compatible
CLINE_MODEL=gemini-3.8-flash    # e.g. sarvam-105b | gemma4:e2b (ollama) | gemma-4-26b-a4b-it
CLINE_MAX_ITERATIONS=6          # agent loop cap per teacher utterance
# ── Indic voice ──────────────────────────────────────────────────────────────
SARVAM_API_KEY=                 # STT saaras:v4, TTS bulbul:v3, LLM sarvam-105b
BHASHINI_USER_ID=               # optional: Assamese TTS + any language Sarvam TTS lacks
BHASHINI_API_KEY=
BHASHINI_PIPELINE_ID=
# ── Syllabus RAG ─────────────────────────────────────────────────────────────
SYLLABUS_INDEX_DIR=data/syllabus/index
RAG_EMBEDDINGS=off              # off (BM25 only, offline) | gemini | ollama
```

### 5.3 The board-tool bridge (no client changes needed)

`server/cline/tools/boardTools.ts` turns every existing `FunctionDeclaration` in `server/aiTools.ts` into a Cline tool. Board tools **do not mutate anything on the server**. They validate, buffer the call for the client, and give the model a short receipt so it can keep reasoning ("mind map queued at CENTER").

```ts
// server/cline/tools/boardTools.ts
import { createTool, type AgentTool } from '@cline/sdk';
import { tools as boardDeclarations } from '../../aiTools';

export interface BufferedCall { name: string; args: Record<string, any> }

// Gemini-style schema (Type.OBJECT/STRING…) → JSON Schema accepted by createTool
const toJsonSchema = (s: any): any => {
  if (!s || typeof s !== 'object') return s;
  const out: any = { ...s };
  if (typeof s.type === 'string') out.type = s.type.toLowerCase();
  if (s.properties) out.properties = Object.fromEntries(
    Object.entries(s.properties).map(([k, v]) => [k, toJsonSchema(v)]));
  if (s.items) out.items = toJsonSchema(s.items);
  return out;
};

export const createBoardTools = (sink: BufferedCall[]): AgentTool[] =>
  boardDeclarations.map(decl => createTool({
    name: decl.name,
    description: decl.description,
    inputSchema: toJsonSchema(decl.parameters ?? { type: 'OBJECT', properties: {} }),
    executionMode: 'sequential',              // preserve drawing order
    async execute(input: Record<string, any>) {
      sink.push({ name: decl.name, args: input });
      return { queued: true, tool: decl.name, position: input.gridPosition ?? 'AUTO' };
    },
  }));
```

The existing `validateFunctionCalls()` (`aiTools.ts:840`) still runs on the buffered calls after the run, so `modify_object`/`update_component` ID validation is kept.

### 5.4 The Cline adapter (drop-in replacement for the provider adapters)

```ts
// server/cline/clineAdapter.ts  (sketch: complete types in implementation)
import { Agent } from '@cline/sdk';
import { buildSystemInstruction, getCapability, validateFunctionCalls } from '../aiTools';
import { createBoardTools, type BufferedCall } from './tools/boardTools';
import { createKnowledgeTools } from './tools/knowledgeTools';
import { createAssistantTools, type Proposal } from './tools/assistantTools';
import { buildIndicPolicy } from './prompts/indicPolicy';
import { classroomHooks } from './hooks';
import { resolveProvider } from './providers';

export async function generateAgentActionsCline(req: ClineGenerateRequest) {
  const calls: BufferedCall[] = [];
  const proposals: Proposal[] = [];
  const citations: Citation[] = [];
  const { providerId, modelId, apiKey, baseUrl } = resolveProvider(req);   // §5.6

  const agent = new Agent({
    providerId, modelId, apiKey, baseUrl,
    maxIterations: Number(process.env.CLINE_MAX_ITERATIONS ?? 6),
    systemPrompt: [
      buildSystemInstruction(req.canvasObjects, req.viewport, req.pageContext,
                             req.domElements, req.lessonContext, getCapability(modelId)),
      buildIndicPolicy(req.lang, req.lessonMode, req.activeChapter),        // §6.5, §9.3
    ].join('\n\n'),
    tools: [
      ...createBoardTools(calls),
      ...createKnowledgeTools({ citations, activeChapter: req.activeChapter, lang: req.lang }),
      ...createAssistantTools(proposals),
    ],
    hooks: classroomHooks({ maxBoardCalls: getCapability(modelId).maxToolCallsPerRequest }),
  });

  const unsubscribe = agent.subscribe(e => req.onEvent?.(e));   // SSE stretch goal, logs
  req.signal?.addEventListener('abort', () => agent.abort('teacher cancelled'));

  const result = await agent.run({
    id: crypto.randomUUID(), role: 'user', createdAt: Date.now(),
    content: [
      { type: 'text', text: req.prompt },
      ...(req.canvasImageBase64 ? [{ type: 'image', image: stripDataUrl(req.canvasImageBase64), mediaType: 'image/png' }] : []),
    ],
  });
  unsubscribe();

  const { fixedCalls } = validateFunctionCalls(calls, req.canvasObjects, req.domElements);
  return {
    functionCalls: fixedCalls,
    textResponse: result.outputText,
    proposals, citations,                                      // new, optional fields
    usageMetadata: { promptTokenCount: result.usage.inputTokens,
                     candidatesTokenCount: result.usage.outputTokens },
    agentIterations: result.iterations,
  };
}
```

**Router change (`server/aiRouter.ts` `/generate`):** add `'cline'` as the first candidate mode when `AI_ENGINE !== 'legacy'`. On a provider error, fall back to the existing legacy chain (vertex, then gemini, then ollama). The response shape is the same, so `services/aiService.ts`, `useGeminiBrain.ts` and `useAgentProcessor.ts` keep working unchanged. Additive fields (`proposals`, `citations`) are read by new UI code only.

**Multi-turn:** the client already sends the last 8–20 messages as `history`. The adapter maps them to `initialMessages` (role `user`/`assistant`, text parts). Requests stay stateless, and the server never stores pupil data.

### 5.5 Classroom hooks (policy, safety and budget in code, not in the prompt)

```ts
// server/cline/hooks.ts
export const classroomHooks = ({ maxBoardCalls }: { maxBoardCalls: number }) => {
  let boardCalls = 0;
  return {
    beforeTool: ({ tool, input }) => {
      if (BOARD_TOOL_NAMES.has(tool.name) && ++boardCalls > maxBoardCalls)
        return { skip: true, reason: `Board budget reached (${maxBoardCalls}). Summarise instead.` };
      if (tool.name === 'add_interactive_app' && containsNetworkOrStorage(input))
        return { skip: true, reason: 'Apps must be offline and must not use fetch/localStorage/cookies.' };
      return undefined;
    },
    afterRun: ({ result }) => telemetryService.recordAgentRun(result),   // INR cost (§10.4)
  };
};
```

Golden rule enforced in tests: **when the request references the curriculum** (chapter, exercise, "NCERT", "kitaab", "path"), the run must include a `search_syllabus` or `get_chapter_exercises` call *before* any board tool. Implementation: `beforeTool` on board tools checks a `groundingDone` flag when `req.requiresGrounding` is true. If grounding has not happened, it returns `{ skip: true, reason: 'Call search_syllabus first.' }`. The agent loop then self-corrects. This "retry with feedback" is something the old single-shot pipeline could not do.

### 5.6 Provider strategy

| Tier | Provider (`providerId` / model) | Use when | Indic quality | Cost / offline |
|------|---------------------------------|----------|---------------|----------------|
| Default cloud | `gemini` / `gemini-3.8-flash` (keep the repo default) | Best tool-calling reliability, vision of the canvas screenshot | Good Hindi/Hinglish, fair Assamese | Free tier OK for demo |
| Indic-first | `sarvam` / `sarvam-105b` (tools + reasoning per catalog) | Hindi/Assamese-heavy explanations, Teaching Assistant answers | Trained on Indian languages | Paid, India-hosted |
| Enterprise | `vertex` / same Gemini model via `GOOGLE_APPLICATION_CREDENTIALS` | Govt / CSR deployments needing GCP contracts | Same as Gemini | Paid |
| Offline | `ollama` / `gemma4:e2b` or fine-tuned `trido-model:latest` | No internet (Tier-0, §11.2) | Basic Hindi. Weak Assamese, so deterministic widgets carry the load. | Free, laptop CPU |

`resolveProvider()` reads the Settings choice (`aiPreference`, extended with `sarvam`), then env, then probes (the existing `getAvailableMode`). Hybrid routing (stretch): use Gemini for the board-drawing agent and Sarvam for the `explain_in_language` text tool. A tool can call a nested `Agent` with a different provider, which is a nice demo of the SDK's gateway.

### 5.7 Cline beyond the request path (extra "Cline inside the product" points)

1. **`vaani-classroom` AgentPlugin** (`plugins/vaani-classroom/index.ts`). It packages `search_syllabus`, `get_chapter_exercises`, `get_nipun_targets`, `generate_math_practice` and a pedagogy rule via `api.registerTool` and `api.registerRule`. The same plugin is (a) loaded by our server agent and (b) installable in **Cline CLI/IDE** with `cline plugin install ./plugins/vaani-classroom`. A DIET/SCERT content team can then run `cline "Make a Class 2 Assamese counting worksheet for chapter 3"` against the same syllabus index. One codebase serves two surfaces.
2. **Lesson Pack Studio (stretch, after the MVP):** `ClineCore.create({ backendMode: 'local' })` with `enableTools: false`, only our plugin tools, and `enableSpawnAgent: true`. A coordinator agent spawns sub-agents that prepare a week of lessons (one per day) and saves them as `.vaani.json` board files the teacher opens offline next morning. `toolPolicies` disable `run_commands` and `editor` explicitly.
3. **Cline in the build** (judged separately, §14.1): `.clinerules/` encodes the rules from AGENTS.md (fast typecheck, batched patches, scoped greps). A `/workflows/add-language.md` Cline workflow scaffolds a new `LanguageProfile`, translation keys, varnamala data and a test, and is demoed in the video.

### 5.8 Packaging and deployment changes

| Target | Change |
|--------|--------|
| Express (`npm run dev` / `start`) | No change beyond `npm i @cline/sdk`. `tsx` handles ESM. |
| Electron | `scripts/build-electron.js`: `target: 'node22'`. Add `@cline/sdk`, `@cline/core`, `@cline/agents`, `@cline/llms`, `@cline/shared` to `external` so electron-builder copies them from `node_modules`. |
| Vercel `api/ai/generate.ts` | Replace the inline Vertex code with `export { default } from '../../server/vercel/generateHandler'`, which calls `generateAgentActionsCline`. Set the function runtime to Node 22 in `vercel.json`. |
| Bundle size | `@cline/core` pulls OpenTelemetry and the MCP SDK. Server-side only, so this is acceptable. The browser bundle is untouched because the SDK is never imported from client code (guard with an ESLint/TS path rule: `server/cline/**` only). |

---

## 6. Language: remove Indonesian, add Indian vernacular voices

### 6.1 Removal checklist (Indonesian `id`)

| Area | Action |
|------|--------|
| `types.ts` `SupportedLanguage` | Replace with the Indic union (§6.2). Delete `'id'`. Keep `'en'`. Drop the UN/global extras (`ar, zh, fr, ru, es, ja, ko, de, pt`) from the default UI picker to reduce noise. Retaining them is a 1-line config if the team wants. |
| `utils/translations.ts` | Delete the `id` dictionary (lines 28–272). `en` becomes the base. Add a `hi` dictionary (full) and `as`, `bn`, `ta`, `te`, `mr` (partial; missing keys fall back to `en` via `useTranslation`). |
| `store.ts` | `getInitialLanguage()` default becomes `'hi'`, and the valid list becomes the Indic list. `defaultVoiceConfig.language` becomes `'hi-IN'`. Migrate a stored `trido_language='id'` to `'hi'`. Rename localStorage keys `trido_*` to `vaani_*` with a one-time migration. |
| `hooks/useGeminiBrain.ts` | Replace the Indonesian regexes in `evaluateJevSystemOne` with the multilingual reflex grammar (§7.1). Replace the Indonesian `synthesizeFallbackResponse` strings with `t()` keys. |
| `ChatInterface.tsx:286,460`, `useAmbientListener.ts:176,232`, `ChatMessageItem.tsx:189` | `'id-ID'` becomes `getLanguageProfile(lang).bcp47`. TTS voice selection by profile. |
| `server/aiTools.ts` | System prompt: remove Indonesian examples and subjects (IPA/IPS/Bahasa Indonesia, "Menjalankan tindakan", "lanjutkan"). Add Indian subjects (EVS, Maths, Hindi, English, Assamese, "Our Wondrous World"/"Looking Around", Kala) and the Indic language policy (§6.5). Attendance statuses H/I/S/A become **P/A/L** (Present/Absent/Leave) with labels by language. |
| `components/AttendanceTool.tsx` | Indonesian sample names (Budi Santoso, Siti Aminah…) become an empty roster plus a "Add from register" voice flow. Statuses as above. |
| `server/telemetryService.ts` | `USD_TO_IDR_RATE`/`costIdr` become `USD_TO_INR_RATE` (env-configurable) and `costInr`. Update `types.ts` `TelemetryRecord` and `TelemetryView.tsx`. |
| `server/multiAgentOrchestrator.ts` | Keyword heuristics (`peta konsep`, `kuis`, `absensi`) go through `indicNormalize` keyword sets. Superseded anyway by the Cline agent; keep for the legacy engine only. |
| `components/landing/*`, `QuickGuideModal.tsx`, `README.md`, `docs/*_ID.md` | Rewrite the landing and guide for India. Move Indonesian docs to `docs/legacy/`. **Keep** the credit to Trido / Ardellio Satria Anindito / Pak Damar in the README and About (MIT attribution and good faith). |
| `server/whisperService.py` | Docstring only. Language param already generic. |
| Tests | `tests/multilingual.test.ts` and `internationalLanguagesEvaluation.test.ts` get rewritten for the Indic list. `jevMode.test.ts` gets Hinglish reflex cases. |
| Guard | A new test, `tests/noIndonesian.test.ts`, greps `components/ hooks/ server/ utils/ store.ts App.tsx` for a list of Indonesian markers (`Bahasa Indonesia`, `id-ID`, `Buatkan`, `Presensi`, `Kuis`, `costIdr`…) and fails if any are found. |

### 6.2 `LanguageProfile`: the single source of truth

```ts
// utils/languages.ts (new; replaces SUPPORTED_LANGUAGES in translations.ts)
export type SupportedLanguage = 'hi' | 'en' | 'as' | 'bn' | 'ta' | 'te' | 'mr' | 'gu' | 'kn' | 'ml' | 'od' | 'pa' | 'ur';
export interface LanguageProfile {
  code: SupportedLanguage; name: string; nativeName: string;
  bcp47: string;                       // 'hi-IN', 'as-IN', ...
  script: 'Deva' | 'Beng' | 'Taml' | 'Telu' | 'Gujr' | 'Knda' | 'Mlym' | 'Orya' | 'Guru' | 'Arab' | 'Latn';
  numberingSystem: 'deva' | 'beng' | 'tamldec' | 'telu' | 'gujr' | 'knda' | 'mlym' | 'orya' | 'guru' | 'arabext' | 'latn';
  dir: 'ltr' | 'rtl';
  font: string;                        // 'Noto Sans Devanagari', 'Noto Sans Bengali', ...
  stt: { sarvam?: string; whisper?: string; webSpeech?: string };   // per-engine codes
  tts: { sarvam?: string; bhashini?: string; browser?: string };    // undefined = unsupported
  codeMix?: 'hinglish';                 // enables saaras codemix + Hinglish reflex grammar
}
```

Verified language support matrix (Sarvam docs, 10 Oct 2026; Intl tested on Node 25):

| Lang | Sarvam STT `saaras:v4` | Sarvam TTS `bulbul:v3` | Sarvam LLM `sarvam-105b` | Native digits (`Intl`) | MVP |
|------|:---:|:---:|:---:|---|:---:|
| Hindi `hi-IN` (+ Hinglish codemix) | ✅ | ✅ | ✅ | `२०` ✅ | **Full** |
| English `en-IN` | ✅ | ✅ | ✅ | — | **Full** |
| **Assamese `as-IN`** | ✅ | ❌, so **Bhashini TTS** or browser voice or on-screen highlight | ❌ (falls back to Gemini) | `১,২৩,৪৫,৬৭,৮৯০` ✅ (beng) | **Content + STT** |
| Bengali `bn-IN` | ✅ | ✅ | ✅ | ✅ | Content + voice |
| Tamil `ta-IN`, Telugu `te-IN`, Marathi `mr-IN` | ✅ | ✅ | ✅ | ✅ | Content + voice |
| Gujarati, Kannada, Malayalam, Odia (`od-IN`), Punjabi | ✅ | ✅ | ✅ | ✅ | Config only |
| Urdu `ur-IN` (RTL) | ✅ | ❌ | ❌ | ✅ (arabext) | Config only |

> Note: Sarvam uses **`od-IN`** for Odia, not `or-IN`. The `stt`/`tts` maps in `LanguageProfile` absorb such per-vendor differences.

### 6.3 Two separate language settings

A teacher in Assam may speak Hinglish to the board but want **content in Assamese**. So we store:

- `uiLanguage` (chrome, menus, assistant chat replies). Default `hi`.
- `boardLanguage` (what gets written on the board). Default = `uiLanguage`. It can be overridden **per command**: "*Assamese mein* … banao" sets `boardLanguage='as'` for that turn only.

Detection of the per-command override is done in `utils/indicNormalize.ts` using a language-name lexicon:
`{ hindi|हिंदी|हिन्दी → hi, assamese|asamiya|অসমীয়া|असमिया → as, bangla|bengali|বাংলা → bn, tamil|தமிழ் → ta, … }` combined with postpositions `mein|me|में|ত|তে|il`.

### 6.4 Speech-to-text pipeline

```
VoiceInput ─► engine = voiceConfig.sttEngine (auto | sarvam | webspeech | whisper)
 auto: online && SARVAM_API_KEY ? sarvam : (webSpeech supports bcp47 ? webspeech : whisper)
 ─► POST /api/voice/stt  { audioBase64, lang, codeMix }
     server/voice/sarvamStt.ts:
       multipart → POST https://api.sarvam.ai/speech-to-text
         header  api-subscription-key: $SARVAM_API_KEY
         fields  model=saaras:v4, mode=codemix (hi + Hinglish) | transcribe (others),
                 language_code=profile.stt.sarvam | 'unknown' (auto-detect)
       → { transcript, language_code }
     fallback: server/whisperAdapter.ts (faster-whisper; pass profile.stt.whisper, e.g. 'hi', 'as')
 ─► utils/indicNormalize.ts  ─► reflex grammar ─► agent
```

- **Why `codemix`:** Sarvam's codemix mode keeps English words in Latin script and Hindi in Devanagari ("मेरा phone number है"). That is exactly how teachers speak ("Board pe water cycle ka mind map banao"), and it keeps tool keywords (`mind map`, `quiz`, `undo`) in their recognisable Latin form.
- Keep the existing `/api/ai/transcribe` route as an alias that forwards to `/api/voice/stt`, so `ChatInterface.tsx` changes stay minimal.
- **Audio limits:** Sarvam REST handles up to about 30 s per request. The existing continuous-recording UI (`autoStopSeconds: 0`) must chunk at 25 s or use silence detection. `silenceDetectionTimeout` already exists in `VoiceConfig`.
- **Keyterms:** Sarvam STT accepts `keyterms`. Pass the active chapter's glossary (e.g. "evaporation, condensation, वाष्पीकरण") to improve recognition of subject vocabulary.

### 6.5 Language policy injected into the system prompt (`server/cline/prompts/indicPolicy.ts`)

```
LANGUAGE POLICY
- Teacher may speak Hindi, English, Hinglish (Roman Hindi), or {uiLanguageName}. Understand all.
- Write ALL board content (labels, mind-map nodes, quiz text, documents) in {boardLanguageName}
  using {script} script. Use {numberingSystem} digits for counting/number activities for Classes 1–2;
  show Western digits in brackets for Classes 3+ (e.g. ৫ (5)).
- Reply to the teacher in {uiLanguageName}, max 3 short sentences, then one practical teaching tip.
- Keep scientific terms bilingual on first use: "वाष्पीकरण (Evaporation)".
- Never transliterate {boardLanguageName} into Latin script on the board.
- Primary-grade register: short words, concrete local examples (village pond, monsoon, roti, mango).
```

### 6.6 Text-to-speech (assistant replies, board reader, Varnamala game)

`server/voice/tts.ts` → `POST /api/voice/tts { text, lang }`:
1. Sarvam `POST https://api.sarvam.ai/text-to-speech` with `model: 'bulbul:v3'`, `language_code`, and `speaker` per profile (default `shubh`). Max 2500 chars per call, so chunk by sentence. Response is base64 audio; join `audios` and stream it back. Cache by `sha1(lang+text)` in memory plus IndexedDB on the client, so repeated letters in games are free and work offline later.
2. If the language is unsupported by Sarvam (**Assamese**, Urdu): Bhashini pipeline (config call, then compute call, ULCA `as` TTS) when `BHASHINI_*` is set.
3. Browser `speechSynthesis` with a voice matching `profile.bcp47` (fixes the hard-coded `id-ID` in `ChatMessageItem.tsx:189`).
4. Last resort: no audio, but the board reader highlights each item on screen with a large caption (still useful for low-vision users with magnifiers).

### 6.7 Fonts and rendering

- Add **Noto Sans Devanagari, Noto Sans Bengali** (covers Assamese ৰ/ৱ), Tamil, Telugu, Gujarati, Gurmukhi, Kannada, Malayalam, Oriya, and Noto Nastaliq Urdu. **Self-host** the `woff2` files in `public/fonts/` and add them to the PWA `globPatterns` (already includes `woff2`), so Indic text renders offline.
- Fabric text objects and Mermaid themes: set `fontFamily` from the profile. Mermaid needs `themeVariables.fontFamily`.
- Grapheme-safe truncation for labels: use `Intl.Segmenter(lang, { granularity: 'grapheme' })` so conjuncts like "क्ष" are never split.
- Font size: board text minimum 28 px at 1080p for Classes 1–2 (projector legibility at the back row). NIPUN mode bumps this to 36 px (§9.3).

---

## 7. Voice command understanding

### 7.1 Two-system routing (keeps Trido's "Jev System-1/2" idea, made multilingual)

| System | What | Latency | Where |
|--------|------|---------|-------|
| **System-1 reflex** | Deterministic grammar for control verbs: undo/redo, read board, zoom, pan, open/close timer/calculator, switch language, stop speaking, "next/previous page". No LLM. | < 15 ms | `utils/reflexGrammar.ts` (new), called from `evaluateJevSystemOne` |
| **System-2 agent** | Everything creative or curricular: diagrams, games, quizzes, explanations, exercises, NIPUN conversion, doubts | 2–8 s | Cline `Agent` (§5) |

**Normalisation first** (`utils/indicNormalize.ts`):
1. `text.normalize('NFC')`, lowercase Latin, collapse whitespace, strip `।` `?` `!`.
2. Map native digits to ASCII for parsing (`२०`→`20`, `১০`→`10`) using `Intl.NumberFormat` round-trip tables.
3. Map Devanagari spellings of English loanwords to Latin keywords: `माइंड मैप→mind map`, `क्विज़/क्विज→quiz`, `अंडू/अनडू→undo`, `बोर्ड→board`, `डायग्राम→diagram`, `गेम→game`, `एक्सरसाइज़→exercise`.
4. Hinglish synonym sets: `banao|bana do|banaiye|बनाओ|बना दो|tairi karo` → **CREATE**; `undo karo|wapas karo|hatao pichhla|pichhla mitao` → **UNDO**; `bolkar batao|padh ke sunao|read karo|सुनाओ` → **READ_ALOUD**; `dikhao|lao|kholo|bring up|show` → **SHOW**; `convert karo|badlo|mein badal do` → **CONVERT**.

### 7.2 Reflex grammar (examples, all unit-tested)

```ts
// utils/reflexGrammar.ts (excerpt)
export const REFLEXES: Reflex[] = [
  { id: 'UNDO', re: /\b(undo|wapas|pichh?la\s+(action|kaam|step)?\s*(undo|hatao|mitao|wapas)|पिछला.*(अनडू|हटाओ|वापस))\b/i },
  { id: 'REDO', re: /\b(redo|dobara\s+karo|फिर\s+से\s+करो)\b/i },
  { id: 'READ_BOARD', re: /(board|बोर्ड|bord).*(bolkar|bol\s*ke|padh(\s*ke|kar)?|sunao|batao|read)|read (the )?board/i },
  { id: 'STOP_SPEAK', re: /^(ruko|bas|chup|stop|रुको|बस)\b/i },
  { id: 'ZOOM_IN', re: /\b(zoom in|bada karo board|बड़ा करो)\b/i },
  { id: 'SET_BOARD_LANG', re: /board (ki )?bhasha (\w+) (karo|kar do)/i },
  // "timer 5 minute ka lagao" / "5 मिनट का टाइमर" → { seconds: 300 }
  { id: 'TIMER', re: /(\d+)\s*(minute|min|मिनट).*(timer|टाइमर)|(timer|टाइमर).*(\d+)\s*(minute|min|मिनट)/i },
];
```

A reflex only fires when the **whole utterance** is a control command. "Undo karo aur phir quiz banao" falls through to the agent, which gets an `undo_last_turn` client-side tool.

### 7.3 The 8 example commands, mapped end to end

| # | Teacher says | Route | Agent tool sequence (expected, asserted in `tests/exampleCommands.test.ts` with a mocked model) | Board result |
|---|--------------|-------|------------------------------------------------------------------|--------------|
| 1 | *"Board pe water cycle ka mind map banao."* | Agent | `search_syllabus("water cycle", activeChapter?)` → `render_mermaid({code: "mindmap\n root((जल चक्र))\n  वाष्पीकरण (Evaporation)\n  संघनन (Condensation)\n  वर्षा (Precipitation)\n  संग्रहण (Collection)", gridPosition:"CENTER"})` | Hindi mind map + citation chip "NCERT Class 9 Science *Exploration*, Ch 13 'Earth as a System', pp. 253, 262" |
| 2 | *"Hindi mein Swar aur Vyanjan sikhane ke liye ek interactive game banao."* | Agent | `get_varnamala({lang:"hi", set:"swar+vyanjan"})` → `add_component({componentType:"LETTER_GAME", configJson:{lang:"hi", mode:"sort", groups:["स्वर","व्यंजन"], items:[…13 swar, sample vyanjan…], audio:true}})` | Drag-to-sort game. Each tile speaks the letter (TTS cached). Score + confetti. |
| 3 | *"Class 2 ke bachchon ke liye 20 tak addition ka quiz banao."* | Agent | `get_nipun_targets({grade:2, domain:"numeracy"})` → `generate_math_practice({op:"add", max:20, count:10, grade:2, lang:"hi"})` → `add_component({componentType:"QUIZ_APP", configJson:{questions:[…generated, verified…]}})` | 10 questions, sums ≤ 20, answers **computed by code**, digits in Devanagari + Western for Class 2 |
| 4 | *"Assamese mein ek simple counting activity banao."* | Agent (boardLanguage=`as`) | `get_nipun_targets({grade:1,domain:"numeracy"})` → `add_component({componentType:"COUNTING_ACTIVITY", configJson:{lang:"as", min:1, max:10, objects:"🥭", numerals:"beng", labels:true}})` | Tap-to-count mangoes, Assamese numerals ১–১০ and number words (এক, দুই, তিনি…) from `data/scripts/numbers/as.json` |
| 5 | *"Explain photosynthesis in simple Hindi with a labelled diagram."* | Agent | `search_syllabus("photosynthesis / पौधे भोजन कैसे बनाते हैं")` → `add_component({componentType:"LABELLED_DIAGRAM", configJson:{template:"photosynthesis", labels:{sun:"सूरज",leaf:"पत्ती",co2:"कार्बन डाइऑक्साइड",water:"पानी",o2:"ऑक्सीजन",glucose:"भोजन (ग्लूकोज़)"}}})` + `add_component({componentType:"DOCUMENT_PAGE", markdown:"…4 short Hindi sentences…"})` | SVG template with Hindi labels + short explanation + citation (NCERT Class 9 Science Ch 13 pp. 263–266 / Ch 12 pp. 234–237). If no template matches, fallback is a Mermaid `flowchart LR`. |
| 9 | *"Is chapter ka exercise dikhao."* (RAG demo; active chapter = Class 9 Science Ch 13) | Agent | `get_chapter_exercises({chapterKey:"ncert-c9-sci-ch13"})` → `add_component({componentType:"EXERCISE_SHEET", configJson:{chapterKey, items:[…"Revise, Reflect, Refine" Q1…Qn verbatim…], source:"NCERT Class 9 Science, Ch 13, p. 267–268"}})` | Verbatim textbook exercises + page numbers + teacher-only answers from the Answer Key |
| 6 | *"Is lesson ko NIPUN mode mein convert karo."* | Agent with `lessonMode='nipun'` | `get_board_text()` → `get_nipun_targets({grade})` → `update_component(...)` per widget (simplify text, enlarge, add audio) → `add_component(COUNTING_ACTIVITY \| LETTER_GAME)` + `add_component(DOCUMENT_PAGE "मौखिक गतिविधि / Oral activity")` | See §9.3. Each item tagged with a Lakshya competency badge. |
| 7 | *"Board par jo likha hai, use mujhe bolkar batao."* | **Reflex** `READ_BOARD` | none (client) | Board reader (§10.2) speaks in `uiLanguage`, top-left to bottom-right, with an on-screen focus ring |
| 8 | *"Pichhla action undo karo."* | **Reflex** `UNDO` | none (client) | Whole last AI turn reverted (§7.4) + spoken confirmation "पिछला काम हटा दिया" |

### 7.4 Undo that actually works (fixes BUG-1 and BUG-2)

**Changes in `components/CanvasManager.tsx` (history block, lines ~556–631):**

```ts
type Snapshot = { canvas: string; dom: string; label?: string };
let history: Snapshot[] = []; let redoStack: Snapshot[] = [];
let txDepth = 0;                       // transaction nesting for AI turns

const snap = (): Snapshot => ({
  canvas: JSON.stringify(canvas.toJSON(['id', 'zIndex', 'isDomPlaceholder'])),
  dom: JSON.stringify(useStore.getState().domElements),
});
const saveHistory = () => { if (txDepth > 0 || isHistoryUpdating || canvas.__loadingPage) return; /* push snap() if changed */ };

// Exposed via store (replaces window.__tridoUndo which was never defined)
const beginTransaction = (label: string) => { if (txDepth++ === 0) pendingLabel = label; };
const commitTransaction = () => { if (--txDepth === 0) { const s = snap(); s.label = pendingLabel; history.push(s); redoStack = []; } };
const restore = (s: Snapshot) => {
  isHistoryUpdating = true;
  canvas.loadFromJSON(JSON.parse(s.canvas), () => {
    useStore.getState().setDomElements(JSON.parse(s.dom));   // DOM widgets restored too
    canvas.renderAll(); isHistoryUpdating = false;
  });
};
```

- `store.ts`: add `beginAiTransaction(label)` / `commitAiTransaction()` and keep `undoCanvas`/`redoCanvas`.
- `hooks/useAgentProcessor.ts`: call `beginAiTransaction(prompt)` before the first action of a turn and `commitAiTransaction()` after the queue drains, **including on abort**. One teacher command is then one undo step.
- `useGeminiBrain.ts:109-116`: replace `window.__tridoUndo()` with `useStore.getState().undoCanvas()`. Announce the label: *"पिछला काम हटाया: 'water cycle mind map'"*.
- Tests: `tests/undoTurn.test.ts` with a mocked Fabric canvas checks that (a) DOM widgets come back, (b) a 5-action AI turn undoes in one step, and (c) redo restores it.

---

## 8. Syllabus RAG ("Bring up exercise for this chapter")

### 8.1 Corpus (MVP → full)

> **Decision (team, 10 Oct):** the demo RAG uses the **NCERT Class 9 books, which are publicly available** at `ncert.nic.in/textbook.php`. The pipeline is grade-agnostic, so primary books (Class 1–5) and SCERT books plug in later with no code change, only new manifest entries.

| Phase | Content | Source / licence note |
|-------|---------|-----------------------|
| **MVP (demo)** | **NCERT Class 9 (2026 edition, NCF-SE 2023):** *Exploration*, Textbook of Science for Grade 9 (`iesc1`, Ch 1–13 + Answer Key), and *Ganita Manjari*, Textbook of Mathematics for Grade 9, Part I (`iemh1`, Ch 1–8). Hindi-medium Science (`ihsc1`) is a stretch goal (see §8.3 step 1). | Public PDFs, `https://ncert.nic.in/textbook/pdf/<code><nn>.pdf` (e.g. `iesc113.pdf`). Each book carries **"© NCERT 2026, ALL RIGHTS RESERVED"**, so we **do not commit PDFs**. The `data/` folder is already gitignored (`.gitignore:32`). PDFs are downloaded locally, and only derived chunk JSON with short excerpts and page refs is used at runtime. Get permission or confirm terms before any public release of the derived index. |
| v1 | NCERT Class 1–5 (EVS/"Our Wondrous World", "Joyful Mathematics", Hindi "Sarangi") + Class 6–10 Science/Maths, Hindi and English medium | Same |
| v2 | SCERT state books (Assam, UP, Bihar, Odisha…), DIKSHA/ePathshala metadata, teacher-uploaded worksheets (already parsed by `utils/documentParser.ts`) | Per-state terms; teacher uploads stay on-device |

**Verified corpus facts (downloaded and parsed on 10 Oct 2026 with the repo's own `pdf-parse` v2):**

| Book | Files | Chapters (from the Contents page) | Text quality | Exercise marker → questions per chapter |
|------|-------|-----------------------------------|--------------|------------------------------------------|
| Science *Exploration* (`iesc1`) | `iesc1ps.pdf` (prelims/contents) + `iesc101…113.pdf` (13 chapters, 7–25 pages each; the Answer Key is appended to `iesc113.pdf`) | 1 Exploration: Entering the World of Secondary Science (p1) · 2 Cell: The Building Block of Life (p8) · 3 Tissues in Action (p28) · 4 Describing Motion Around Us (p48) · 5 Exploring Mixtures and their Separation (p72) · 6 How Forces Affect Motion (p94) · 7 Work, Energy, and Simple Machines (p116) · 8 Journey Inside the Atom (p140) · 9 Atomic Foundations of Matter (p162) · 10 Sound Waves: Characteristics and Applications (p184) · 11 Reproduction: How Life Continues (p208) · 12 Patterns in Life: Diversity and Classification (p228) · 13 Earth as a System: Energy, Matter, and Life (p252) · Answer Key (p271) | ✅ Clean English (≈ 48–62 k chars per chapter). Printed page numbers are recoverable from the running header (`"267\tEarth as a System…"`). | **"Revise, Reflect, Refine"** at the chapter end → 13–21 numbered questions (Ch 2–12). Also in-text: *Pause and Ponder* (2–12 per chapter), *Activity n.m* (5–14), *Think It Over* (1). Then *The Journey Beyond* (projects). Ch 1 has no end exercises. |
| Maths *Ganita Manjari* Part I (`iemh1`) | `iemh1ps.pdf` + `iemh101…108.pdf` | 1 Orienting Yourself: The Use of Coordinates (p1) · 2 Introduction to Linear Polynomials (p16) · 3 The World of Numbers (p41) · 4 Exploring Algebraic Identities (p68) · 5 I'm Up and Down, and Round and Round (p92) · 6 Measuring Space: Perimeter and Area (p118) · 7 The Mathematics of Maybe: Introduction to Probability (p155) · 8 Predicting What Comes Next: Exploring Sequences and Progressions (p174) | ✅ Clean English. Maths notation is partly mangled (e.g. `√` and superscripts become `43 522+=`), so exercises are shown with a "view original page" link. | **"End-of-Chapter Exercises"** (13–27 questions) + in-text **"Exercise Set n.m"** and *Think and Reflect*. `*` marks enrichment questions (not assessed). |
| Science Hindi-medium (`ihsc1`) | `ihsc101…` | Same chapters in Hindi | ❌ **Legacy-font encoding**: 94–99 % of the characters are Devanagari, but the words are garbled (`"भञारोत में लद् ञाख"`). Needs OCR (§8.3 step 1). | Same structure |

**Demo topics that hit the 8 example commands:**
- *Water cycle* → **Science Ch 13** "Earth as a System" (the water cycle appears on pp. 253 and 262, with evaporation and condensation; exercises start on p. 267).
- *Photosynthesis* → **Ch 13** (pp. 254, 263–266) and **Ch 12** "Patterns in Life" (pp. 234–237).
- *"Is chapter ka exercise dikhao"* → any of Ch 2–13 (Revise, Reflect, Refine), or Maths Ch 1–8 (End-of-Chapter Exercises).
- *Answer support for the Teaching Assistant* → the Answer Key (p. 271 onward) gives official answers for MCQs and numericals, so hints can be checked against them.
- *Maths quiz* → Ganita Manjari Ch 2 (linear polynomials) or Ch 7 (probability) for a Class 9 quiz grounded in the book. The primary "20 tak addition" command is still served by the deterministic generator (§9.4), which needs no textbook.

### 8.2 Data model

```ts
// server/rag/types.ts
export interface SyllabusChunk {
  id: string;                         // ncert-c9-sci-ch13-p267-001
  board: 'NCERT' | 'SCERT-AS' | 'SCERT-UP' | 'TEACHER';
  grade: number;                      // 1–12 (demo: 9)
  subject: 'SCIENCE' | 'MATHS' | 'EVS' | 'HINDI' | 'ENGLISH' | 'ASSAMESE' | string;
  bookCode: string;                   // 'iesc1' | 'iemh1' (NCERT file prefix)
  chapterNo: number; chapterTitle: string; chapterTitleNative?: string;
  lang: SupportedLanguage; page: number;        // PRINTED page number (from running header), not PDF index
  pdfFile: string; pdfPage: number;              // for "view original page" links
  section?: string;                   // e.g. "13.3 The water cycle"
  kind: 'content' | 'exercise' | 'in_text_question' | 'activity' | 'answer_key' | 'project' | 'glossary' | 'teacher_note';
  exerciseNo?: string;                // "RRR-4", "EOC-12", "Set 2.6 Q1", "Pause and Ponder 3"
  enrichment?: boolean;               // Maths questions marked with * (not assessed)
  text: string;                       // NFC-normalised; ≤ 900 chars
  nipunTags?: string[];               // e.g. ['N2.add.20'] filled by heuristic + LLM tagger
}
export interface ChapterManifest { key: string; board: string; grade: number; subject: string; chapterNo: number;
  title: string; titleNative?: string; aliases: string[]; pages: [number, number]; glossary: string[] }
```

Files: `data/syllabus/index/chunks.jsonl`, `data/syllabus/index/manifest.json`, `data/syllabus/index/bm25.json` (prebuilt), and optionally `embeddings.f32` with a sidecar ID list.

### 8.3 Ingestion (`scripts/ingest_syllabus.ts`, run with `npx tsx`)

0. **Acquire:** `npm run ingest:syllabus -- --book iesc1 --book iemh1` downloads `<code>ps.pdf` plus `<code>01…NN.pdf` from `https://ncert.nic.in/textbook/pdf/` into `data/syllabus/raw/ncert/class9/` (gitignored). The NCERT server is slow and sometimes drops connections, so use a 90 s timeout and 3 retries, and validate each file's `%PDF` header (failed downloads return an HTML "ERROR" body). **The team machine already has the full set pre-downloaded** (25 PDFs, 169 MB: `iesc1ps`, `iesc101–113`, `iemh1ps`, `iemh101–108`, `ihsc101–102`). Copy it to the demo laptop instead of re-downloading on venue Wi-Fi.
1. **Extract:** use **`pdf-parse` v2 (already a dependency)**: `new PDFParse({ data }).getText()`. It gives cleaner words than the custom parser (e.g. `"Water moved"`, not `"W ater moved"`) and emits page separators `-- n of N --`, which we use for page mapping. Read the *printed* page number from the running header (`/^(\d{1,3})\t/m` or `/\t(\d{1,3})$/m`). The English-medium Class 9 books extract cleanly. **Hindi-medium NCERT PDFs (`ihsc1…`) use legacy font encoding**: the text is Devanagari but garbled. Detect this with a "valid-word ratio" check (share of tokens found in a Hindi wordlist < 0.5). Those pages go through Gemini vision OCR or Sarvam Vision (Document Intelligence, 23 languages) via `--ocr`. For the demo, Hindi board content comes from the agent translating English textbook evidence, with the citation pointing to the English page.
2. **Normalise:** NFC, fix nukta/ZWJ variants, collapse hyphenation and tab-separated table cells, strip `.indd` print-slug lines (`Chapter 1.indd 15 … 4/15/2026`), keep printed page numbers.
3. **Segment:** chapter boundaries come from one PDF per chapter, and titles from the `ps` Contents page (parsed into `manifest.json`). Blocks are classified with the **Class 9 markers verified above**:
   - `exercise`: from `Revise, Reflect, Refine` (Science) or `End-of-Chapter Exercises` / `Exercise Set n.m` (Maths) until `The Journey Beyond` or the end of the chapter. Split per top-level `^\s*\*?\d{1,2}\.\s` question, and keep sub-parts `(i)…(iv)` and tables inside their question.
   - `in_text_question`: `Pause and Ponder`, `Think It Over`, `Think and Reflect`.
   - `activity`: `Activity n.m` blocks. `project`: `The Journey Beyond`.
   - `answer_key`: the `Answer Key` section at the end of `iesc113.pdf`, split by `Chapter N` → `Revise, Reflect, Refine` / `Pause and Ponder` → `Q. answer`. Linked to the question chunk via `(chapterNo, exerciseNo)`.
   - Primary-grade and Indic cue patterns stay for later books: `Exercise|Let's do|Try this|Think and tell|अभ्यास|प्रश्न|करके देखो|सोचो और बताओ|আওঁ কৰোঁ|অনুশীলনী|প্ৰশ্ন`.
   Exercises are kept **whole** (never split mid-question) so they can be displayed verbatim. Expected yield for the demo corpus: ≈ 1,500 content chunks, ≈ 300 exercise chunks and ≈ 150 answer-key entries (verify after the first ingest).
4. **Chunk:** about 700 chars, 100 overlap for `content`. One chunk per exercise block.
5. **Index:** BM25 over **character 3–5-grams + word unigrams**. Char-grams make it robust to Hindi spelling variation and Hinglish romanisation ("paani" vs "पानी" is handled by a small romanisation pass that indexes both). This needs no network and no vector database.
6. **Optional dense pass:** `RAG_EMBEDDINGS=gemini` uses `text-embedding-004`, or `ollama` uses `nomic-embed-text` / `bge-m3`. Hybrid score = 0.6·dense + 0.4·BM25 (reciprocal-rank fusion). Off by default for offline Tier-0.
7. **Tagging (offline, one-time):** a small Cline `Agent` run per chapter tags `nipunTags` and glossary terms with a structured `submit_tags` tool (`lifecycle: { completesRun: true }`). This is a second, build-time use of the SDK.

### 8.4 Retrieval tools exposed to the agent (`server/cline/tools/knowledgeTools.ts`)

```ts
createTool({
  name: 'search_syllabus',
  description: 'Search NCERT/SCERT textbooks (demo index: NCERT Class 9 Science "Exploration" + Maths "Ganita Manjari" Part I). ALWAYS call before creating curriculum content. Returns passages with citations.',
  inputSchema: z.object({
    query: z.string().describe('Topic in any language/script, e.g. "water cycle" or "जल चक्र"'),
    grade: z.number().int().min(1).max(12).optional().describe('Demo corpus: 9'),
    subject: z.string().optional(),
    chapterKey: z.string().optional().describe('Use the active chapter if the teacher says "this chapter"'),
    kind: z.enum(['content', 'exercise', 'activity', 'glossary']).optional(),
    k: z.number().int().max(8).optional(),
  }),
  async execute(input) { const hits = rag.search(input); citations.push(...hits.map(toCitation)); return hits.map(compact); },
});

createTool({
  name: 'get_chapter_exercises',
  description: 'Return the textbook exercises of a chapter verbatim, in order, with page numbers.',
  inputSchema: z.object({ chapterKey: z.string().optional(), chapterQuery: z.string().optional() }),
  async execute({ chapterKey, chapterQuery }) { /* resolve active → by key → by fuzzy title/alias */ },
});
```

**"This chapter" resolution order:** (1) `activeChapter` from the Syllabus panel / `LessonPlan` in the store (extend `LessonPlan` with `chapterKey`). (2) The most recent chapter cited in this session. (3) A fuzzy match on the spoken title or alias ("paani wala chapter" → alias list). (4) Otherwise the agent asks one clarifying question via the text reply, with the top 3 matching chapters as quick-reply chips.

### 8.5 Board presentation of exercises

The agent calls `add_component({componentType: 'EXERCISE_SHEET', configJson: {chapterKey, items:[{no, text, page}], source}})`. This is a new widget that is a thin wrapper over `DocumentBlock` and adds:
- a **source footer** ("NCERT · Class 9 · Science *Exploration* · Ch 13 · pp. 267–268") and a **"Verbatim from textbook"** badge, plus a "View original page" link that opens the local PDF at `pdfPage` (useful for Maths, where formula extraction is lossy),
- an **"Answer (teacher only)"** toggle filled from the matching `answer_key` chunk, hidden on the students' mirrored screen,
- per-item buttons: *Quiz banao* (converts to `QUIZ_APP` via the agent), *Bolkar sunao* (TTS), *Hint* (Teaching Assistant),
- voice: *"teesra sawaal dikhao"* scrolls to item 3 (numbered targets, §10.3).

### 8.6 Quality bar and evaluation

`tests/rag/` holds a gold set of 40 queries (Hindi, Hinglish, English, Assamese) mapped to expected chunk IDs from the Class 9 corpus, for example:
`"paani ka chakra"` / `"जल चक्र"` / `"water cycle"` → `ncert-c9-sci-ch13` (pp. 253, 262) · `"prakash sanshleshan"` / `"photosynthesis"` → ch13 (p. 263+) and ch12 (p. 234+) · `"is chapter ka abhyas"` with active ch02 → the 16 "Revise, Reflect, Refine" chunks of ch02 · `"osmosis wala sawaal"` → ch02 RRR Q2 + its answer-key entry `2. (iii)` · `"coordinates ke exercise"` → `iemh1` ch01 End-of-Chapter Exercises · `"কোষ"` (Assamese: cell) → ch02.
The fixture under `tests/fixtures/syllabus/` contains **short excerpts only** (≤ 300 chars per chunk, 3 chapters) with citations, never full pages, because of the NCERT copyright notice.
Metrics: **Recall@5 ≥ 0.85**, **exercise-retrieval exact-match ≥ 0.9** (checked in CI with the prebuilt mini index under `tests/fixtures/syllabus/`). Faithfulness: the Teaching Assistant answer must cite at least one chunk, or else be labelled `general_knowledge: true`. The UI then shows a grey "Not from textbook" tag.

---

## 9. Teaching Assistant, NIPUN mode and FLN widgets

### 9.1 Teaching Assistant: two modes

| Mode | Trigger | What the agent does | Output |
|------|---------|---------------------|--------|
| **Augment** | Teacher says *"isko aur achhe se samjhao"*, *"ek example do"*, or taps "Help me explain" on a widget | `get_board_text` → `search_syllabus(topic)` → `propose_board_addition` ×1–3 (analogy from village life, a simpler re-explanation, one check-for-understanding question, a common misconception) | Proposal cards in `AssistantPanel` |
| **Doubt** | Teacher says *"Ek bachche ka sawaal hai: …"*, *"student puch raha hai …"*, or (stretch) a pupil submits from the room link | `search_syllabus(question)` → answer at grade level in `boardLanguage`, ≤ 3 sentences + 1 analogy + citation. If out of syllabus, it says so and gives a safe simple answer. | Proposal card: **Answer** · **Add to board** · **Speak** · **Ask class instead** |

**Proposal tools** (`server/cline/tools/assistantTools.ts`):

```ts
createTool({
  name: 'propose_board_addition',
  description: 'Suggest content for the teacher to approve. Use instead of board tools for doubts and extra explanations.',
  inputSchema: z.object({
    kind: z.enum(['answer', 'analogy', 'simpler_explanation', 'check_question', 'misconception', 'activity']),
    title: z.string(), body: z.string().describe('In boardLanguage, grade-appropriate, ≤ 60 words'),
    citations: z.array(z.string()).describe('chunk ids from search_syllabus; [] if general knowledge'),
    boardCall: z.object({ name: z.string(), args: z.record(z.string(), z.any()) }).optional()
      .describe('The exact board tool call to run if the teacher approves'),
  }),
  async execute(p) { proposals.push({ ...p, id: crypto.randomUUID() }); return { proposed: true }; },
});
```

**Approval UX:** `components/AssistantPanel.tsx` (new, right drawer) shows cards with big buttons. The voice commands *"haan, board pe daalo"*, *"pehla wala daalo"* and *"nahin"* are reflexes bound to the newest card. Approved cards push `boardCall` into the existing action queue inside an undo transaction.

**Safety for children:** a system rule plus a `beforeTool` check. No personal data about pupils, no medical or religious advice, no unverifiable facts presented as textbook. If a doubt touches self-harm, abuse or similar topics, the assistant tells the teacher privately and suggests a follow-up, and never puts it on the board.

### 9.2 NIPUN Bharat data (`data/nipun/lakshya.json`)

NIPUN Bharat (MoE, 2021) defines **Lakshya** (learning targets) for Balvatika to Grade 3 across oral language, reading, writing and numeracy. We encode them as small, reviewable JSON (values to be verified against the official NIPUN Bharat guidelines PDF during H1, §13):

```json
{ "grade": 2, "domain": "numeracy", "code": "N2.add.99",
  "text_en": "Reads and writes numbers up to 99; adds and subtracts numbers up to 99",
  "text_hi": "99 तक की संख्याएँ पढ़ता-लिखता है; 99 तक जोड़-घटाव करता है",
  "widgets": ["COUNTING_ACTIVITY", "QUIZ_APP:add", "QUIZ_APP:sub"] }
```

Literacy targets include the commonly cited **oral reading fluency** benchmarks (e.g. ~45–60 correct words per minute by end of Grade 2, ~60 by Grade 3 per NIPUN guidelines). These **must be confirmed from the source document and cited in the file header** before the demo. The tool `get_nipun_targets({grade, domain})` returns these entries so the agent's content aligns to them.

### 9.3 "Is lesson ko NIPUN mode mein convert karo"

`lessonMode: 'standard' | 'nipun'` in the store, sent with every request. The NIPUN policy is appended to the system prompt:

```
NIPUN MODE (Foundational Literacy & Numeracy, Classes 1–3)
1. Read the current board via get_board_text. Keep the topic; do not delete teacher content.
2. Rewrite every text widget with update_component: ≤ 8 words per sentence, high-frequency words,
   one idea per line, picture/emoji cue per line, boardLanguage script only.
3. Add exactly one PLAY activity (LETTER_GAME / COUNTING_ACTIVITY / QUIZ_APP from generate_math_practice)
   and one ORAL activity (DOCUMENT_PAGE titled "बोलो और सुनो" with 3 call-and-response prompts).
4. Tag each widget with config.nipun = [lakshya codes from get_nipun_targets].
5. Prefer local context: names (Ravi, Meena, Bindu), objects (mango, bangles, marbles, rotis).
```

Client effects of `lessonMode='nipun'`: board font ≥ 36 px, high-contrast palette, letter-by-letter TTS on tap, and a NIPUN badge on widgets that shows the Lakshya text on hover or voice ("yeh kis lakshya ke liye hai?").

### 9.4 Deterministic FLN widgets (new, `components/fln/*`, registered in `DomOverlay.tsx` switch at ~L310)

| `componentType` | Config | Behaviour | Data |
|-----------------|--------|-----------|------|
| `LETTER_GAME` | `{lang, mode: 'sort'\|'match-sound'\|'find', groups, items, audio}` | Drag letters into स्वर / व्यंजन bins, or hear a sound and tap the letter. Score + confetti (`canvas-confetti` already a dependency). | `data/scripts/varnamala/{hi,as,bn,mr,ta,te}.json`: vowels, consonants, matras, sample words + emoji |
| `COUNTING_ACTIVITY` | `{lang, min, max, objects, numerals, labels}` | Tap objects to count. Number + number word shown in script. Optional "how many?" check. | `data/scripts/numbers/{lang}.json` (1–100 words); digits via `Intl.NumberFormat(lang, {numberingSystem})` |
| `QUIZ_APP` (existing) | generated `questions[]` | Already exists (`components/quiz/QuizApp.tsx`). We add native-digit display and TTS of the question. | From `generate_math_practice` |
| `LABELLED_DIAGRAM` (stretch) | `{template, labels}` | Clean SVG templates (water cycle, plant parts, photosynthesis, human body basics, parts of a flower) with label slots filled by the agent | `public/diagrams/*.svg` with `data-slot` attributes |
| `EXERCISE_SHEET` | §8.5 | Textbook exercises verbatim + actions | RAG |

**Why deterministic:** `generate_math_practice` builds questions **in code** (seeded RNG, constraints such as `max: 20` and `no carry` for Class 1, and distractors at ±1/±2/±10). The LLM only chooses parameters. This guarantees no wrong answers on the board. Unit tests check every generated question.

```ts
// server/fln/mathPractice.ts
export function generateMathPractice({ op, max, count, grade, seed, noCarry }: Params): QuizQuestion[] {
  // op ∈ add|sub|compare|missing|skip-count ; returns {question, options[4], correctIndex}
}
```

---

## 10. Accessibility (visual and motor disabilities)

### 10.1 Principles

Voice-complete (every action reachable by voice), keyboard-complete (every action reachable by keyboard), screen-reader friendly, large targets (≥ 48 px; 64 px for the mic), no time limits on teacher actions, reduced motion respected (`prefers-reduced-motion` turns off GSAP cursor animations, which are currently always on).

### 10.2 Board reader (`hooks/useBoardReader.ts` + `utils/boardToText.ts`)

- `boardToText(canvas, domElements, lang)` produces an ordered list of `{ id, kind, region, text }`:
  - order: reading order by grid region (TOP_LEFT → … → BOTTOM_RIGHT), then by y, then by x;
  - Fabric text → `textContent`. Shapes → "नीला गोला" (colour + shape names localised);
  - Mermaid mind map → walk the code tree: "मुख्य विषय: जल चक्र। इसकी 4 शाखाएँ हैं: वाष्पीकरण, …";
  - quiz → question + options ("विकल्प क: …"); exercise sheet → items with numbers; timer → remaining time.
- Speaks through the TTS chain (§6.6). It is interruptible ("ruko") and navigable ("agla" / "pichhla" / "teesra item padho").
- The same text feeds the server tool `get_board_text` (also used by NIPUN mode and the Teaching Assistant), so one implementation serves both. Ship it as a shared pure function in `utils/` and test it in Node.
- An ARIA live region (`<div aria-live="polite" class="sr-only">`) announces every AI turn summary: "बोर्ड पर जोड़ा गया: जल चक्र माइंड मैप, बीच में".

### 10.3 Motor accessibility

- **Numbered voice targets** (stretch): *"number dikhao"* overlays big numbered badges on every widget. *"3 ko bada karo"*, *"2 ko daayein le jao"*, *"5 hatao"* map to the existing `modify_object` / `drag_element` / `DELETE_OBJECT` actions via reflexes, with no LLM involved.
- **Push-to-talk alternatives:** Space bar, a big on-screen mic, a USB foot pedal (it sends a key), and a "continuous listening during class" toggle (existing `useAmbientListener`, made multilingual) with a spoken wake phrase *"Vaani suno"*.
- Confirmation for destructive commands ("board saaf karo" = clear board) by voice ("haan") or a large button. Undo is always available.
- `AssistiveDock.tsx` (existing) is extended with: Read board · Undo · Numbers · Language · NIPUN toggle.

### 10.4 Visual accessibility

High-contrast theme (yellow on black, and black on white), a font scale slider (1.0–2.0), a colour-blind-safe palette for mind-map branches (Okabe-Ito), a focus ring on the item being read, and full keyboard tab order through widgets (`tabIndex`, `role`, `aria-label` added in `DomOverlay.tsx`).

Telemetry note: cost is reported in **INR** (`USD_TO_INR_RATE` env, default 84) so schools and CSR funders can see the price per lesson.

---

## 11. Low-resource classroom engineering

### 11.1 Hardware target

₹25–35k Windows laptop (4–8 GB RAM, no GPU) + projector or a donated smart TV. Optional cheap USB conference mic (~₹1.5k), which helps STT in noisy rooms. Students' phones are optional (the existing Socket.IO room link + QR in `ShareDialog.tsx` works over the school's hotspot LAN).

### 11.2 Connectivity tiers (auto-detected by `/api/ai/status` + `navigator.onLine`)

| Tier | Network | STT | Brain | TTS | What works |
|------|---------|-----|-------|-----|------------|
| **T2 Online** | 4G / broadband | Sarvam `saaras:v4` | Cline Agent → Gemini / Sarvam | Sarvam / Bhashini | Everything |
| **T1 Flaky** | 2G/3G, high latency | Web Speech (if lang supported) → Sarvam with retry | Cline Agent with `maxIterations: 3`, no canvas screenshot (text-only context, ~10× smaller payload) | Cached audio → browser | Everything, slower. Large uploads skipped. |
| **T0 Offline** | none | faster-whisper `small` (Hindi OK, Assamese weaker) or typed input | Cline Agent → `ollama` `gemma4:e2b` (same code path, different `providerId`) | Browser voices / cached audio | Reflexes, FLN widgets, math generator, BM25 syllabus search, exercises, board reader, undo. Free-form diagrams are lower quality. |

The key point is that the **same Cline `Agent` code path** runs online and offline. Only the `providerId` changes. That is a direct benefit of the SDK's provider gateway.

### 11.3 Payload and latency budget

- Canvas screenshot: send at `multiplier 0.5` JPEG q=0.6 (≈ 60–120 KB) only when the prompt references the board ("is", "yeh", "board par"). Otherwise send none. Today it is always sent.
- Target p50 latency on T2: reflex < 50 ms; STT ≤ 1.5 s; agent turn ≤ 6 s for a mind map (1 search + 1 draw); exercises ≤ 3 s (no generation needed).
- PWA precache: app shell, Indic fonts, `data/scripts/*`, `data/nipun/*`, the syllabus index for the teacher's selected class (download "for offline" button in the Syllabus panel; ~2–5 MB per class).

### 11.4 Privacy and child safety

No pupil names leave the device. The attendance roster stays in IndexedDB, and the agent only sees counts (already the case: `aiTools.ts` reports "N students"). No audio is stored server-side (STT temp files are deleted; see `whisperAdapter.ts` finally-block). Telemetry (`telemetryService.ts`) stays opt-in. Sheets sync is disabled by default and prompts are redacted to the first 120 chars. Content filter rules are listed in §9.1.

---

## 12. File-by-file change list

### 12.1 New files

| Path | Purpose | Est. LOC |
|------|---------|---------:|
| `server/cline/clineAdapter.ts` | `generateAgentActionsCline()`: Agent setup, run, result mapping (§5.4) | 160 |
| `server/cline/providers.ts` | `resolveProvider()` across gemini/vertex/sarvam/ollama (§5.6) | 70 |
| `server/cline/hooks.ts` | `classroomHooks()`: budget, grounding gate, safety, telemetry (§5.5) | 80 |
| `server/cline/tools/boardTools.ts` | Bridge of the 19 existing declarations to `createTool` (§5.3) | 60 |
| `server/cline/tools/knowledgeTools.ts` | `search_syllabus`, `get_chapter_exercises`, `get_nipun_targets`, `get_varnamala`, `generate_math_practice`, `get_board_text` | 180 |
| `server/cline/tools/assistantTools.ts` | `propose_board_addition`, `ask_check_question` (§9.1) | 60 |
| `server/cline/prompts/indicPolicy.ts` | Language + NIPUN + pedagogy rules (§6.5, §9.3) | 90 |
| `server/rag/{types,bm25,romanize,index,search}.ts` | Offline syllabus retrieval (§8) | 300 |
| `server/voice/{sarvamStt,sarvamTts,bhashini,tts}.ts` + `server/voiceRouter.ts` | `/api/voice/stt`, `/api/voice/tts` (§6.4, §6.6) | 260 |
| `server/fln/mathPractice.ts` | Deterministic arithmetic generator (§9.4) | 120 |
| `plugins/vaani-classroom/index.ts` | `AgentPlugin` reusing the knowledge tools for Cline CLI/IDE (§5.7) | 50 |
| `scripts/ingest_syllabus.ts` | PDF → chunks → BM25 (§8.3) | 220 |
| `utils/languages.ts` | `LanguageProfile` registry (§6.2) | 160 |
| `utils/indicNormalize.ts`, `utils/reflexGrammar.ts` | Normalisation + System-1 grammar (§7.1–7.2) | 220 |
| `utils/boardToText.ts`, `hooks/useBoardReader.ts` | Board reader (§10.2) | 200 |
| `components/AssistantPanel.tsx`, `SyllabusPanel.tsx`, `CitationChip.tsx` | Teaching Assistant + chapter picker + citations | 380 |
| `components/fln/{LetterGame,CountingActivity,ExerciseSheet,LabelledDiagram}.tsx` | FLN widgets (§9.4) | 520 |
| `data/nipun/lakshya.json`, `data/scripts/varnamala/*.json`, `data/scripts/numbers/*.json` | Curated reference data | data |
| `data/syllabus/index/*` (generated; mini fixture under `tests/fixtures/syllabus/`) | RAG index | data |
| `public/fonts/Noto*.woff2`, `public/diagrams/*.svg` | Offline Indic fonts, diagram templates | assets |
| `.clinerules/01-vaani.md`, `.clinerules/workflows/add-language.md` | Cline-in-the-build rules + workflow (§5.7) | 60 |
| `tests/*` (see §15) | | 600 |

### 12.2 Modified files

| Path | Change |
|------|--------|
| `package.json` | `+@cline/sdk`; scripts `ingest:syllabus`, `test` (`vitest run`); `engines.node >= 22`; name → vaani-board |
| `.env.example` | §5.2 variables; remove hard-coded Vertex project hint |
| `constants.ts` | `CONFIG.ai.cline`, `CONFIG.ai.sarvam`; remove `projectId: 'gemma4good-494311'` (SEC-3) |
| `types.ts` | Indic `SupportedLanguage`; `AiPreference` + `'sarvam'`; `VoiceConfig.sttEngine`; `boardLanguage`; `LessonPlan.chapterKey`; `lessonMode`; `TelemetryRecord.costInr`; `Proposal`, `Citation` |
| `store.ts` | Indic defaults + migration from `id`; `boardLanguage`, `lessonMode`, `activeChapter`, `proposals[]`, `citations[]`; AI undo transactions |
| `utils/translations.ts` | Remove `id`; add `hi` (full), `as/bn/ta/te/mr` (partial); `SUPPORTED_LANGUAGES` re-exported from `utils/languages.ts` |
| `server/aiRouter.ts` | `cline` engine first + legacy fallback; pass `lang`, `boardLanguage`, `lessonMode`, `activeChapter`; return `proposals`, `citations` |
| `server/aiTools.ts` | De-Indonesianise prompt; Indian subjects; new `add_component` types (`LETTER_GAME`, `COUNTING_ACTIVITY`, `EXERCISE_SHEET`, `LABELLED_DIAGRAM`, `QUIZ_APP`); P/A/L attendance |
| `server/telemetryService.ts` | IDR → INR; `recordAgentRun(result)` from SDK usage |
| `server/whisperAdapter.ts` | `PYTHON_BIN` (OPS-3); language codes from profile |
| `services/aiService.ts` | Send new fields; error messages via `t()`; transcribe → `/api/voice/stt` |
| `hooks/useGeminiBrain.ts` | Reflex grammar; BUG-1 fix; proposals/citations into store; fallback strings via `t()` |
| `hooks/useAgentProcessor.ts` | Begin/commit AI undo transaction per turn |
| `hooks/useAmbientListener.ts`, `components/ChatInterface.tsx` | Profile-driven STT; Sarvam engine; 25 s chunking |
| `components/CanvasManager.tsx` | Unified `{canvas, dom}` history + transactions (BUG-2); profile fonts |
| `components/DomOverlay.tsx` | Register FLN widgets; sanitize HTML (SEC-1); ARIA roles |
| `components/AppBuilderTool.tsx` | Drop `allow-same-origin` (SEC-2) |
| `components/ChatMessageItem.tsx` | TTS via `/api/voice/tts` → browser fallback by profile; citation chips |
| `components/SettingsView.tsx` | Language tab (UI + board language, STT/TTS engine, voice); Sarvam + "Cline engine" in AI tab; Accessibility tab |
| `components/AttendanceTool.tsx` | P/A/L; empty roster; localised labels |
| `components/AssistiveDock.tsx`, `components/smartboard/*` | Read board, NIPUN, Numbers, Language buttons |
| `components/landing/*`, `QuickGuideModal.tsx`, `index.html`, `vite.config.ts` | Rebrand for India; Hindi + English copy; PWA manifest; fonts |
| `scripts/build-electron.js` | `node22` target; SDK externals (OPS-1) |
| `api/ai/generate.ts`, `api/ai/transcribe.ts`, `vercel.json` | Thin wrappers over shared server handlers (OPS-2) |
| `README.md`, `AGENTS.md` | India story, architecture, setup, Cline usage; update AGENTS.md architecture map (keep the file per its directive) |
| `tests/multilingual.test.ts`, `internationalLanguagesEvaluation.test.ts`, `jevMode.test.ts` | Rewrite for Indic list + Hinglish reflexes |

### 12.3 Deleted / moved

`docs/NASKAH_PRESENTASI_WIPO_BALI_2026.md`, `docs/REVIEW_PRESENTASI_WIPO_BALI_2026.md`, `docs/TRIDO_COMPREHENSIVE_GUIDE_ID.md` → `docs/legacy/`. The upstream `plan.md` is already moved to `docs/legacy/TRIDO_UPSTREAM_PLAN_ID.md`. `public/pak-damar.jpg` stays only on the About/credits page.

---

## 13. 8-hour build plan (4 lanes, built with Cline)

**Lanes:** **A** = Agent and Cline SDK (backend). **B** = Voice and language (full-stack). **C** = RAG, NIPUN and FLN widgets. **D** = Accessibility, UX, docs and video. With fewer people, merge A+C and B+D. Every lane works in Cline (Plan → Act), commits at each checkpoint, and records short screen captures of Cline at work for the demo video.

| Time | A — Agent / Cline SDK | B — Voice & Language | C — RAG / NIPUN / FLN | D — A11y / UX / Docs |
|------|-----------------------|----------------------|------------------------|----------------------|
| **H0 (0:00–0:30)** | All: fork setup, `npm ci`, `.env`, `.clinerules/`, agree on contracts (`ClineGenerateRequest`, `Proposal`, `Citation`, new `componentType`s) — commit `chore: bootstrap` | | | |
| **H1** | `npm i @cline/sdk`; `boardTools.ts` bridge; `clineAdapter.ts` with board tools only; router `AI_ENGINE=cline` | `utils/languages.ts`; remove `id` from types/store/translations; add `hi` + `en`; migrate defaults | Copy the pre-downloaded **NCERT Class 9** PDFs (`data/syllabus/raw/ncert/class9/`, 25 files) to all team machines; `ingest_syllabus.ts` with `pdf-parse` v2: extract, page-map, segment (RRR / EOC / Answer Key); verify NIPUN Lakshya values from the source PDF into `lakshya.json` | BUG-1 fix (undo reflex → store); start BUG-2 unified history |
| **H2** | ✅ **Checkpoint 1:** "water cycle mind map" works via Cline Agent (Gemini). Add `hooks.ts` (budget, telemetry INR) | `indicNormalize.ts` + `reflexGrammar.ts` + tests (undo, read board, timer, language switch) | BM25 + romanisation; `search_syllabus` + `get_chapter_exercises` tools; mini fixture index | AI-turn transactions in `useAgentProcessor`; `tests/undoTurn.test.ts` |
| **H3** | Wire knowledge tools into the agent; grounding gate; citations in response | `/api/voice/stt` (Sarvam `saaras:v4` codemix) + Whisper fallback; ChatInterface/ambient use profile | `generate_math_practice` + tests; `COUNTING_ACTIVITY` widget (Assamese numerals) | `boardToText.ts` + `useBoardReader` + ARIA live region |
| **H4** | ✅ **Checkpoint 2:** "Is chapter ka exercise dikhao" → `EXERCISE_SHEET` with citation | `/api/voice/tts` (Sarvam bulbul:v3 → browser fallback); fix `ChatMessageItem` TTS | `LETTER_GAME` (Swar/Vyanjan) + `data/scripts/varnamala/hi.json` (+ `as.json`) | `SyllabusPanel` (class/subject/chapter picker → `activeChapter`) |
| **H5** | `assistantTools.ts`; NIPUN policy prompt; `lessonMode` plumbing; Sarvam provider option | Per-command `boardLanguage` ("Assamese mein…"); Indic fonts self-hosted | `get_nipun_targets`, `get_varnamala`; NIPUN badges in widgets | `AssistantPanel` (approve/reject by voice + tap) |
| **H6** | ✅ **Checkpoint 3:** all 8 example commands pass `tests/exampleCommands.test.ts` (mocked model) + manual run | De-Indonesianise remaining UI strings (`noIndonesian.test.ts` green) | RAG gold-set eval ≥ targets; `vaani-classroom` AgentPlugin | Accessibility pass: targets, reduced motion, high contrast |
| **H7** | Hardening: timeouts, abort, legacy fallback, Ollama offline smoke | Settings → Language tab; Hindi strings review | Labelled diagram (stretch) / bug fixes | README, architecture diagram, PPT draft |
| **H7:30–8:00** | All: **feature freeze 7:30** → `npm run check`, `npx vitest run`, demo dry-run ×2, record video, push, submit | | | |

**Rules (from `AGENTS.md`, enforced in `.clinerules`):** `npm run check` after every Act step (< 3 s); no repeated `npm run build`; batched patches per file; no ad-hoc live-network smoke scripts (use mocked model tests); scoped greps only.

**Cut-line if behind schedule** (in this order): labelled diagrams → numbered targets → Bhashini → embeddings → Lesson Pack Studio → SSE streaming. **Never cut:** Cline Agent path, Hindi/Hinglish voice, exercises from RAG, undo fix, board reader, Assamese counting.

---

## 14. Deliverables

### 14.1 "How Cline was used" evidence (collect throughout the day)

| In the build | Inside the product |
|--------------|--------------------|
| Plan mode used to produce this `plan.md` from repo inspection + PS | `@cline/sdk` `Agent` is the classroom brain (`server/cline/clineAdapter.ts`) |
| `.clinerules/` encoding AGENTS.md zero-thrashing rules | `createTool` for 25+ tools (board bridge, RAG, NIPUN, FLN, assistant) |
| Act mode per lane, checkpoints before risky refactors (BUG-2 history rewrite) | `beforeTool`/`afterRun` hooks for grounding gate, budget, safety, INR telemetry |
| Cline workflow `/add-language.md` (scaffolds a new Indian language, demoed live) | Provider gateway: Gemini ↔ Sarvam ↔ Ollama (offline) with one code path |
| Cline task history + diffs screenshots in PPT | `vaani-classroom` `AgentPlugin` usable from Cline CLI by DIET/SCERT content teams |
| Cline used to write tests and fix failures (show red → green) | Build-time Cline agent tags syllabus chunks with NIPUN codes (`submit_tags`, `completesRun`) |

### 14.2 Demo video (≤ 4 min; mandatory)

1. **0:00–0:20** Problem: a rural multi-grade classroom photo or clip and a line about language (no stock clichés). Mention a teacher with a disability.
2. **0:20–0:50** Cline in the build: time-lapse of Cline Plan → Act on `clineAdapter.ts`, a checkpoint restore, tests going green.
3. **0:50–3:10** Real user scenario (a teacher or team member role-playing Sunita/Rupjyoti, speaking naturally): commands #1 → #3 → "exercise dikhao" → doubt → #6 NIPUN → #4 Assamese counting → #8 undo → #7 read aloud. Keep the **agent event log** (tool-started: `search_syllabus` …) visible in a corner to show the Cline SDK at work.
4. **3:10–3:40** Offline: pull the Wi-Fi, switch provider to Ollama, show "20 tak addition quiz" still works.
5. **3:40–4:00** Impact + future scope.

### 14.3 README outline

Problem → Who it's for → Demo GIF → Features (8 commands) → Architecture diagram (§4) → Tech stack → **How Cline was used (build + product)** → Setup (Node ≥ 22, `npm ci`, `.env`, `npm run ingest:syllabus`, `npm run dev`, optional Ollama `gemma4:e2b`, optional faster-whisper) → Languages supported matrix → Accessibility → Offline mode → Credits (Trido, Ardellio Satria Anindito, Pak Damar; NCERT; NIPUN Bharat; Sarvam; Bhashini) → Licence (MIT, retaining the original copyright notice).

### 14.4 PPT (10 slides) and social post

1 Problem · 2 Persona/story · 3 Solution + 8 commands · 4 Architecture · 5 AI models & tools (Cline SDK, Gemini, Sarvam saaras/bulbul, Gemma via Ollama, Bhashini) · 6 Cline in build · 7 Cline in product · 8 Challenges (Indic PDF extraction, Assamese TTS gap, code-mixed STT, undo bug) · 9 Impact & metrics · 10 Future scope (all 22 languages, SCERT books, DIKSHA integration, NIPUN progress dashboards, student device doubts).
Social: a 30-s clip of "Board pe water cycle ka mind map banao", tagging @cline with #ClineHackathon.

---

## 15. Testing and acceptance

### 15.1 Automated (Vitest, no live network per AGENTS.md rule 5)

| Test file | Asserts |
|-----------|---------|
| `tests/clineAdapter.test.ts` | Agent built with the right provider/tools; buffered board calls returned in the legacy shape; abort propagates. Model mocked via the SDK's `AgentRuntime` with a fake `AgentModel` (scripted tool calls). |
| `tests/exampleCommands.test.ts` | All 8 brief commands → expected route (reflex vs agent) and expected tool sequence (§7.3) |
| `tests/reflexGrammar.test.ts` | 60+ utterances (Devanagari, Roman Hindi, Assamese, English) → reflex id or none; negative cases ("undo karo aur quiz banao" → agent) |
| `tests/indicNormalize.test.ts` | NFC, digit mapping (`२०`, `২০`), loanword map, language-override detection |
| `tests/rag/*.test.ts` | BM25 ranking, romanisation, chapter resolution, gold-set Recall@5 ≥ 0.85, exercise exact-match ≥ 0.9 |
| `tests/mathPractice.test.ts` | 1000 seeded questions: answer correct, within `max`, 4 unique options, no-carry respected |
| `tests/undoTurn.test.ts` | BUG-1/BUG-2 regression; transaction grouping |
| `tests/boardToText.test.ts` | Reading order, mind-map walk, quiz read-out in hi/as |
| `tests/languages.test.ts` (replaces `multilingual.test.ts`) | Every profile has bcp47, font, digits; `hi` has all keys of `en` |
| `tests/noIndonesian.test.ts` | No Indonesian markers left in app code |
| `tests/voiceRouter.test.ts` | Sarvam request shape (multipart fields, header) with mocked `fetch`; fallback order |

Gate: `npm run check && npx vitest run` must be green before every merge to `main` (current baseline: 110/110).

### 15.2 Manual acceptance (demo checklist)

- [ ] 8 brief commands work by **voice** on Chrome (Sarvam STT) in < 8 s each
- [ ] "Is chapter ka exercise dikhao" shows verbatim exercises with printed page numbers for NCERT Class 9 Science Ch 2, Ch 13 and Maths Ch 1 (spot-check against the PDF), with the teacher-only Answer Key toggle working for Science
- [ ] A doubt produces a cited proposal; approving puts it on the board; undo removes it in one step
- [ ] Assamese counting shows ১–১০ and Assamese number words; the board reader speaks or highlights them
- [ ] Offline (Wi-Fi off, Ollama): reflexes, math quiz, counting, exercises, board reader work
- [ ] Keyboard-only and screen-reader (VoiceOver/NVDA) smoke test of mic, read board, undo, assistant approve
- [ ] No Indonesian text anywhere in the UI

---

## 16. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|:---:|:---:|-----------|
| Cline SDK is pre-1.0 (`0.0.92`); API drift | M | H | Pin exact version; isolate in `server/cline/*`; `AI_ENGINE=legacy` fallback keeps the old adapters working |
| Gemini tool-calling via SDK differs from native adapter (e.g. schema conversion of `Type.OBJECT` enums) | M | M | `toJsonSchema` unit tests; H1 checkpoint with one real call made manually from the UI (not a scripted network test) |
| NCERT Hindi PDFs extract as garbled text (legacy fonts): **confirmed** for Class 9 Hindi-medium Science (`ihsc1`) | H | M | The demo uses the clean English-medium Class 9 books. Hindi board content is produced by the agent from English evidence and cites the English page. A valid-word-ratio detector routes to OCR (Gemini vision / Sarvam Vision) post-MVP. |
| NCERT server slow / flaky (timeouts seen during inspection) | H | L | The PDFs are already downloaded once (169 MB) and copied to demo machines. The prebuilt index ships with the demo build, with no runtime download. |
| Maths formulas mangled by text extraction | M | L | "View original page" link on exercise sheets. Optional Gemini vision re-extraction for `iemh1` exercise pages only. |
| Assamese TTS gap in Sarvam; browser voices rarely ship `as-IN` | H | M | Bhashini TTS; Bengali-voice fallback flagged as approximate; on-screen highlight always on |
| Code-mixed STT errors on subject words | M | M | Sarvam `codemix` + chapter `keyterms`; editable transcript before submit (`autoSubmit` toggle exists) |
| LLM writes wrong facts for children | M | H | Grounding gate + citations; deterministic FLN generators; teacher approval for assistant content |
| Model-generated HTML/JS on a children's screen (XSS) | M | H | SEC-1/SEC-2 fixes; `beforeTool` blocks network/storage in apps |
| Node ≥ 22 requirement breaks Electron/Vercel | M | M | OPS-1 and §5.8 changes; desktop build is not on the demo path |
| 8-hour overrun | H | M | Cut-line in §13; checkpoints every ~2 hours; contracts agreed at H0 |
| Licensing of textbook content (books state "© NCERT 2026, ALL RIGHTS RESERVED") | M | M | No PDFs or full derived index committed (`data/` is gitignored); test fixtures hold short excerpts only; citations always shown; get NCERT permission before public launch. Demo use is non-commercial and educational. |
| Attribution / licence | L | M | Keep MIT notice and credits to Trido and Pak Damar |

---

## 17. Open questions (decide at H0, defaults given)

1. **Product name:** default *Vaani Board*.
2. **Default cloud model:** Gemini (`gemini-3.8-flash`, repo default) vs Sarvam `sarvam-105b`. Default: Gemini for the board agent, Sarvam for STT/TTS; flip if Sarvam tool calling proves reliable in H2.
3. ~~Demo chapters~~ **Decided:** NCERT **Class 9** public books. Science *Exploration* (all 13 chapters + Answer Key) and Maths *Ganita Manjari* Part I (8 chapters). Hero chapters for the video: Science Ch 13 "Earth as a System" (water cycle, photosynthesis, exercises p. 267) and Ch 2 "Cell" (exercises + answer key). Primary-grade FLN commands (#2, #3, #4) use the deterministic widgets and need no textbook.
4. **Keep the non-Indian UN languages** (`ar, zh, fr, …`) in the picker? Default: remove from the picker, keep the code path.
5. **API keys available on demo day:** Gemini ✅? Sarvam? Bhashini (needs registration lead time)? If Bhashini is unavailable, Assamese voice falls back to on-screen highlight plus browser voice.
6. **Team size and lane assignment** for §13.

---

## Appendix A. Reference links

- Cline SDK: https://docs.cline.bot/sdk/overview · Tools: https://docs.cline.bot/sdk/tools · Events: https://docs.cline.bot/sdk/events · Plugins: https://docs.cline.bot/sdk/plugins · Agent API: https://docs.cline.bot/sdk/reference/agent · npm `@cline/sdk`
- Sarvam: STT https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe · TTS https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert · Models https://docs.sarvam.ai/api-reference-docs/getting-started/models
- Bhashini / ULCA APIs: https://bhashini.gitbook.io/bhashini-apis
- NCERT textbooks: https://ncert.nic.in/textbook.php · NIPUN Bharat guidelines (MoE, 2021): https://dsel.education.gov.in/nipun-bharat
- Upstream: https://github.com/Ardelyo/trido · Kaggle Gemma 4 Good winners: https://www.kaggle.com/competitions/gemma-4-good-hackathon/hackathon-winners

## Appendix B. Verification log for this plan

| Check | Result |
|-------|--------|
| Repo pulled | `origin` (medharmurthy/Cline-AI-Hackathon) was empty, so `upstream` = Ardelyo/trido `main` @ `16b36ae` was checked out as local `main` |
| NCERT Class 9 corpus | Downloaded `iesc1ps`, `iesc101–113`, `iemh1ps`, `iemh101–108`, `ihsc101–102` (25 PDFs, 169 MB) → `data/syllabus/raw/ncert/class9/` (gitignored). Parsed with `pdf-parse` v2: English books clean; RRR/EOC exercise blocks found in every chapter except Sci Ch 1; Answer Key at the end of `iesc113.pdf`; Hindi-medium `ihsc1` garbled (legacy font). Maths Part II (`iemh2`) exists (`iemh2ps.pdf` responds) but chapter downloads timed out; add it later with `--book iemh2` if needed. |
| `npm ci` | 1240 packages, exit 0 |
| `npm run check` (`tsc --noEmit`) | exit 0 |
| `npx vitest run` | 16 files, 110 tests passed |
| `npm view @cline/sdk` | `0.0.92`, `engines.node >=22`; provider catalog includes `gemini`, `vertex`, `sarvam`, `ollama`, `openai-compatible` |
| `Intl` Indic digits (Node 25) | `as-IN` beng → `১,২৩,৪৫,৬৭,৮৯০`; `hi-IN` deva → `२०` |
| BUG-1 | `grep __tridoUndo` → referenced only in `useGeminiBrain.ts:110,114`, never assigned |
