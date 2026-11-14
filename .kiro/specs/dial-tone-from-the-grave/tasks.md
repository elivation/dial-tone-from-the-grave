# Implementation Plan: Dial Tone from the Grave

## Overview

Tasks are grouped into 8 phases. Phase 1 (scaffold) must be complete before all others. Phases 2 (dial), 3 (state machine and audio) and 4 (data and search) can run in parallel after Phase 1. Phase 5 (operators) depends on 3 and 4. Phase 6 (phone book) depends on 4 and 5. Phase 7 (limits, security, deploy) depends on 5 and 6. Phase 8 (polish and submission docs) depends on all prior phases.

The rotary dial is the hero feature and comes first within Phase 2.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"],
      "description": "Project scaffold and tooling"
    },
    {
      "wave": 2,
      "tasks": [
        "2.1",
        "2.2",
        "2.3",
        "2.4",
        "2.5",
        "3.1",
        "3.2",
        "3.3",
        "3.4",
        "4.1",
        "4.2",
        "4.3",
        "4.4"
      ],
      "description": "Rotary dial, state machine, audio, data (parallelisable)"
    },
    {
      "wave": 3,
      "tasks": ["4.5", "4.6", "5.1"],
      "description": "Search route, spooky query, operator definitions"
    },
    {
      "wave": 4,
      "tasks": ["5.2", "5.3", "5.4"],
      "description": "Operator API route, panel, streaming"
    },
    {
      "wave": 5,
      "tasks": ["6.1", "6.2", "6.3", "6.4"],
      "description": "Phone book pages and static overlay"
    },
    {
      "wave": 6,
      "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5"],
      "description": "Limits, security, deploy, fallbacks"
    },
    {
      "wave": 7,
      "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7"],
      "description": "Polish and submission docs"
    }
  ]
}
```

## Tasks

- [ ] 1. Initialise Next.js project with pnpm

  Set up the base project. Run `pnpm create next-app` with App Router, TypeScript strict, Tailwind CSS, ESLint. Set `"strict": true` in `tsconfig.json`. Add Prettier with a `.prettierrc` (single quotes, 100 char line width, trailing commas). Add `lint-staged` and `husky` pre-commit hook running `eslint --fix` and `prettier --write` on staged files.

  Done when: `pnpm build`, `pnpm lint` and `pnpm typecheck` all pass with zero errors on a clean checkout.

  Requirements: Req 10 (foundation for all security controls)

  Tests: none (tooling only)

- [ ] 2. Add Vitest, React Testing Library, fast-check and Playwright

  Install `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `fast-check`. Configure `vitest.config.ts` with jsdom environment. Install `@playwright/test` and run `playwright install chromium`. Add `pnpm test`, `pnpm test:e2e` and `pnpm typecheck` scripts. Write a smoke unit test and a smoke E2E test (visit `/`, assert `<html>` exists).

  Done when: `pnpm test`, `pnpm test:e2e` and `pnpm typecheck` all pass.

  Requirements: Req 1, 2, 10 (test stack needed for all property and unit tests)

  Tests: smoke unit test; smoke E2E test

- [ ] 3. Configure Supabase client and environment variables

  Install `@supabase/supabase-js`. Create `lib/supabase.ts` (browser client) and `lib/supabase-server.ts` (service-role, `server-only` import guard). Create `.env.example` with every variable from the design, with comments, no real values. Add `.env`, `.env.local`, `.env*.local` to `.gitignore`. Confirm `.kiro/` is NOT in `.gitignore`.

  Done when: both clients export without type errors; `.env.example` committed; `pnpm build` passes; `.kiro/` not in `.gitignore`.

  Requirements: Req 10.5, 10.10

  Tests: `lib/supabase.test.ts` (browser client created with correct URL using mocked env vars)

- [ ] 4. Create project directory structure and testing steering file

  Create empty index files at: `components/RotaryDial/`, `components/Handset/`, `components/PhoneBookPage/`, `components/Static/`, `lib/operators.ts`, `lib/audio.ts`, `lib/spooky.ts`, `supabase/migrations/`, `supabase/seed/`. Create `.kiro/steering/testing.md` with project testing rules: Vitest + RTL for units, fast-check for property tests, Playwright for E2E; every AC maps to a test; test name format `[Req N.AC] description`; never delete a failing test without explanation.

  Done when: all directories exist; `testing.md` committed; `pnpm build` passes.

  Requirements: (structural foundation)

  Tests: none

- [ ] 5. Create Kiro agent hooks

  Create five hooks in `.kiro/hooks/`. Hook 1 (`lint-on-save.json`): PostFileSave on `\.(ts|tsx)$`, runs eslint and tsc on the saved file. Hook 2 (`test-on-save.json`): PostFileSave on `(lib/|components/RotaryDial)`, runs vitest filtered to the saved file. Hook 3 (`rls-check.json`): PostFileSave on `supabase/migrations/`, checks every `create table` has matching `enable row level security`, exits 2 if not. Hook 4 (`operator-safety.json`): PostFileSave on `lib/operators\.ts$`, checks operator numbers against EMERGENCY_NUMBERS, exits 2 if any match. Hook 5 (`update-writeup.json`): UserPromptSubmit (manual), agent action refreshing KIRO_USAGE.md.

  Done when: all five `.kiro/hooks/*.json` files exist and are valid JSON matching the hook schema.

  Requirements: (Kiro feature requirement for submission)

  Tests: manual verification that hooks fire in the IDE

- [x] 6. Implement dial geometry and angle/pulse maths (property tests first)

  Create `lib/dial.ts` exporting `HOLE_ANGLES`, `STOP_ANGLE` (345), `PULSES`, `returnDuration(digit)`, `shouldRegister(digit, angle)`, `digitFromHoleIndex(index)`. Write property-based tests in `lib/dial.test.ts` BEFORE implementing: P1 (`returnDuration(d) === PULSES[d] * 100`), P2 (pulse count equals face value or 10 for "0"), P3 (all HOLE_ANGLES unique in [0, 360)), P4 (shouldRegister true within 3 degrees of stop, false outside). Implement until all pass.

  Done when: `pnpm test` passes with all four property tests green; `pnpm typecheck` clean.

  Requirements: Req 1.1, 1.2, 1.3, 1.4

  Tests: `lib/dial.test.ts` (4 fast-check property tests)

- [x] 7. Build the RotaryDial SVG component (static render)

  Create `components/RotaryDial/RotaryDial.tsx` as a pure SVG component. Render: outer dial plate circle, inner number ring, 10 finger holes at angles from `HOLE_ANGLES`, digits on the number ring, metal finger stop arc at `STOP_ANGLE`. Props: `disabled: boolean`, `onDigit: (digit: string) => void`, `rotation: number`. Add `aria-label="Rotary dial"` to the SVG root and an `aria-live="polite"` region for digit announcements.

  Done when: render test passes (component mounts, 10 holes in DOM, aria-label present); `pnpm typecheck` clean.

  Requirements: Req 1.6, 1.7, Req 9.1

  Tests: `components/RotaryDial/RotaryDial.test.tsx` (renders without error; 10 holes present; aria-label present)

- [x] 8. Add mouse and touch drag interaction to RotaryDial

  Add pointer event handlers to each finger hole. Track drag angle clockwise only. On pointerup: call `shouldRegister`. If true, call `onDigit` and start return animation (10 pulses/second, `setInterval` at 100 ms). If false, spring back without calling `onDigit`. Fire one click sound stub per pulse. Use `touch-action: none` on draggable elements.

  Done when: drag-to-stop test calls `onDigit` with correct digit; early-release test does not call `onDigit`; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 1.1, 1.2, 1.3, 1.5

  Tests: `components/RotaryDial/RotaryDial.test.tsx` (full drag calls onDigit; early release does not)

- [ ] 9. Add keyboard interaction to RotaryDial

  On `keydown` for keys 0-9 (when not disabled): animate the correct hole clockwise to the finger stop over 150 ms (CSS transition), then start the normal return sequence. With `prefers-reduced-motion`: skip both animations, call `onDigit` immediately, still schedule click sounds.

  Done when: keyboard test passes (`onDigit("5")` called on key "5"); reduced-motion test passes (`onDigit` called without animation delay); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 1.5, 1.8, Req 9.2, 9.4

  Tests: `components/RotaryDial/RotaryDial.test.tsx` (keyboard digit; keyboard with prefers-reduced-motion)

- [ ] 10. ARIA live region announcement per digit

  After `onDigit` fires, update the `aria-live="polite"` region to "Dialled: {digit}". Clear after 1 second.

  Done when: test asserts live region text equals "Dialled: 5" after firing digit "5"; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 1.7, Req 9.1

  Tests: `components/RotaryDial/RotaryDial.test.tsx` (live region updated after digit)

- [ ] 11. Implement the call state machine (useReducer, test-first)

  Create `lib/callMachine.ts` exporting `CallState`, `CallEvent`, `callReducer`, and `EMERGENCY_NUMBERS` set (imported from `lib/operators.ts`). Write unit tests for every transition before implementing: idle+PICK_UP, off-hook+DIGIT_DIALLED, dialling+CALL_PLACED (match and no-match), dialling+EMERGENCY_NUMBER (must route to emergency-notice not wrong-number), ringing+RINGS_COMPLETE, connected+HANG_UP, connected+TURN_CAP_REACHED, connected+RATE_LIMITED, busy+SEQUENCE_COMPLETE, wrong-number+SEQUENCE_COMPLETE, emergency-notice+DISMISSED, connected+DIGIT_DIALLED (stays connected). Write fast-check P5 (reducer never returns undefined) and P6 (every emergency number routes to emergency-notice).

  Done when: 13 transition tests + 2 property tests pass; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10

  Tests: `lib/callMachine.test.ts` (13 unit + 2 property tests)

- [ ] 12. Implement the AudioEngine

  Create `lib/audio.ts` exporting `AudioEngine` class with methods for each sound (dial tone 400 Hz, ring tone 400+450 Hz SA cadence, busy tone, disconnected pips, dial click via bandpass noise, static/crackle via AM-modulated noise). `AudioContext` created lazily. Read mute state from `sessionStorage` key `dtftg_muted` on init. `setMuted(true)` sets master gain to 0. Guard all methods for suspended context.

  Done when: unit tests pass with mocked AudioContext (dialTone creates 400 Hz oscillator; click creates buffer source; setMuted(true) sets gain to 0); starts muted; `pnpm typecheck` clean.

  Requirements: Req 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8

  Tests: `lib/audio.test.ts` (dialTone frequency; click source; mute sets gain to 0)

- [ ] 13. Build Handset component and wire state machine to audio

  Create `components/Handset/Handset.tsx` (pick-up / hang-up buttons). In `app/page.tsx`, instantiate `useReducer(callReducer)` and wire all events. Connect AudioEngine to state transitions. Implement the 2-second dial timer (`CALL_PLACED` after last digit). Implement the ring sequence (`RINGS_COMPLETE` after N ticks). Render the `emergency-notice` state as a plain white overlay (no spooky styling) with the safety message: "This is a game and cannot call anyone. If you have an emergency, please use a real phone and dial 112 or 10111." and a dismiss button.

  Done when: pick-up test passes; hang-up-from-connected transitions to idle; emergency-notice overlay renders correct message text; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.10, Req 8.3, 8.4, 8.5, 8.6

  Tests: `components/Handset/Handset.test.tsx` (pick-up; hang-up; emergency-notice overlay)

- [ ] 14. Implement MuteToggle component

  Create `components/MuteToggle/MuteToggle.tsx`: button labelled "Mute"/"Unmute". On mount, read `dtftg_muted` from `sessionStorage` (default: `true`, muted). On toggle, write to sessionStorage and call `AudioEngine.setMuted()`.

  Done when: test passes (starts as "Unmute"; clicking calls setMuted(false) and label changes to "Mute"); `pnpm typecheck` clean.

  Requirements: Req 8.7, Req 9.4

  Tests: `components/MuteToggle/MuteToggle.test.tsx` (initial state muted; toggle changes state)

- [ ] 15. Supabase migrations: extensions, tables, RLS, RPCs

  Write migration files: `0001_extensions.sql` (enable pgvector, pg_trgm), `0002_businesses.sql` (table, indexes, RLS, public read policy), `0003_residents.sql` (table, indexes, RLS, public read policy), `0004_rate_limits.sql` (table, RLS no public access, `increment_rate_limit` function), `0005_rpcs.sql` (`search_businesses` and `search_residents` per design). Apply with `supabase db push`. Verify RLS on all three tables.

  Done when: `supabase db push` succeeds; all five migration files committed; RLS verified on all tables via `supabase inspect db rls`.

  Requirements: Req 4.1, 4.2, Req 6.3, Req 10.6

  Tests: RLS check hook fires on each migration save; manual verification of RLS via inspect.

- [ ] 16. Create the embed Edge Function

  Write `supabase/functions/embed/index.ts`: accepts `{ text: string }` POST, calls the Supabase AI gte-small model, returns `{ embedding: number[] }`. Deploy with `supabase functions deploy embed`. Smoke test: call with a known string, assert returned array has length 384.

  Done when: function deployed; smoke test passes; `pnpm typecheck` clean.

  Requirements: Req 4.1, 4.2 (embedding underpins both search tools)

  Tests: `supabase/functions/embed/embed.test.ts` (returned array length 384)

- [ ] 17. Seed business listings (150 businesses + 12 spirit listings)

  Write `supabase/seed/businesses.ts`: array of ~150 fictional businesses across required categories and suburbs (Edenvale, Bedfordview, Kempton Park, Germiston, Lombardy East, Sandringham, Boksburg). Include ~12 spirit listings (`is_spirit: true`) and some boxed adverts (`is_advert: true`). All phones `011 000 xxxx`. Write `supabase/seed/run.ts`: for each row, call the embed Edge Function and upsert into businesses via the server secret key client.

  Done when: seed runs without error; `SELECT COUNT(*) FROM businesses` >= 150; at least 12 rows with `is_spirit = true`; brand name grep on seed file returns nothing.

  Requirements: Req 4.1, Req 7.1, Req 5.1, 5.2

  Tests: brand name scan on seed file; row count verification

- [ ] 18. Seed resident listings (80 residents)

  Write `supabase/seed/residents.ts`: array of ~80 invented residents with South African surname mix (van der Merwe, Botha, Nkosi, Dlamini, Patel, Singh, Coetzee, etc.) across the same suburbs. Include surname variants to exercise fuzzy match. All phones fictional. Run seed with embedding.

  Done when: seed runs; `SELECT COUNT(*) FROM residents` >= 80; `pnpm typecheck` clean.

  Requirements: Req 6.3, Req 4.2

  Tests: row count verification

- [ ] 19. Implement /api/search route

  Create `app/api/search/route.ts`. Zod validation: `{ type, query (max 300), spooky?, spiritOnly? }`. Hash IP, check/increment `search_count` via `increment_rate_limit`. Return 429 with in-character JSON if limit exceeded. Call embed Edge Function. Call `search_businesses` or `search_residents` RPC. Return typed JSON.

  Done when: unit tests pass (valid business query returns results; valid resident query returns results; Zod rejects missing type; over-limit returns 429 with in-character message; spiritOnly calls RPC with spirit_only flag); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 4.1, 4.2, 4.4, Req 7.2, Req 10.2, 10.4, 10.7

  Tests: `app/api/search/route.test.ts` (5 unit tests)

- [ ] 20. Implement lib/spooky.ts and test isSpookyQuery

  Create `lib/spooky.ts` exporting `SPOOKY_KEYWORDS: string[]` and `isSpookyQuery(query: string): boolean`. Write fast-check P7 (true iff query contains a keyword substring, case-insensitive). Write unit tests: spooky query returns true; non-spooky returns false; case-insensitive match.

  Done when: P7 property test and unit tests pass; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 7.2, Req 4.11

  Tests: `lib/spooky.test.ts` (1 property test + 3 unit tests)

- [ ] 21. Define all operators in lib/operators.ts

  Define `OperatorDefinition` type. Export `OPERATORS: Record<string, OperatorDefinition>` for 1023, 1026, 666, 1313 with full system prompts per design. Export `EMERGENCY_NUMBERS: Set<string>` ("10111", "10177", "107", "112", "911", "999"). Each system prompt includes: stay in character, no real service claim, no medical/legal/financial advice, refuse unsafe content in character.

  Done when: unit tests pass (no operator number is in EMERGENCY_NUMBERS; all ring counts are 2 or 3); hook 4 passes on save; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 3.1, 3.2, Req 2.5, Req 7.3

  Tests: `lib/operators.test.ts` (no operator on emergency number; all ring counts valid)

- [ ] 22. Implement /api/operator route (streaming SSE)

  Create `app/api/operator/route.ts`. Zod validation. Reject: unknown number (400), input > MAX_INPUT_CHARS (400), turnIndex >= MAX_TURNS_PER_CALL (send goodbye SSE). Check IP and global rate limits. For 1313: return hardcoded greeting + tool_result with spirit listings, no Claude call. For others: build Claude request using `process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5"`, stream reply, intercept tool_use blocks, run matching RPC, inject tool_result, continue stream. Inject Johannesburg time into 1026 prompt. Append goodbye instruction on final turn.

  Done when: unit tests pass (valid 1023 streams delta events; unknown number 400; input too long 400; over IP limit 429; over global cap 429; 1313 returns spirit listings without calling Claude); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 3.3, 3.4, 3.6, 3.7, 3.8, 3.9, 3.11, 3.12, Req 4.3, 4.7, 4.8, Req 10.1, 10.3, 10.4, 10.5, 10.7

  Tests: `app/api/operator/route.test.ts` (6 unit tests)

- [ ] 23. Build OperatorPanel component

  Create `components/OperatorPanel/OperatorPanel.tsx`. Props: `operatorNumber`, `onMessage`, `onHangUp`, `turnIndex`, `maxTurns`. Display: operator name, transcript scroll, input area. Input area: show SpeechRecognition button if available; always show typed text input. Feature-detect `window.SpeechRecognition` on mount. After reply streams, call `speechSynthesis.speak()` with operator voice config. Respect mute state.

  Done when: tests pass (renders operator name; text input always present; with speech unavailable, voice button absent; submit calls onMessage); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 3.3, 3.4, 3.5, 3.10, Req 9.5, 9.7

  Tests: `components/OperatorPanel/OperatorPanel.test.tsx` (4 tests)

- [ ] 24. Wire streaming fetch in browser

  In `app/page.tsx`, when state is `connected`, open a `fetch` to `/api/operator` and read SSE stream with `ReadableStream`. Handle event types: `delta` (append to transcript), `tool_result` (store results, open phone book), `done` (complete), `error` (in-character message, dispatch as needed). On 429 dispatch `RATE_LIMITED`. Abort fetch on HANG_UP.

  Done when: tests pass (delta events update transcript; tool_result opens phone book; rate_limited dispatches RATE_LIMITED; hang-up aborts stream); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 3.3, 3.4, Req 4.5, Req 10.4

  Tests: `app/page.test.tsx` or dedicated hook test (4 tests)

- [ ] 25. Build business section of phone book (yellow-style)

  Create `components/PhoneBookPage/BusinessSection.tsx`. CSS columns (2-3 desktop, 1 mobile): bold name, suburb, phone, hours, description. `is_advert` rows render as `AdvertCard` with CSS box border. Page header shows letter range and fictional page number. Aged yellow paper: `background-color: #f5e6a3`, `filter: sepia(0.3)`. Candlelight vignette via CSS radial gradient (static when prefers-reduced-motion). Body text `#1a1008` for 4.5:1 contrast. `ListingDetail` as `<dialog>` with torn-edge SVG border.

  Done when: tests pass (3 results render as 3 cards; is_advert renders advert-card class; clicking opens detail dialog); contrast verified >= 4.5:1; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7

  Tests: `components/PhoneBookPage/BusinessSection.test.tsx` (3 tests)

- [ ] 26. Build white pages (resident section)

  Create `components/PhoneBookPage/WhiteSection.tsx`. Dense multi-column layout (1 column mobile). Each row: SURNAME Initial, street address, suburb, phone in CSS grid. Plain white aged-paper background (`#faf8f5`). No adverts. All text meets WCAG AA contrast.

  Done when: tests pass (3 residents render as 3 rows; surname in uppercase; phone present); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 6.1, 6.2, 6.3, 6.5

  Tests: `components/PhoneBookPage/WhiteSection.test.tsx` (3 tests)

- [ ] 27. Build PhoneBookPage container with section tabs

  Create `components/PhoneBookPage/PhoneBookPage.tsx`. Render `SectionTabs` with "White Pages" and "Business" tabs. Tab switch with 200 ms CSS fade (instant with prefers-reduced-motion). Tabs use `role="tab"`, arrow key navigation, Enter/Space selects. When `spiritOnly` is true: no tabs, header reads "The Dead Pages: Spirit Listings".

  Done when: tests pass (both tab labels visible; clicking "Business" calls onSectionChange; spiritOnly hides tabs; keyboard navigation works); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 6.4, 6.6, Req 5.3, 5.4, Req 7.3

  Tests: `components/PhoneBookPage/PhoneBookPage.test.tsx` (4 tests)

- [ ] 28. Build StaticOverlay component

  Create `components/Static/StaticOverlay.tsx`. Full-viewport CSS animation simulating TV static (alternating opacity on a noise-pattern SVG). Triggered when `visible` prop is true. With prefers-reduced-motion: 200 ms opacity fade only.

  Done when: tests pass (renders when visible; does not render when not visible; prefers-reduced-motion suppresses animation class); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 2.6, Req 9.4

  Tests: `components/Static/StaticOverlay.test.tsx` (3 tests)

- [ ] 29. Rate limit property tests

  Extract `checkRateLimit(count: number, limit: number): "allowed" | "denied"` as a pure function in `lib/rateLimits.ts`. Write fast-check P10 (c <= L returns allowed), P11 (c > L returns denied), P12 (string with length > MAX_INPUT_CHARS rejected by Zod operator schema).

  Done when: all three property tests pass; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 10.1, 10.2, 10.3, Req 3.9

  Tests: `lib/rateLimits.test.ts` (3 property tests)

- [ ] 30. Add security headers via next.config

  In `next.config.ts`, add a `headers()` function applying CSP and other security headers to all routes: `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`, `font-src 'self' https://fonts.gstatic.com`, `connect-src 'self' https://*.supabase.co`, `img-src 'self' data:`, `media-src 'none'`, `object-src 'none'`, `frame-ancestors 'none'`, plus `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

  Done when: build passes; Playwright test asserts CSP header present on `/`; `pnpm typecheck` clean.

  Requirements: Req 10.8

  Tests: Playwright or unit test asserting CSP header on `/`

- [ ] 31. Implement /api/health and Vercel cron

  Create `app/api/health/route.ts`: runs `SELECT 1` via the server secret key client, returns `{ ok: true, ts: string }` or 503 on failure. Create `app/api/cron/keepalive/route.ts`: verifies `Authorization: Bearer {CRON_SECRET}` header, then calls the health endpoint and returns its response. Create `vercel.json` with daily cron at `"0 10 * * *"` on `/api/cron/keepalive`.

  Done when: unit tests pass (health returns ok:true on success; returns 503 on Supabase error); vercel.json present; `pnpm typecheck` clean.

  Requirements: Req 10.9

  Tests: `app/api/health/route.test.ts` (2 unit tests)

- [ ] 32. Offline and fallback handling

  In `app/page.tsx`, listen to `window.online`/`window.offline` events. When offline: full-screen in-character overlay "The exchange has gone dark. Check your connection." Disable dial. Clear when online. For Claude-down SSE error: show "The operator is unreachable. Please try again later." with hang-up button. For search 500: operator says "The directory is unavailable right now" in character. For speechSynthesis unavailable: text still displayed, voice silently skipped.

  Done when: offline overlay test passes; claude-down error message test passes; speechSynthesis-unavailable does not throw; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 9.6, 9.7, 9.8, 9.9

  Tests: `app/page.test.tsx` (3 additional tests)

- [ ] 33. Deploy to Vercel and smoke-test the live URL

  Push to GitHub. Connect repo to Vercel if needed. Set all env vars from `.env.example` in Vercel dashboard. Deploy. Run `pnpm test:e2e` against the live URL. Fix any build errors. Confirm cron shows in Vercel dashboard.

  Done when: Vercel deployment green; E2E suite passes against live URL; cron visible.

  Requirements: all requirements (first live check)

  Tests: full Playwright E2E suite against live URL

- [ ] 34. Landing scene and visual polish

  `app/page.tsx` background: dark desk scene using CSS gradients only. Load "Special Elite" (typewriter, Google Fonts OFL) and "Nixie One" (Bakelite era, Google Fonts OFL) via `next/font/google`. Style dial as Bakelite black plastic. Add candle flicker CSS animation to vignette (prefers-reduced-motion makes it static). Confirm Lighthouse mobile: Performance >= 90, Accessibility >= 90, Best Practices >= 90.

  Done when: Lighthouse scores met; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 5.3, 5.4, Req 9.3, 9.4

  Tests: manual Lighthouse run; existing automated tests still pass

- [ ] 35. Full end-to-end Playwright test suite

  Implement all 8 E2E scenarios from design section "End-to-end tests": (1) full 1023 call with phone book opening, (2) 1026 call receives time and auto-hangs, (3) wrong number plays static and returns to idle, (4) dial 112 shows emergency-notice screen with plain message and no static, (5) mock 429 triggers busy state with in-character message, (6) dial 1313 opens spirit listings, (7) keyboard dial "5" shows 5 click sounds and digit display, (8) go offline shows in-character message and disables dial.

  Done when: all 8 E2E tests pass against live Vercel URL; `pnpm test:e2e` clean.

  Requirements: Req 1, 2, 3, 4, 7, 8, 9, 10

  Tests: `tests/e2e/` (8 scenarios)

- [ ] 36. Write README.md

  What it is (2-3 sentences), screenshot placeholder, how to run locally (clone, pnpm install, copy .env.example, fill in values, pnpm dev), all env vars with descriptions, architecture Mermaid diagram, font credits (Special Elite and Nixie One from Google Fonts under OFL licence). No real brand names. No dashes. South African English.

  Done when: README present; brand name grep returns nothing; dash scan returns nothing; `pnpm build` passes.

  Requirements: (submission requirement)

  Tests: grep scan for brand names and dashes

- [ ] 37. Write KIRO_USAGE.md

  Document: how specs were used (requirements, design, tasks with concrete examples of what changed between drafts), how steering files work (all six files), how agent hooks were used (each hook with what it caught), how MCP was used (Supabase MCP if used), how property-based testing was used (all 13 properties, fast-check code snippet for P1 or P5). Concrete examples with code. Apply writing-style.md rules.

  Done when: file present; each Kiro feature has at least one concrete example; no dashes; no brand names.

  Requirements: (submission requirement)

  Tests: manual review

- [ ] 38. Write DEMO_SCRIPT.md

  2-minute 50-second video script. Opening voice-over: "In 1998, the line went dead. Tonight, someone picked up." Shot list: landing scene (5 s), pick up handset (5 s), dial 1023 (20 s), operator greeting (10 s), ask for plumber in Edenvale (15 s), phone book opens (10 s), click listing (5 s), hang up and dial 666 (20 s), Night Caretaker story (20 s), dial 1313 (20 s), spirit listings (10 s), wrong number static (10 s), closing shot and tagline (20 s). Total ~170 s. No copyrighted music, no real brand names.

  Done when: file present; total estimated duration <= 170 s; no brand names; writing-style.md rules applied.

  Requirements: (submission requirement)

  Tests: manual review; brand name grep

- [ ] 39. Write SUBMISSION.md checklist

  Checklist table: Requirement, Status, Where to find it. Rows: working public URL, Devpost description, demo video under 3 minutes on YouTube, public GitHub repo with MIT licence in About section, `.kiro/` at repo root and not gitignored, Kiro write-up (KIRO_USAGE.md), free judge access until 29 January 2027. Confirm MIT LICENSE file exists.

  Done when: file present; all rows have status and location; MIT LICENSE present.

  Requirements: (submission requirement)

  Tests: manual review

- [ ] 40. Final pre-submission checks

  Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` against live URL. All must pass. Run Lighthouse on live URL (Performance >= 90, Accessibility >= 90, Best Practices >= 90 on mobile). Run brand name grep across all .md, .ts, .tsx files. Run em/en dash scan across all .md files. Confirm `.kiro/` not in `.gitignore`. Confirm `.env*` in `.gitignore` and no real secrets committed. Confirm vercel.json cron present and visible in Vercel dashboard. Confirm Devpost submission form complete: URL, description, video link, repo link. Submit by 2 December 2026.

  Done when: all checks pass; Devpost submission submitted.

  Requirements: all

  Tests: CI run of all test suites

## Notes

- Never mark a task done with failing lint, typecheck or tests.
- Commit after each completed task with a conventional commit message (feat:, fix:, test:, chore:, docs:, refactor:).
- Property-based tests use fast-check. Each property is tagged with its ID from design section "Correctness Properties" (P1 through P13).
- The EMERGENCY_NUMBERS set in `lib/operators.ts` is the single source of truth used by both the state machine and the operator safety hook.
- Do not start any task from Phase 5 onwards before the seed data (Tasks 17 and 18) is loaded into the database, as the operator route depends on real search results.
- The `.env.example` file must be updated whenever a new env var is added, before closing the task that introduced it.
- Submission target: 2 December 2026. Judging runs until 29 January 2027.
- Tasks 6 to 8 were completed with Claude Code on 14 Nov 2026 while waiting for the Kiroween Kiro credits to arrive. The work follows this spec and the steering files. Two changes came out of it: the dial geometry was corrected to match a real desk phone (finger stop at about 4 o'clock, not near 12), and design.md was updated to match. RotaryDial owns its own rotation state, so the `rotation` prop from task 7 was dropped. A local preview page lives at /dev/dial and is not served in production.
