# Implementation Plan: Dial Tone from the Grave

## Overview

Tasks are grouped into 8 phases, plus the session features (tasks 45 to 48) that make the phone and the book work together. Phase 1 (scaffold) must be complete before all others. Phases 2 (dial), 3 (state machine and audio) and 4 (data and search) can run in parallel after Phase 1. Phase 5 (operators) depends on 3 and 4. Phase 6 (phone book) depends on 4 and 5. Phase 7 (limits, security, deploy) depends on 5 and 6. Phase 8 (polish and submission docs) depends on all prior phases.

The rotary dial is the hero feature and comes first within Phase 2.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2", "3", "4", "5"],
      "description": "Project scaffold and tooling"
    },
    {
      "wave": 2,
      "tasks": ["6", "7", "8", "9", "10", "41", "11", "12", "13", "14", "15", "16", "17", "18"],
      "description": "Rotary dial, state machine, audio, asset optimisation, data and seeds (parallelisable)"
    },
    {
      "wave": 3,
      "tasks": ["42", "19", "20", "21"],
      "description": "3D scene, search route, spooky query, operators"
    },
    {
      "wave": 4,
      "tasks": ["43", "22", "23", "24"],
      "description": "3D dial drag, operator route, operator panel, streaming"
    },
    {
      "wave": 5,
      "tasks": ["25", "26", "27", "28", "44"],
      "description": "Phone book pages (3D and HTML) and static overlay. The core loop is complete here."
    },
    {
      "wave": 6,
      "tasks": ["45", "46", "48", "29", "30", "31", "32", "33"],
      "description": "Dial a listing, incoming calls, Johannesburg check; limits, security, fallbacks and an early deploy"
    },
    {
      "wave": 7,
      "tasks": ["47"],
      "description": "The book keeps the session (needs the listing calls from 45)"
    },
    {
      "wave": 8,
      "tasks": ["34", "35", "36", "37", "38", "39", "40"],
      "description": "Polish, end-to-end suite and submission docs"
    }
  ]
}
```

## Tasks

- [x] 1. Initialise Next.js project with pnpm

  Set up the base project. Run `pnpm create next-app` with App Router, TypeScript strict, Tailwind CSS, ESLint. Set `"strict": true` in `tsconfig.json`. Add Prettier with a `.prettierrc` (single quotes, 100 char line width, trailing commas). Add `lint-staged` and `husky` pre-commit hook running `eslint --fix` and `prettier --write` on staged files.

  Done when: `pnpm build`, `pnpm lint` and `pnpm typecheck` all pass with zero errors on a clean checkout.

  Requirements: Req 10 (foundation for all security controls)

  Tests: none (tooling only)

- [x] 2. Add Vitest, React Testing Library, fast-check and Playwright

  Install `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `fast-check`. Configure `vitest.config.ts` with jsdom environment. Install `@playwright/test` and run `playwright install chromium`. Add `pnpm test`, `pnpm test:e2e` and `pnpm typecheck` scripts. Write a smoke unit test and a smoke E2E test (visit `/`, assert `<html>` exists).

  Done when: `pnpm test`, `pnpm test:e2e` and `pnpm typecheck` all pass.

  Requirements: Req 1, 2, 10 (test stack needed for all property and unit tests)

  Tests: smoke unit test; smoke E2E test

- [x] 3. Configure Supabase client and environment variables

  Install `@supabase/supabase-js`. Create `lib/supabase.ts` (browser client) and `lib/supabase-server.ts` (service-role, `server-only` import guard). Create `.env.example` with every variable from the design, with comments, no real values. Add `.env`, `.env.local`, `.env*.local` to `.gitignore`. Confirm `.kiro/` is NOT in `.gitignore`.

  Done when: both clients export without type errors; `.env.example` committed; `pnpm build` passes; `.kiro/` not in `.gitignore`.

  Requirements: Req 10.5, 10.10

  Tests: `lib/supabase.test.ts` (browser client created with correct URL using mocked env vars)

- [x] 4. Create project directory structure and testing steering file

  Create empty index files at: `components/RotaryDial/`, `components/Handset/`, `components/PhoneBookPage/`, `components/Static/`, `lib/operators.ts`, `lib/audio.ts`, `lib/spooky.ts`, `supabase/migrations/`, `supabase/seed/`. Create `.kiro/steering/testing.md` with project testing rules: Vitest + RTL for units, fast-check for property tests, Playwright for E2E; every AC maps to a test; test name format `[Req N.AC] description`; never delete a failing test without explanation.

  Done when: all directories exist; `testing.md` committed; `pnpm build` passes.

  Requirements: (structural foundation)

  Tests: none

- [x] 5. Create Kiro agent hooks

  Create five hooks in `.kiro/hooks/`. Hook 1 (`lint-on-save.json`): PostFileSave on `\.(ts|tsx)$`, runs eslint and tsc on the saved file. Hook 2 (`test-on-save.json`): PostFileSave on `(lib/|components/RotaryDial)`, runs vitest filtered to the saved file. Hook 3 (`rls-check.json`): PostFileSave on `supabase/migrations/`, checks every `create table` has matching `enable row level security`, exits 2 if not. Hook 4 (`operator-safety.json`): PostFileSave on `lib/operators\.ts$`, checks operator numbers against EMERGENCY_NUMBERS, exits 2 if any match. Hook 5 (`update-writeup.json`): UserPromptSubmit (manual), agent action refreshing KIRO_USAGE.md.

  Done when: all five `.kiro/hooks/*.json` files exist and are valid JSON matching the hook schema.

  Requirements: (Kiro feature requirement for submission)

  Tests: manual verification that hooks fire in the IDE

- [x] 6. Implement dial geometry and angle/pulse maths (property tests first)

  Create `lib/dial.ts` exporting `HOLE_ANGLES`, `STOP_ANGLE` (345), `PULSES`, `returnDuration(digit)`, `shouldRegister(digit, angle)`, `digitFromHoleIndex(index)`. Write property-based tests in `lib/dial.test.ts` BEFORE implementing: P1 (`returnDuration(d) === PULSES[d] * 100`), P2 (pulse count equals face value or 10 for "0"), P3 (all HOLE_ANGLES unique in [0, 360)), P4 (shouldRegister true within 3 degrees of stop, false outside). Implement until all pass.

  Done when: `pnpm test` passes with all four property tests green; `pnpm typecheck` clean.

  Requirements: Req 1.1, 1.2, 1.3, 1.4

  Tests: `lib/dial.test.ts` (4 fast-check property tests)

- [x] 7. Build the RotaryDial SVG component and 2D drag (accessible fallback)

  `components/RotaryDial/RotaryDial.tsx`: pure SVG, 10 finger holes at HOLE_ANGLES, aria-label, aria-live region, mouse and touch drag via pointer events using `shouldRegister` from lib/dial.ts. This is the accessible fallback used when WebGL is unavailable or prefers-reduced-motion is active. It is always in the DOM (for keyboard focus) but visually hidden behind the canvas when 3D is active.

  Done: render tests pass, drag tests pass, aria-label present.

  Requirements: Req 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, Req 9.1

  Tests: `components/RotaryDial/RotaryDial.test.tsx`

- [x] 8. Add mouse and touch drag interaction to RotaryDial

  Added pointer event handlers to each finger hole in `components/RotaryDial/RotaryDial.tsx`. Tracks drag angle clockwise only using `accumulateRotation`. On pointerup: calls `shouldRegister` from `lib/dial.ts`. If true, calls `onDigit` and starts return animation at 10 pulses per second. If false, springs back without registering. Fires one click sound stub per pulse. Uses `touch-action: none` on draggable elements.

  Done: drag-to-stop calls `onDigit` with correct digit; early release does not; tests pass.

  Requirements: Req 1.1, 1.2, 1.3, 1.5

  Tests: `components/RotaryDial/RotaryDial.test.tsx` (full drag calls onDigit; early release does not)

- [x] 41. Optimise 3D assets

  Add `@gltf-transform/cli` as a dev dependency. Write a `pnpm optimize-assets` script in `package.json` that runs `gltf-transform optimize` on `assets-src/phone/we500.glb` to `public/models/we500.glb` (meshopt compression, textures resized to 2K webp, target under 5 MB) and converts `assets-src/textures/dark_wooden_planks_diff_2k.jpg` to `public/textures/dark_wooden_planks_diff_2k.webp` using `cwebp -q 85`. Run the script and commit both outputs. Add `assets-src/phone/*.glb` and `assets-src/textures/*.jpg` to `.gitignore` so the unoptimised sources are not committed to `public/`. Verify `ls -lh public/models/we500.glb` is under 5 MB; if not, re-run with `--texture-size 1024` on non-hero materials.

  Done when: `pnpm optimize-assets` runs clean; `public/models/we500.glb` exists and is under 5 MB; `public/textures/dark_wooden_planks_diff_2k.webp` exists; `pnpm typecheck` clean.

  Requirements: Performance budget (design section "Asset Pipeline")

  Tests: file size check (`ls -lh public/models/we500.glb`); `pnpm build` still passes

- [x] 42. Build the R3F 3D scene (desk, candle, phone model, dial details, loading veil)

  Install `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`. Create `components/PhoneCanvas/PhoneCanvas.tsx` as a client component loaded with `dynamic(() => import('./PhoneCanvas'), { ssr: false, loading: () => <LoadingVeil /> })`.

  Inside the R3F `Canvas`: `DeskScene` with desk plane (Poly Haven webp texture, procedural dust GLSL shader via `onBeforeCompile`), `CandleGroup` (wax cylinder, five wax drips, brass holder, flame sprite, halo sprite, wick), all four lights (candle PointLight with per-frame flicker perturbing intensity and position via noise, key SpotLight, rim PointLight, sick-green DirectionalLight), contact shadow blob, `FogExp2(0x050302, 1.4)`, PMREM environment at intensity 0.08.

  Load `we500.glb` with `useGLTF('/models/we500.glb')`. After load: apply a fine, faint dust film to the upward-facing `Western_Electric_500_Material` surfaces (`onBeforeCompile`, `DUST_AMOUNT` 0.12, high-frequency grain only so it never forms patches). Add procedural spider group near the cord (abdomen, thorax, eight `TubeGeometry` legs on `CatmullRomCurve3` paths, fine hair tubes on each leg, `MeshPhysicalMaterial` with sheen, subtle idle animation).

  **Dial details (port from assets-src/scene-test.html):**

  Compute the dial centre and normal from the `Rotary_Dial_Finger_Wheel` vertex positions: collect every third vertex, transform by `matrixWorld`, compute centroid, build 3x3 covariance matrix, run Jacobi eigenvalue iteration to find the smallest eigenvector (the normal). If `normal.y < 0`, negate. Derive in-plane axes: `uAx` = projection of world back vector onto the dial plane (normalised); `rAx` = cross(uAx, normal). Export `dialCentre`, `dialNormal`, `uAx`, `rAx` from a `useDialGeometry` hook so task 43 can use them. This is the axis to rotate around, NOT `rotation.z`.

  Raycast to find the 10 holes: scan orbital rings at radii from 55% to 92% of max vertex radius in 2% steps, cast rays inward along the normal at 2-degree intervals, record misses. The ring with the most misses in [1, 160] is the hole orbit. Group consecutive missed angles into 10 holes, merge wrap-around runs. Record `holeAngles[]` and `holeR`. Write a test that the 10 detected hole angles match `HOLE_ANGLES` from `lib/dial.ts` within 5 degrees once mapped to dial space (sort both arrays and compare pairwise).

  Build the goo: wet green slime, a `MeshPhysicalMaterial` painted per vertex by thickness (see design, Slime in the finger holes; values in `GOO` and `GOO_SHAPE` in `sceneConstants.ts`). Per hole: a pool built by `buildPool`, centred on the hole opening measured from the wheel (`holeOpenings`), filling 97 percent of its radius, recessed below the rim with a wet meniscus. Three holes are full (0.3 to 0.8 mm below the rim), two are a film, the rest part full. Under the ring of holes, 5 to 7 flat leak stains (`buildStain`) lie on the fixed number plate, some running a short way downhill (world down projected onto the dial plane with `dialNormal`, never hard-coded). The rule: pools are children of the finger wheel and turn with it; stains are children of the static phone body and never move. No drips, no rim smears. Tests: pools turn 90 degrees about `dialNormal` and stains are unchanged when the wheel turns; no pool top comes within 0.3 mm of the rim at any angle; every pool stays inside its hole; stains lie flat on the plate, clear of the card and the wheel edge.

  Centre card (`Rotary_Dial_Card` node): clone its material, replace `map` with a `CanvasTexture` painted over the original base texture. UV-box: scan the geometry's uv attribute for min/max. Paint: aged paper radial gradient, foxing spots, then in the UV region draw "DIRECTORY" in small monospace above, "1023" in large italic script below. Apply `g.scale(1, -1)` before drawing text to correct the UV flip. Set `t.flipY = base.flipY` and `t.colorSpace = base.colorSpace`.

  Post processing: `Bloom` (threshold 0.9, strength 0.3, radius 0.4), `Vignette` (darkness 0.65, offset 0.35), `Noise` (opacity 0.07) via `@react-three/postprocessing`.

  `LoadingVeil`: full-screen CSS div with candlelit radial gradient and tagline in serif italic. Fades out when canvas `onCreated` fires.

  Done when: dev server renders desk, candle, phone, goo and card at 60 fps; loading veil appears then fades; hole-angle test passes; `pnpm typecheck` clean.

  Requirements: Req 2 (scene is the visual context for all call states)

  Tests: `components/PhoneCanvas/PhoneCanvas.test.tsx` (renders without throwing when WebGL is mocked; LoadingVeil shown before canvas ready); `components/PhoneCanvas/dialGeometry.test.ts` (10 detected hole angles match HOLE_ANGLES within 5 degrees); `tests/e2e/dial-render.spec.ts` (render check of the dial close-up: green shapes visible, none stringy, none on the card)

  Horror pass (built, look unfinished, parked): murky crusting goo, spills over the rims, finger streaks, globs, a strand, grime and bubbles on the wheel; stop goo, specks and a draped run to a desk puddle on the body; painted wheel film and plate trails while dragging. See design, The horror pass. Tests: `gooShapes`, `gooColour`, `gooDecals`, `gooPainter`, `preparePhone`, `wheelPivot`, `DialWheel`, `app/dev/phone/replay.test.ts`.

- [x] 43. Add 3D drag interaction to the DialWheel

  Extracted the 2D dial's drag, return and spring-back logic into one shared `useDialController` hook, used by both `RotaryDial` and the new `DialWheel` (`components/PhoneCanvas/DialWheel.tsx`, which takes the controller as a prop). Pointer events on the canvas are cast at the phone: the first hit must be part of the dial, the ray is intersected with the dial plane, and the hole is found with `holeAtPoint`. The wheel is turned about `dialNormal` through `dialCentre` by `createWheelPivot`, not `rotation.z`. The return runs at constant speed from the stop, one pulse interval per pulse, and fires `onPulse` once per pulse as the click sound hook. `touch-action: none` is on the canvas wrapper. `PhoneScene` and a small `DialledDisplay` wire it into the page.

  Done when: dragging a hole to the stop in 3D calls `onDigit` with the correct digit; early release does not; the wheel turns about the dial axis; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 1.1, 1.2, 1.3, 1.5, Req 1.7

  Tests: `components/PhoneCanvas/DialWheel.test.tsx` (real controller, DOM events, camera rays and raycasting; mouse and touch; every digit; early release; card, right button, handset in the way, disabled; wheel turns; runs back; listener cleanup), `dialSpace.test.ts`, `dialMotion.test.ts`, `wheelPivot.test.ts` (real model), `DialledDisplay.test.tsx`

- [x] 9. Add keyboard interaction to RotaryDial

  On `keydown` for keys 0-9 (when not disabled): animate the correct hole clockwise to the finger stop over 150 ms (CSS transition), then start the normal return sequence. With `prefers-reduced-motion`: skip both animations, call `onDigit` immediately, still schedule click sounds.

  Done when: keyboard test passes (`onDigit("5")` called on key "5"); reduced-motion test passes (`onDigit` called without animation delay); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 1.5, 1.8, Req 9.2, 9.4

  Tests: `components/RotaryDial/RotaryDial.test.tsx` (keyboard digit; reduced motion; ignored keys, shortcuts, typing, disabled, unmount); `components/PhoneCanvas/dialMotion.test.ts` (150 ms swing)

- [x] 10. ARIA live region announcement per digit

  After `onDigit` fires, update the `aria-live="polite"` region to "Dialled: {digit}". Clear after 1 second.

  Done when: test asserts live region text equals "Dialled: 5" after firing digit "5"; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 1.7, Req 9.1

  Tests: `components/RotaryDial/RotaryDial.test.tsx` (live region updated after digit)

- [x] 11. Implement the call state machine (useReducer, test-first)

  Create `lib/callMachine.ts` exporting `CallState`, `CallEvent`, `callReducer`, and `EMERGENCY_NUMBERS` set (imported from `lib/operators.ts`). Write unit tests for every transition before implementing: idle+PICK_UP, off-hook+DIGIT_DIALLED, dialling+CALL_PLACED (match and no-match), dialling+EMERGENCY_NUMBER (must route to emergency-notice not wrong-number), ringing+RING_TICK (last ring connects), connected+HANG_UP, connected+TURN_CAP_REACHED, connected+RATE_LIMITED, busy+SEQUENCE_COMPLETE, wrong-number+SEQUENCE_COMPLETE, emergency-notice+DISMISSED, connected+DIGIT_DIALLED (stays connected). Write fast-check P5 (reducer never returns undefined) and P6 (every emergency number routes to emergency-notice).

  Done when: 13 transition tests + 2 property tests pass; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10

  Tests: `lib/callMachine.test.ts` (18 unit + 2 property tests)

- [x] 12. Implement the AudioEngine

  Create `lib/audio.ts` exporting `AudioEngine` class with methods for each sound (dial tone 400 Hz, ring tone 400+450 Hz SA cadence, busy tone, disconnected pips, dial click via bandpass noise, static/crackle via AM-modulated noise). `AudioContext` created lazily. Read mute state from `sessionStorage` key `dtftg_muted` on init. `setMuted(true)` sets master gain to 0 and saves the choice to `sessionStorage`; the engine owns that key, so the toggle only calls `setMuted` and `isMuted`. Guard all methods for suspended context.

  Done when: unit tests pass with mocked AudioContext (dialTone creates 400 Hz oscillator; click creates buffer source; setMuted(true) sets gain to 0); starts muted; `pnpm typecheck` clean.

  Requirements: Req 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8

  Tests: `lib/audio.test.ts` (18 tests with a fake AudioContext: every tone and cadence, click and static graphs, mute and storage, first-interaction wake, no Web Audio, reduced motion ignored)

- [x] 13. Build Handset component and wire state machine to audio

  Create `components/Handset/Handset.tsx` (pick-up / hang-up buttons). In `components/PhoneScene/useCall.ts` (used by `PhoneScene`, which `app/page.tsx` renders), instantiate `useReducer(callReducer)` and wire all events. Connect AudioEngine to state transitions. Implement the 2-second dial timer (`CALL_PLACED` after last digit). Implement the ring sequence (one `RING_TICK` per ring, connecting after the operator's ring count). Render the `emergency-notice` state as a plain white overlay (no spooky styling) with the safety message: "This is a game and cannot call anyone. If you have an emergency, please use a real phone and dial 112 or 10111." and a dismiss button.

  Done when: pick-up test passes; hang-up-from-connected transitions to idle; emergency-notice overlay renders correct message text; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.10, Req 8.3, 8.4, 8.5, 8.6

  Tests: `components/Handset/Handset.test.tsx` (pick-up; hang-up from every state); `components/EmergencyNotice/EmergencyNotice.test.tsx` (message, plain styling, dismiss by button and Escape, focus); `components/CallStatus/CallStatus.test.tsx` (busy and wrong-number text, live region); `components/PhoneScene/useCall.test.tsx` (18 tests: dial tone, 2 s pause from rest, rings, wrong-number sequence, emergency, hang-up from any state, busy, locked dial when connected, audio wake and clean-up); `tests/e2e/call-flow.spec.ts` (112 notice, wrong number, hang-up)

- [x] 14. Implement MuteToggle component

  Create `components/MuteToggle/MuteToggle.tsx`: button labelled "Mute"/"Unmute". On mount, read `dtftg_muted` from `sessionStorage` (default: `true`, muted). On toggle, call `AudioEngine.setMuted()`, which saves the choice to sessionStorage.

  Done when: test passes (starts as "Unmute"; clicking calls setMuted(false) and label changes to "Mute"); `pnpm typecheck` clean.

  Requirements: Req 8.7, Req 9.4

  Tests: `components/MuteToggle/MuteToggle.test.tsx` (initial state muted; toggle changes state; remembered choice; keyboard); `tests/e2e/call-flow.spec.ts` (unmute survives a reload)

- [x] 15. Supabase migrations: extensions, tables, RLS, RPCs

  Write migration files: `0001_extensions.sql` (enable pgvector, pg_trgm), `0002_businesses.sql` (table, indexes, RLS, public read policy, `phone_digits` generated column with a unique index), `0003_residents.sql` (the same for residents), `0004_rate_limits.sql` (table, RLS no public access, `increment_rate_limit` function), `0005_rpcs.sql` (`search_businesses`, `search_residents` and `lookup_number` per design). Apply with `pnpm db:push:dry` (show the list), then `pnpm db:push`. Verify with `pnpm db:verify` (read-only), then generate `lib/database.types.ts` with `pnpm db:types`.

  Done when: `pnpm db:push` succeeds; all five migration files committed; `pnpm db:verify` shows RLS on every table, no public read, and every function runnable by `service_role` only; `lib/database.types.ts` generated.

  Requirements: Req 4.1, 4.2, Req 6.3, Req 10.6, Req 11.1, 11.4

  Tests: `supabase/migrations.test.ts` (21 tests in PGlite with Supabase roles); RLS check hook on each migration save; `pnpm db:verify` against the live database.

- [x] 16. Create the embed Edge Function

  Write `supabase/functions/embed/handler.ts` (pure, testable: POST `{ text }`, at most 2000 characters, returns `{ embedding }` of 384 numbers, errors without internal detail) and `index.ts` (wires it to `withSupabase({ auth: 'secret' })` and `Supabase.ai.Session('gte-small')` with `mean_pool` and `normalize`). Set `verify_jwt = false` for `embed` in `supabase/config.toml`. Deploy with `pnpm fn:deploy embed` (Supabase bundles it, no Docker; `SUPABASE_ACCESS_TOKEN` from `.env.local`). Smoke test with `pnpm fn:smoke`.

  Done when: function deployed; smoke test passes (secret key gets 384 normalised numbers; no key and the publishable key are refused; blank text is refused; a geyser query is nearer a plumber than a pharmacy); `pnpm typecheck` clean.

  Requirements: Req 4.1, 4.2 (embedding underpins both search tools)

  Tests: `supabase/embed.test.ts` (7 handler tests); `scripts/embed-smoke.mjs` against the deployed function

- [x] 17. Seed business listings (150 businesses + 12 spirit listings)

  Write `supabase/seed/businesses.ts`: array of ~150 fictional businesses across Johannesburg (design, Johannesburg flavour): the east, north, west and Soweto, at least 12 suburbs, and at least the trades Req 14.2 lists, with prices in rand where they appear. Include ~12 spirit listings (`is_spirit: true`) and some boxed adverts (`is_advert: true`). Every phone is a unique `011 000 xxxx` number. Write `supabase/seed/run.ts` (`seedAll`: embed every listing through the embed function, then upsert in batches of 25, matched on `phone_digits` so a re-run updates instead of duplicating) and `supabase/seed/cli.ts`, run with `pnpm db:seed`. Check live search with `pnpm db:search-smoke`.

  Done when: seed runs without error; `SELECT COUNT(*) FROM businesses` >= 150; at least 12 rows with `is_spirit = true`; brand name grep on seed file returns nothing.

  Requirements: Req 4.1, Req 7.1, Req 5.1, 5.2, Req 11.1, Req 14.1, 14.2

  Tests: `supabase/seed/seed.test.ts` (brand-name scan, counts, fields, [P14]); `supabase/seed/joburg.test.ts`; `supabase/seed/run.test.ts`; `lib/brandNames.test.ts`; live row counts with `pnpm db:verify` style checks; `pnpm db:search-smoke` (unique numbers, `011 000 xxxx`, no clash with operator or emergency numbers, across businesses and residents)

- [x] 18. Seed resident listings (80 residents)

  Write `supabase/seed/residents.ts`: array of ~80 invented residents with South African surname mix (van der Merwe, Botha, Nkosi, Dlamini, Patel, Singh, Coetzee, etc.) across the same Johannesburg suburbs, each with a unique `011 000 xxxx` number not used by any business. Include surname variants to exercise fuzzy match. All phones fictional. Run seed with embedding.

  Done when: seed runs; `SELECT COUNT(*) FROM residents` >= 80; `pnpm typecheck` clean.

  Requirements: Req 6.3, Req 4.2, Req 11.1, Req 14.1

  Tests: row count verification

- [x] 19. Implement /api/search route

  Create `app/api/search/route.ts`. Zod validation: `{ type, query (max 300), spooky?, spiritOnly? }`. Hash IP, check/increment `search_count` via `increment_rate_limit`. Return 429 with in-character JSON if limit exceeded. Call embed Edge Function. Call `search_businesses` or `search_residents` RPC. Return typed JSON.

  Done when: unit tests pass (valid business query returns results; valid resident query returns results; Zod rejects missing type; over-limit returns 429 with in-character message; spiritOnly calls RPC with spirit_only flag); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 4.1, 4.2, 4.4, Req 7.2, Req 10.2, 10.4, 10.7

  Tests: `app/api/search/route.test.ts` (5 unit tests)

- [x] 20. Implement lib/spooky.ts and test isSpookyQuery

  Create `lib/spooky.ts` exporting `SPOOKY_KEYWORDS: string[]` and `isSpookyQuery(query: string): boolean`. Write fast-check P7 (true iff query contains a keyword substring, case-insensitive). Write unit tests: spooky query returns true; non-spooky returns false; case-insensitive match.

  Done when: P7 property test and unit tests pass; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 7.2, Req 4.11

  Tests: `lib/spooky.test.ts` (1 property test + 3 unit tests)

- [x] 21. Define all operators in lib/operators.ts

  Define `OperatorDefinition` type. Export `OPERATORS: Record<string, OperatorDefinition>` for 1023, 1026, 666, 1313 with full system prompts per design. Export `EMERGENCY_NUMBERS: Set<string>` ("10111", "10177", "107", "112", "911", "999"). Each system prompt includes: stay in character, no real service claim, no medical/legal/financial advice, refuse unsafe content in character, South African English, and an invented backstory tied to Johannesburg and its old exchange (design, Johannesburg flavour).

  Done when: unit tests pass (no operator number is in EMERGENCY_NUMBERS; all ring counts are 2 or 3); hook 4 passes on save; `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 3.1, 3.2, Req 2.5, Req 7.3, Req 14.3, 14.4

  Tests: `lib/operators.test.ts` (no operator on emergency number; all ring counts valid)

- [x] 22. Implement /api/operator route (streaming SSE)

  Create `app/api/operator/route.ts`. Zod validation. Reject: unknown number (400), input > MAX_INPUT_CHARS (400), turnIndex >= MAX_TURNS_PER_CALL (send goodbye SSE). Check IP and global rate limits. For 1313: return hardcoded greeting + tool_result with spirit listings, no Claude call. For others: build Claude request using `process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5"`, stream reply, intercept tool_use blocks, run matching RPC, inject tool_result, continue stream. Inject Johannesburg time into 1026 prompt. Append goodbye instruction on final turn.

  Done when: unit tests pass (valid 1023 streams delta events; unknown number 400; input too long 400; over IP limit 429; over global cap 429; 1313 returns spirit listings without calling Claude); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 3.3, 3.4, 3.6, 3.7, 3.8, 3.9, 3.11, 3.12, Req 4.3, 4.7, 4.8, Req 10.1, 10.3, 10.4, 10.5, 10.7

  Tests: `app/api/operator/route.test.ts` (6 unit tests)

- [x] 23. Build OperatorPanel component

  Create `components/OperatorPanel/OperatorPanel.tsx`. Props: `operatorNumber`, `onMessage`, `onHangUp`, `turnIndex`, `maxTurns`. Display: operator name, transcript scroll, input area. Input area: show SpeechRecognition button if available; always show typed text input. Feature-detect `window.SpeechRecognition` on mount. After reply streams, call `speechSynthesis.speak()` with the voice from `pickVoice`: an `en-ZA` voice when the browser has one, otherwise the operator's voice hint. Respect mute state.

  Done when: tests pass (renders operator name; text input always present; with speech unavailable, voice button absent; submit calls onMessage); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 3.3, 3.4, 3.5, 3.10, Req 9.5, 9.7, Req 14.3

  Tests: `components/OperatorPanel/OperatorPanel.test.tsx` (4 tests)

- [x] 24. Wire streaming fetch in browser

  In `app/page.tsx`, when state is `connected`, open a `fetch` to `/api/operator` and read SSE stream with `ReadableStream`. Handle event types: `delta` (append to transcript), `tool_result` (store results, open phone book), `done` (complete), `error` (in-character message, dispatch as needed). On 429 dispatch `RATE_LIMITED`. Abort fetch on HANG_UP.

  Done when: tests pass (delta events update transcript; tool_result opens phone book; rate_limited dispatches RATE_LIMITED; hang-up aborts stream); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 3.3, 3.4, Req 4.5, Req 10.4

  Tests: `app/page.test.tsx` or dedicated hook test (4 tests)

- [x] 25. Build accessible HTML business section (HtmlOverlay layer of PhoneBook3D)

  Create `components/PhoneBookPage/BusinessSection.tsx`. Each listing prints its short dial number in exchange style with `formatDialNumber` ("HO 6-1001") next to its 011 number (Req 11.7). This is the visually-hidden accessible counterpart to PhoneBook3D's business page. It renders in the `HtmlOverlay` div, invisible to sighted users (positioned off-screen or under the canvas via CSS, not `display:none`), but readable by screen readers and keyboard users. Renders the same data as the 3D page: bold name, suburb, phone, hours, description in a logical DOM order. `is_advert` rows get an `AdvertCard` with an accessible label. `ListingDetail` as a `<dialog>` that opens on Enter/Space or click on a row, containing full listing details. All text meets WCAG AA contrast (minimum 4.5:1) for users on devices without WebGL.

  Done when: tests pass (3 results render as 3 accessible listing rows; is_advert renders with accessible label; Enter on a row opens the detail dialog; focus is managed correctly); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 5.1, 5.2, 5.5, 5.6, Req 9.3

  Tests: `components/PhoneBookPage/BusinessSection.test.tsx` (3 results rendered; is_advert accessible label; dialog opens on activation)

- [-] 26. Build accessible HTML white pages section (HtmlOverlay layer of PhoneBook3D)

  Create `components/PhoneBookPage/WhiteSection.tsx`. Each row prints the short dial number in exchange style next to the 011 number (Req 11.7). Accessible counterpart to PhoneBook3D's white-pages page. Visually hidden behind the canvas for sighted users, readable by screen readers and keyboard users. Each row: SURNAME Initial, street address, suburb, phone in a logical `<dl>` or grid. No adverts. All text meets WCAG AA contrast for non-WebGL users.

  Done when: tests pass (3 residents render as 3 rows; surname in uppercase; phone present in each row); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 6.1, 6.2, 6.3, 6.5, Req 9.3

  Tests: `components/PhoneBookPage/WhiteSection.test.tsx` (3 residents rendered; surname uppercase; phone present)

- [ ] 27. Build PhoneBookPage container with section tabs (HtmlOverlay)

  Create `components/PhoneBookPage/PhoneBookPage.tsx`. Container for the accessible HTML book layer in the `HtmlOverlay`. Renders `SectionTabs` with "White Pages" and "Business" tabs. Tab switch fires `onSectionChange`, which updates `activeSection` on both `PhoneBook3D` (3D page mode) and the accessible HTML sections. Tabs use `role="tab"`, `role="tabpanel"`, arrow key navigation, Enter/Space selects. With `prefers-reduced-motion`: section transitions are instant. When `spiritOnly` is true: no tabs, header reads "The Dead Pages: Spirit Listings".

  Done when: tests pass (both tab labels visible; clicking "Business" calls onSectionChange; spiritOnly hides tabs; keyboard arrow navigation moves focus between tabs; Enter selects); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 6.4, 6.6, Req 5.4, Req 7.3, Req 9.3

  Tests: `components/PhoneBookPage/PhoneBookPage.test.tsx` (tab labels visible; tab click calls onSectionChange; spiritOnly hides tabs; keyboard navigation)

- [ ] 44. Build PhoneBook3D (3D open book, ported from book-test.html)

  Create `components/PhoneCanvas/PhoneBook3D.tsx`. An open book positioned to the right of the phone on the desk. Visible only when `results` prop is non-empty.

  **Book geometry:** Two page meshes using `PlaneGeometry(BOOK_W, BOOK_H, 60, 40)`. Displace vertices procedurally: sag into the gutter (exponential curve from spine to outer edge, amplitude 0.012), gentle wave along the page length (amplitude 0.0006), outer-corner curl-up on the right page when `uv.y < 0.12` and `u > 0.9`. A thick block between the pages (box, striped edge texture painted on a canvas). A worn cloth cover on each side. All geometry uses `computeVertexNormals` after displacement. The book receives and casts shadows.

  **Page textures (canvas-painted, matching book-test.html exactly):** Base: yellowed newsprint `#d9c9a0` with per-pixel darkening towards edges and gutter, fine noise, foxing brown spots (160 radial gradients), water tide line on right page. Print layer: running head in bold condensed font (letter range left, page number right), three-column listings drawn from `businesses` or `residents` prop data (bold surname/name, address, the exchange-style dial number and the 011 number in monospace, leader dots, ink variation), red hand-drawn pen crossing-out on 5% of entries or on specific names. Left page bottom: the Ashgrove undertaker advert box (double border, bold display name, italic subtitle, phone in monospace). Right page margin: handwritten note "don't answer if it / rings at 3am" in dark blue italic at a slight rotation. Gutter: a centipede silhouette path crawling out from between the pages. Apply the print layer twice: first blurred (ink bleed into paper fibres), then sharp, then faded/rubbed patches, then broken-letter specks, then fingerprint smears near the outer corners. The texture pipeline uses a seeded PRNG so every run produces the same page.

  **Two page modes:** When `activeSection === 'business'`, the left page shows the letter range and business columns; the right shows the continuation and the Ashgrove advert. When `activeSection === 'white'`, the layout switches to the denser white-pages style (SURNAME Initial, address, phone in three tight columns, plain background, no advert box).

  Done when: book appears when results are present; page textures match the reference renders in `assets-src/renders/book-render-test-*.png`; `pnpm typecheck` clean; shadow and 60 fps maintained.

  Requirements: Req 5.1, 5.2, 5.3, Req 6.1, 6.2, Req 7.3

  Tests: `components/PhoneCanvas/PhoneBook3D.test.tsx` (renders without throwing when WebGL mocked; does not render when results array is empty; switches layout on activeSection prop change)

- [ ] 28. Build StaticOverlay component

  Create `components/Static/StaticOverlay.tsx`. Full-viewport CSS animation simulating TV static (alternating opacity on a noise-pattern SVG). Triggered when `visible` prop is true. With prefers-reduced-motion: 200 ms opacity fade only.

  Done when: tests pass (renders when visible; does not render when not visible; prefers-reduced-motion suppresses animation class); `pnpm test` clean; `pnpm typecheck` clean.

  Requirements: Req 2.6, Req 9.4

  Tests: `components/Static/StaticOverlay.test.tsx` (3 tests)

- [ ] 45. Dial a number from the book

  Create `app/api/number/route.ts` (Zod `{ digits }`, search rate limit, `lookup_number` RPC, returns `{ kind }` only). In `useCall`, after the 2-second pause, look up numbers that are not operators or emergency numbers, staying in `dialling` while waiting: `listing` sends `NUMBER_MATCHED` with `callee: 'listing'` and 2 rings, anything else `NO_MATCH`. Extend `callReducer` with `callee` on `ringing` and `connected`. In `/api/operator`, accept listing numbers: look the row up server-side, build the prompt from `lib/listingGhost.ts`, apply `MAX_TURNS_PER_LISTING_CALL`. Add a Dial button to `ListingCard` and `ResidentRow` that picks up and presses each digit of the listing's short `dial_number` on the shared dial controller, waiting for rest between digits. Add the new env var to `.env.example`.

  Done when: route tests pass (listing number returns `listing` with no details; unknown returns `none`; bad body 400; over limit 429); `useCall` tests pass (listing rings twice and connects; unknown ten digits is a wrong number; lookup failure is a wrong number); operator route tests pass (listing prompt built from the row; browser-sent persona text ignored; listing turn cap); Dial button test passes (dials every digit in order, by keyboard); `pnpm test` and `pnpm typecheck` clean.

  Requirements: Req 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, Req 2.5, Req 15.1

  Tests: `app/api/number/route.test.ts`, `components/PhoneScene/useCall.test.tsx`, `app/api/operator/route.test.ts`, `lib/listingGhost.test.ts`, `components/PhoneBookPage/DialButton.test.tsx`

- [ ] 46. The phone rings by itself

  Extend `callReducer` with `ringing-in` and `incoming-message`, and `INCOMING_RING`, `RING_TIMEOUT` and `MESSAGE_DONE` (design, State shape). Write `lib/incoming.ts` (about 12 invented lines). Write `useIncomingCall`: starts after the first interaction, only while idle, random wait between the min and max, session cap in `sessionStorage`, off when `NEXT_PUBLIC_RING_IN_ENABLED` is `false`. Ring tone while `ringing-in`, a 20-second timeout, the message spoken and shown on pick-up, then auto hang-up. `CallStatus` shows "The phone is ringing". The handset shakes except with reduced motion. Add the env vars to `.env.example`.

  Done when: reducer tests pass, plus [P16]; hook tests pass with fake timers (never rings before an interaction, while dialling, or on a call; respects the session cap and the off switch; times out after 20 s); the message list test passes (one or two sentences each, brand-name scan clean); `pnpm test` and `pnpm typecheck` clean.

  Requirements: Req 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, Req 2.1

  Tests: `lib/callMachine.test.ts`, `components/PhoneScene/useIncomingCall.test.tsx`, `lib/incoming.test.ts`

- [ ] 47. The book keeps your session

  Write `lib/bookSession.ts` (pure reducer: `addPage`, `markCalled`, `BOOK_MAX_PAGES` cap, oldest dropped) and a `useBookSession` hook that saves to `sessionStorage` key `dtftg_book`. Add pages from search results; mark listings called from task 45's Dial path and from dialled listing numbers. In `PhoneBook3D`, flip between pages, draw a pencil ring round called listings on the page canvas and fold the corner of dog-eared pages. Add `PageStack` to the HTML mirror with Previous and Next buttons, arrow keys, and "called" labels.

  Done when: [P15] passes; hook test passes (survives a reload in the same tab, nothing sent to the server); `PageStack` tests pass (keyboard flipping, called label); PhoneBook3D test passes (ring drawn for called ids, folded corner for dog-eared pages); `pnpm test` and `pnpm typecheck` clean.

  Requirements: Req 13.1, 13.2, 13.3, 13.4, 13.5

  Tests: `lib/bookSession.test.ts`, `components/PhoneBookPage/PageStack.test.tsx`, `components/PhoneCanvas/PhoneBook3D.test.tsx`

- [ ] 48. Johannesburg flavour check

  Add `supabase/seed/joburg.test.ts`: the seeds cover at least 12 suburbs across the east, north, west and Soweto, include every trade in Req 14.2, show prices only in rand, and pass the brand-name scan. Add `lib/voice.ts` `pickVoice` (prefer `en-ZA`, then the voice hint, then the default) with tests. Review the operator and listing-ghost backstories against Req 14.4.

  Done when: the seed check, `pickVoice` tests and the backstory review pass; `pnpm test` and `pnpm typecheck` clean.

  Requirements: Req 14.1, 14.2, 14.3, 14.4, 14.5

  Tests: `supabase/seed/joburg.test.ts`, `lib/voice.test.ts`

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

  Implement all 8 E2E scenarios from design section "End-to-end tests": (1) full 1023 call with phone book opening, (2) 1026 call receives time and auto-hangs, (3) wrong number plays static and returns to idle, (4) dial 112 shows emergency-notice screen with plain message and no static, (5) mock 429 triggers busy state with in-character message, (6) dial 1313 opens spirit listings, (7) keyboard dial "5" shows 5 click sounds and digit display, (8) go offline shows in-character message and disables dial, (9) the Dial button on a listing dials its number and the listing's ghost answers, (10) with `NEXT_PUBLIC_RING_IN_MIN_S` set low the phone rings by itself and the message plays. All other scenarios run with `NEXT_PUBLIC_RING_IN_ENABLED=false`.

  Done when: all 10 E2E tests pass against live Vercel URL; `pnpm test:e2e` clean.

  Requirements: Req 1, 2, 3, 4, 7, 8, 9, 10, 11, 12

  Tests: `tests/e2e/` (10 scenarios)

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

  Checklist table: Requirement, Status, Where to find it. Rows: working public URL, Devpost description, demo video under 3 minutes on YouTube, public GitHub repo with MIT licence in About section, `.kiro/` at repo root and not gitignored, Kiro write-up (KIRO_USAGE.md), free judge access until 29 January 2027. Bonus prizes, done near the end: a public blog post about Kiro and the project for the Bonus Blog Prize, a social post starting with `#KiroweenHackathon26` for the Social Blitz Prize, and both URLs added to the submission. Confirm MIT LICENSE file exists.

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
- The 3D canvas (PhoneCanvas) is loaded with `dynamic(..., { ssr: false })`. Never import it at the top level of a server component.
- `lib/dial.ts` and its four property tests are unchanged by the 3D direction. The same maths drive both the R3F DialWheel and the 2D SVG fallback.
- Run `pnpm optimize-assets` before the first deployment and whenever the source GLB or texture is updated. Never commit unoptimised assets to `public/`.
- The phone model (we500.glb) is CC Attribution. The desk texture is CC0. Both must be credited in README and in the app. See design section "Asset Pipeline".
- The goo rework after task 43 (recessed pools sized to the measured hole openings, leak stains instead of drips) was started by Kiro and finished with Claude Code on 15 Nov 2026, while AWS Builder ID sign-in was down and Kiro could not run.
- Submission target: 2 December 2026. Judging runs until 29 January 2027.
- Tasks 6 to 8 were completed with Claude Code on 14 Nov 2026 while waiting for the Kiroween Kiro credits to arrive. The work follows this spec and the steering files. Two changes came out of it: the dial geometry was corrected to match a real desk phone (finger stop at about 4 o'clock, not near 12), and design.md was updated to match. RotaryDial owns its own rotation state, so the `rotation` prop from task 7 was dropped. A local preview page lives at /dev/dial and is not served in production.
