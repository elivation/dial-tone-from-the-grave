---
inclusion: always
---

# Project structure

```
app/
  page.tsx              landing: the phone on a desk
  api/operator/route.ts Claude ghost operator endpoint
  api/search/route.ts   listings search (pgvector)
components/
  RotaryDial/           dial UI, drag and keyboard input, emits digits
  Handset/              pick up / hang up, call state
  PhoneBookPage/        renders results as a directory page
  Static/               visual and audio static effects
lib/
  operators.ts          operator definitions: number, name, persona prompt, voice settings
  audio.ts              Web Audio helpers
  supabase.ts
supabase/
  migrations/
  seed/                 demo listings and spirit listings
```

Numbers to operators live in `lib/operators.ts` only. Adding an operator should never need UI changes.
