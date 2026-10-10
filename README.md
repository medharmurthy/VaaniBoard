# Vaani Board — an India-first classroom whiteboard

A voice-first teaching assistant built for the **Cline AI Builder Hackathon**. It extends [Trido](https://github.com/Ardelyo/trido), retaining its Fabric/React whiteboard, widgets, local sessions, export and room sharing. The Indian classroom path adds Cline SDK agents, NCERT retrieval, Hindi/Hinglish voice and foundational learning activities.

## What works

- **Cline inside the product:** `@cline/sdk@0.0.92` runs the classroom agent with custom knowledge/board tools, grounding hooks, an action budget, cancellation and tool events. No shell, arbitrary filesystem or coding tools are exposed to it.
- **Cline account billing:** the default routes Gemini 3.5 Flash-Lite through Cline's gateway, spending Cline credits rather than Google AI Studio credits. Direct providers remain explicit alternatives.
- **NCERT Class 9 RAG:** English Science *Exploration* (13 chapters) and Maths *Ganita Manjari* Part I (8). Local BM25 retrieval, Hindi/Hinglish vocabulary expansion, chapter exercise sheets and printed-page/source links.
- **Deterministic local tools:** Hindi Swar/Vyanjan classification, Hindi counting (native digits and words), arithmetic quizzes with computed answers, textbook exercises. These clearly report `engine=local`; they are not passed off as AI output.
- **Teacher-reviewed assistant suggestions:** the Cline agent proposes explanations/answers privately; the teacher approves before the shared board changes.
- **Indic voice:** Sarvam-only speech recognition using `saaras:v4`; Hindi uses code-mixed transcription. Sarvam `bulbul:v3` read-aloud without browser/Whisper fallback (text captions on provider failure).
- **Accessibility foundations:** large keyboard-accessible FLN controls, board read-aloud/captions, high contrast, reduced-motion CSS, Hindi/Hinglish undo/redo and whole-turn undo of Fabric **and** DOM widgets.
- **Indian language profiles:** Hindi, English, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Odia, Punjabi. Native content is independent of teacher/UI language. Hindi core UI translations; other menus mostly fall back to English.

## Setup (Node 22+)

```bash
npm ci
cp .env.example .env
# Set your credentials/model configuration in .env (never commit keys).
npm run ingest:syllabus
npm run dev
```

Open **http://localhost:3000/app**. Open **Classroom tools** at the upper-right, select a chapter, and try a sample command.

The ingestion command uses already-installed PDFs at `data/syllabus/raw/ncert/class9/`, or downloads missing English chapters from NCERT. It produces a local `data/syllabus/index/index.json`. The NCERT server can be slow; prepare the corpus before the demo and copy the gitignored folder to other laptops. Hindi-medium PDFs need OCR and are **not** indexed by this implementation.

### Credentials and permissions

- **Cline credits (default):** set `CLINE_API_KEY` only in the server `.env`, `CLINE_PROVIDER=cline`, and `CLINE_MODEL=google/gemini-3.5-flash-lite`. Hackathon-credit eligibility was confirmed by the user. Select Auto (server configuration) or Cline account credits in Settings. The token is never requested or saved by the browser. Restart the server after changing `.env`.
- **Gemini:** `GEMINI_API_KEY`; default `GEMINI_MODEL=gemini-3.5-flash-lite` (stable, low-latency, function calling). Google standard pricing verified 10 Oct 2026: $0.30/M input and $2.50/M output tokens. Set a model enabled on your account. You may alternatively set a browser-local key in Settings, but use server-side keys on shared devices.
- **Sarvam:** `SARVAM_API_KEY` for Indic STT/TTS and optional `SARVAM_MODEL` (default `sarvam-105b`). Select Sarvam speech in Settings → Voice.
- **Vertex:** explicit `GOOGLE_CLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS`, `VERTEX_MODEL`; the original author's project is not used as a fallback.
- **Local AI:** install Ollama, pull your chosen model, set `OLLAMA_MODEL`, choose Ollama in Settings. Explicit Ollama selection never falls back to cloud. Remote Ollama endpoints must be administrator-configured.
- **Speech provider:** Sarvam only. The UI does not use browser recognition, browser TTS, or Whisper. Offline classrooms can use typed commands and on-screen text.
- **Billing:** a valid key/model catalogue response does not prove generation works. With Cline selected, **AI billing required** refers to your Cline account balance/access. Direct Gemini still needs [Google AI Studio](https://ai.studio/projects) credits; the existing direct-Google project has depleted prepaid credits, so the user requested the Cline switch. Local classroom activities and Sarvam speech remain independent of model billing. Provider failures never silently switch to direct Google.
- **AI status:** configured providers start as **unverified**. Actual Cline generation records success or a safe failure category; the UI refreshes immediately after a request. Status polling does not make billable model calls. Observations are process-local, expire after 15 minutes and reset on restart.
- **Microphone permission:** browsers require permission and a secure origin (localhost or HTTPS). Plain HTTP LAN pupil viewers should use typed input, not microphones.

Local activities and exercise retrieval need no cloud key. Creative diagrams, explanations, NIPUN lesson rewriting and assistant answers need a configured LLM. Automated tests never call live providers. Credential metadata checks do not generate lessons or audio.

### Model selection research (10 October 2026)

Google recommends **Gemini 3.5 Flash-Lite** for new low-latency/cost-sensitive projects. It supports function calling and structured outputs. Gemini 2.5 Flash-Lite is cheaper ($0.10/M input, $0.40/M output) but currently restricted to prior users, so it is not the default for this new project. The selected 3.5 model is $0.30/M input and $2.50/M output at standard pricing, including output thinking tokens. No Google Search/Maps tools are enabled; local NCERT retrieval avoids external grounding fees.

Sources: [model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [model availability](https://ai.google.dev/gemini-api/docs/models), [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [Sarvam language coverage](https://docs.sarvam.ai/api-reference-docs/getting-started/models).

## Commands

- “Board pe water cycle ka mind map banao.” (Cline agent; cloud/local LLM required)
- “Is chapter ka exercise dikhao.” (local NCERT retrieval; select chapter first)
- “Class 2 ke bachchon ke liye 20 tak addition ka quiz banao.” (local, checked maths)
- “Hindi mein Swar aur Vyanjan ka game banao.” (local)
- “Hindi mein ek simple counting activity banao.” (local)
- “Explain photosynthesis in simple Hindi with a labelled diagram.” (Cline agent)
- “Is lesson ko NIPUN mode mein convert karo.” (agent + NIPUN-inspired display mode)
- “Board par jo likha hai, use mujhe bolkar batao.” (read-aloud/captions)
- “Pichhla action undo karo.” (local whole-turn undo)

The NCERT source is Class 9, while FLN activities target Classes 1–3. The app does not label a Class 9 lesson as an official NIPUN target.

## Architecture

```text
Recorded Sarvam audio → Indic normalisation → local control grammar
  └→ /api/ai/generate → deterministic local tool OR Cline SDK Agent
      ├→ NCERT BM25 / exercise tools / checked arithmetic
      ├→ grounding hooks + teacher proposal boundary
      └→ buffered declarative board actions → existing animated processor
           → Fabric + React DOM widgets → Socket.IO viewers
```

Main code: `server/cline/`, `server/rag/`, `server/voiceRouter.ts`, `utils/languages.ts`, `components/fln/`, `components/ClassroomPanel.tsx`.
`plugins/vaani-classroom/index.ts` exports a Cline knowledge plugin for content-team usage; it exposes only syllabus and FLN tools.

## How Cline was used

Cline inspected upstream and the hackathon statement, produced `/plan.md`, implemented the changes, wrote fake-model/mocked-network tests, and checked the app in Chrome. `.clinerules/` records classroom safety and contribution rules. The product itself uses the Cline SDK loop, custom tools, hooks, provider gateway and subscriptions—not just Cline as a coding partner.

## Validation

```bash
npm run check
npm test
npm run build     # release verification, not repeated during iteration
```

Tests run without live LLM calls. The SDK loop is exercised with a fake `AgentModel`. Original fixtures in RAG tests avoid redistributing textbook pages. Browser checks verify local arithmetic, Hindi counting, exercise display (including final questions) and undo.

Validated on the development machine: **41 test files / 219 tests passed**, TypeScript check passed, and Vite/PWA plus server builds passed. Rendering tests use the actual vendored Mermaid parser and real KaTeX DOM; legacy Whisper tests now mock subprocesses rather than depend on the host or launch a model. Independent pipeline results:

| Stage | Result |
| --- | --- |
| Cline billing → Gemini 3.5 Flash-Lite | Live HTTP 200 Hindi note; live browser mind map renders as SVG and whole-turn undo passes |
| Direct Google Gemini billing | Still blocked by depleted Google project credits; not used by the default Cline route |
| Cline loop, grounding, proposals and NIPUN tools | Passed with fake `AgentModel`; gateway authentication and function calls covered with mocked fetch |
| NCERT retrieval and original PDF links | 21 chapters / 1,568 chunks; retrieval and exercise routes pass |
| Local letters, counting and checked arithmetic | Passed HTTP and Chrome checks, including Hindi arithmetic commands |
| Mind map / photosynthesis / proposal approval / NIPUN update | Chrome rendering passed using fake-model SDK responses |
| Multi-action and approved-proposal undo | Chrome and regression tests pass; original note restored with one undo |
| Sarvam TTS → STT → local action | Live short Hindi synthetic command passed |
| Browser microphone → transcript → letter game | Passed with fake microphone and mocked STT; zero page errors |
| Quadratic note + unsafe-label flowchart + digestive illustration | Real Chrome desktop/mobile rendering, non-overlap, reachable overflow and whole-turn undo pass with mocked generation |
| Speech-driven warnings | Tamil metadata yields Tamil warnings; detected Hindi/English mix, missing or unsupported metadata yields English; UI/board language stays independent |

The Cline-billed live browser check has zero page errors and confirms legacy Gemini preference migration to Auto. These checks do not establish real classroom speech accuracy or the quality of all possible generated lessons.

## Known limitations / remaining roadmap

- Direct Google billing remains depleted, but Cline-billed Gemini generation passes live. Sarvam live integration passes; real classroom Indic accuracy and broader generated-lesson quality assessment remain pending.
- The language list matches Sarvam Bulbul v3: 11 languages supported for both STT and TTS. Assamese and Urdu are intentionally excluded. No Bhashini, browser speech or Whisper fallback is used.
- NIPUN mode is **inspired foundational practice**, not official Lakshya certification or a child-progress assessment. Official targets require curriculum review.
- Answer-key pages are isolated in the index but not mapped per question or exposed through teacher-only authenticated retrieval yet.
- English corpus extraction is text-only; Maths formula typography may be imperfect. View the original PDF page. Other SCERT/primary books, dense retrieval and OCR are roadmap items.
- Hindi/English UI is only partially reviewed; some upstream secondary widgets still contain English fallback or legacy wording. Full localisation and accessibility audits are pending.
- Sarvam REST reports a single `language_code`, not an exhaustive mixed-language list. Script-based mixed-language evidence is a local heuristic; Roman Hinglish and languages sharing a script can remain ambiguous. Warning summaries are local translations with English technical details retained.
- New cards avoid existing objects and floating controls. Small screens use a horizontal toolbar, readable cards and explicit next-card/focus navigation rather than shrinking arbitrarily many elements. Existing cards are not automatically rearranged after resizing the window. Mermaid repair is bounded and cannot reconstruct malformed diagram topology.
- LAN sharing remains an upstream demo mechanism, not production school authentication. Do not deploy publicly with pupil records. Do not put confidential suggestions on a projected teacher screen.
- PWA caches the app shell, Fabric, Mermaid and bundled Indic fonts. Fresh offline starts still require a running local Express server for RAG; this is not a full browser-side offline RAG pack.
- Express/desktop is the supported demo target. Vercel has only minimal AI wrappers; voice, filesystem-backed corpus and persistent rooms are not a full serverless deployment.
- PPT, demo video, social submission, numbered voice targets, lesson-pack studio and desktop installer validation remain tasks for the team.

## Privacy and licences

No real credentials, pupil records, NCERT PDFs or full derived index are committed. `data/` is gitignored. Telemetry content is redacted and Sheets auto-sync defaults off. Recorded audio is sent only to Sarvam while recording or hands-free mode is enabled. Text is sent to Sarvam for read-aloud; provider failures use captions, not a different speech service.

NCERT PDFs state **© NCERT 2026, All rights reserved**. Public availability is not a redistribution licence. Keep the corpus local and review permissions before publishing derived indexes.

**Upstream attribution:** Trido by **Ardellio Satria Anindito**, inspired and tested upstream with **Pak Damar (Dadan Mochammad Ramdhan)** in Bandung. The original [MIT licence](LICENSE) and copyright remain intact. Vaani Board does not claim Trido's awards or original classroom adoption as its own. Gemma models have their own licence/terms; other providers' service terms apply.
