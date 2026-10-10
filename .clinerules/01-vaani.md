# Vaani Board coding rules
- Preserve AGENTS.md and upstream MIT attribution.
- Typecheck with npm run check. Batch whole-file reads and patches.
- Server-only Cline SDK imports. No shell/file tools in the classroom agent.
- No live model scripts in tests; use fake AgentModel and mocked fetch.
- Never commit credentials, NCERT PDFs, derived full indexes or pupil records.
- Local deterministic tools must identify engine=local, not pretend to be AI.
- Indian language profiles are the source of truth. Do not add Indonesian defaults.