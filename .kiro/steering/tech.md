---
inclusion: always
---
# Tech stack

- Next.js (App Router), TypeScript, Tailwind
- Supabase: Postgres for listings, pgvector for meaning based search, Edge Functions only if needed
- Claude API for the ghost operators (server side only, never expose the key)
- Embeddings for listings search: generate once at seed time, store in pgvector
- Voice: browser Web Speech API (SpeechRecognition for input, speechSynthesis for the operator voice). Always offer a typed fallback, recognition is not supported everywhere.
- Sound: Web Audio API for dial clicks, ring, static. No audio files we do not own.
- Hosting: Vercel on my own account

## Conventions
- All Claude calls go through one server route (`/api/operator`) with rate limiting per IP and a hard daily cap
- Secrets only in env vars. `.env*` is gitignored. `.kiro/` is NOT gitignored.
- Keep components small. Rotary dial is its own component with no business logic inside.
- Accessibility: the dial must also work with keyboard (number keys) and has an accessible label
- Mobile first: the dial must work with touch drag

## Cost guards
- Claude model: use a small fast model for operators, keep max tokens low
- Cap requests per session, show an in-character message when the cap is hit ("the line is busy, try later")
