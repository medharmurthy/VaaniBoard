# Add an Indian language
1. Read /Users/shudhanshuranjangupta/Cline-AI-Hackathon/utils/languages.ts and /Users/shudhanshuranjangupta/Cline-AI-Hackathon/types.ts.
2. Confirm current STT and TTS language support from provider docs. Never assume both support the same set.
3. Add native name, script/font, locale, numbering system, direction and explicit TTS capability.
4. Provide reviewed translations or explicitly retain the English fallback. Never claim machine-translated menus are reviewed.
5. Add normalisation/locale tests and run npm run check plus targeted Vitest tests.