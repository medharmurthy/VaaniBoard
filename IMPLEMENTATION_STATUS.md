# Implementation status — 10 October 2026

`plan.md` remains the full roadmap. This file records what is actually built, not projected completion.

## Implemented and checked
- Cline SDK 0.0.92 classroom agent and knowledge-only plugin; custom tools, grounding/budget hooks, explicit provider choice, abort deadline and event summaries.
- User-approved switch to Cline account credits: server-only CLINE_API_KEY, provider `cline`, model `google/gemini-3.5-flash-lite`. Auto follows the server configuration; explicit local-only remains local-only. One-time legacy direct-Gemini preference migration to Auto; subsequent explicit choices are preserved.
- Content helper routes (Express and serverless wrappers) now use the same SDK provider, rather than a hidden direct-Google call. Only declarative mindmap/quiz/summary content is accepted; generated websites are rejected.
- Offline BM25 index and ingestion for 21 NCERT Class 9 chapters. 1,568 chunks after handling two-column final-question ordering. Science Ch 2 has 16 end questions; Ch 13 has 15, including p. 268.
- Local deterministic arithmetic/letters/counting/exercise route, labelled `engine=local`.
- Indian profile registry and defaults; core Hindi chrome and English fallback. Native digits and Hindi 1–10 number words; 11 Sarvam voice languages only.
- Sarvam STT/TTS routes with bounded/validated inputs and explicit missing-key/unsupported-language messages; Sarvam-only speech: failures fall back to text, not browser speech or Whisper.
- Teacher proposal approval/rejection and caption/read-aloud commands.
- Unified DOM/Fabric undo transactions and stale queue processing bug fixed; browser-tested. Multi-action turns now retain the processor lock through commit, preventing synchronous Zustand subscribers from splitting an edit + activity into separate undo steps.
- Safe classified AI errors (billing, credentials, model, quota, timeout); observed per-provider generation health, immediate client refresh and truthful configured/unverified status. Status polling never performs paid generation.
- Sandboxed imported HTML and generated apps without same-origin privileges. No shell/file tools in the classroom agent.
- Local Fabric and Hindi/Bengali fonts; PWA production build passes.

## Visual rendering and classroom UI fixes
- Mermaid formula-label parsing is reproduced with the exact vendored renderer: unquoted parentheses fail; shared DOM-free normalization preserves Unicode, safely quotes recognized node labels and removes model fences. The browser validates the original source, makes at most one deterministic local repair, and exposes an editor/source fallback instead of inventing a substitute chart. Server direct/add/update Mermaid tools share the normalizer; no CDN fallback.
- Formula regressions inspect real KaTeX DOM, including doubled delimiters/commands, Fourier coefficients, aligned/matrix row breaks, escaped currency and protected code. Invalid LaTeX keeps its source and offers a localized actionable warning.
- New-turn card layout uses actual Fabric viewport dimensions, zoom/pan, existing Fabric and DOM bounds and marked UI controls. It sizes coherent rows/columns without moving existing work, and publishes/commits a full turn atomically. Readable overflow has explicit next-card navigation (translation-only pan or focus view when constrained); arbitrary numbers of cards cannot all fit a phone screen simultaneously.
- Audio warning language is separate from interface and board language. Sarvam requests auto-detection (`language_code=unknown`); supported single-language metadata selects local warning summaries, while missing/unsupported or multiple detected languages use English. Typed requests use the selected interface language. REST exposes only one `language_code`; mixed-script evidence is a documented local heuristic, not exhaustive language detection (Roman Hinglish and shared scripts remain ambiguous). No translation network calls.
- High-priority Indonesian/half-translated toasts, errors, export/import actions, quiz feedback and controls are replaced with English. Local warning summaries cover the 11 supported Indian profiles, with English technical details preserved; full native-speaker UI translation remains outstanding.
- Trido comparison reviewed `upstream/main` grid anchors, Mermaid renderer and matrix-pinned overlays. Retained explicit grid moves, world-space board interactions and focus view; added live occupancy, strict local rendering and touch/zoom-safe card handling instead of merging upstream code.
- Dedicated SDK tools route formulas to validated KaTeX lesson notes and physical/anatomical pictures to safe vector illustrations, not Mermaid process charts.
- Real digestive-system, photosynthesis and water-cycle scenes replace the photosynthesis-only widget. Missing/mismatched templates show an explicit error; other subjects support bounded declarative vector shapes, never arbitrary SVG/JavaScript or a silently substituted template.
- Math normalization preserves Greek commands, supports common delimiters/math fences, corrects over-escaped model output, and uses locally bundled matching KaTeX CSS/fonts. Syntax checking does not certify mathematical correctness.
- Classroom tools now have Create/Curriculum/Review sections, typed requests and example cards; navigation starts collapsed, lesson cards are larger, controls are responsive and completed agent cursors no longer obscure the lesson.
- Live Cline Chrome checks: digestive-system illustration, Fourier series/coefficient formulas and water-cycle illustration all render and whole-turn undo passes. Phone-width controls fit; no browser page errors. Photos/photosensitive medical advice are not image-generation capabilities.

## Verification
- Latest round: **219 tests / 41 files pass**, including HMR wiring, cursor visibility and deterministic legacy Whisper subprocess boundaries. Desktop (1440×1000) and phone (390×844) Chrome checks use mocked generation and fake-microphone STT: quadratic note + unsafe-label flowchart + digestive illustration, no overlapping new cards, reachable overflow, whole-turn undo, Tamil warning language and mixed-language English all pass. The final browser run reports zero page errors after attaching Vite HMR to the Express HTTP server.
- Web/PWA and server builds pass; credential-literal scans pass and `.env` remains ignored with mode 600. Removed only regenerable npm cache to recover about 3.3 GB; project data and credentials were not deleted.
- `npm run check` passes; the visual regression suite expands testing to 34 files / 152 tests. Production Vite/PWA build passes (existing chunk-size, mixed-import and document-parser browser-externalization warnings remain).
- Mocked SDK loop and offline tests; no live model scripts.
- Chrome: arithmetic quiz renders, undo removes it, Hindi counting renders, Class 9 exercises render including Q15; no page errors.
- Chrome fake-microphone test with a mocked Sarvam STT response passes through recording → Sarvam route → Hindi letter game; legacy Assamese/browser-voice settings migrate to Hindi/Sarvam.
- Live Sarvam Hindi TTS → STT returns HTTP 200; a short synthetic command is recognised and routed to a local counting widget. This is a provider integration check, not a real-classroom accuracy assessment.
- Chrome separately passes local letters/counting/quizzes, source exercises including Q15, truthful billing status, fake-model SDK mind map and photosynthesis SVG rendering, retrieved student doubt → private proposal → approval, and fake-model NIPUN in-place note update + counting → whole-turn undo. Zero browser page errors. Automated lesson tests use fake models.
- Cline authenticated catalogue returns HTTP 200 with the selected model. Live Cline-billed Hindi lesson returns HTTP 200, one DOCUMENT_PAGE action and two SDK iterations (6,054 input / 134 output tokens). A separate live Chrome Cline-billed water-cycle mind map renders its SVG and whole-turn undo passes; zero page errors. Credentials and raw provider responses are not printed.
- Hindi `जोड़ का अभ्यास` now selects checked arithmetic rather than chapter exercises; local arithmetic bounds are enforced.

## Credentials / access
- Cline/Gemini/Sarvam keys are stored only in local gitignored .env (owner-only permissions). They must be rotated before deployment because they were shared in chat. No Cline credential is accepted from or persisted in browser settings.
- Direct Google Gemini generation reported **depleted prepaid credits**. The user confirmed hackathon credits can be used and requested Cline billing instead. The default now uses stable `google/gemini-3.5-flash-lite` through Cline; live generation succeeds. Direct Google remains an explicit alternative needing its own credits. Billing errors point to the selected provider, not always Google AI Studio.
- In-process health observations expire after 15 minutes and reset on server restart; they do not replace durable monitoring or serverless cross-instance health storage.
- Microphone permission at localhost/HTTPS.
- Teammate runtime returned a Cline authentication error; delegation was unavailable and implementation continued directly.

## Not yet complete
- All-language human-reviewed UI and script fonts beyond Hindi/Bengali. Assamese/Urdu and Bhashini are outside current scope.
- Per-question answer-key mapping and secure teacher-only answer retrieval.
- Official NIPUN Lakshya dataset verification (currently cautious FLN scaffolds), no child-progress tracking.
- Dense retrieval, rigorous 40-query corpus Recall@5 evaluation, teacher-upload corpus indexing, Hindi PDF OCR.
- Numbered voice targets, browser-only offline curriculum packs, SDK SSE progress and lesson-pack studio.
- Production room authorization, full accessibility audit, broader live grounded/NIPUN lesson quality validation, real-classroom speech assessment, desktop installer and serverless parity.
- Presentation/video/social deliverables.

No implementation commit or push has been made. PDFs/index stay gitignored. Preserve upstream MIT attribution and AGENTS.md.
