# How Kiro was used

Working notes on how Kiro shaped Dial Tone from the Grave. Everything here can be checked in `.kiro/`, the git history or the test files. Where I could not back something up, I say so.

## Specs

The spec lives in `.kiro/specs/dial-tone-from-the-grave/`: `requirements.md`, `design.md` and `tasks.md`. Requirements say what must be true, design says how, tasks say in what order. Every test name carries the requirement it covers, for example `[Req 3.3] sends no temperature...`.

The specs changed a lot while the app was built. Examples from `git log -p` on the three files:

- Requirements grew from 7 to 15. The first draft (597c091) had seven short requirements. Thirty-five minutes later (d1fcb47) they became ten, with a glossary and numbered acceptance criteria such as "digit 1 takes 100 ms and digit 0 takes 1 000 ms". Requirements 11 to 14 (dial a number from the book, the phone ringing by itself, the session book, Johannesburg flavour) arrived together in d95a40b. Requirement 15, the fictional notice, was added with the short dial numbers in 1947808:

  ```
  1. The app SHALL show a small footer line, "All businesses, people and numbers in The Dead Pages are fictional."
  ```

- Emergency numbers changed state. The first version of Req 2.8 sent 112, 911 and the rest to `wrong-number` with static. Commit 3b5e5c1 sent them to a new `emergency-notice` state with no spooky sound, added 107 to the list, and dropped the `hung-up` state.

- RLS: public read became revoke-all. The first design had a "public read non-spirit" policy on `businesses` and `residents`. While writing the migrations (4fdf7f9) it became clear the browser never talks to Supabase, so the design table changed from "Public read: Yes" to "No" for every table, and the migrations revoke the default grants. Spirit listings could otherwise be scraped with the publishable key. `supabase/migrations.test.ts` runs the migrations in PGlite with Supabase's roles and checks it.

- IVFFlat became HNSW. The same commit adds one line to the design: IVFFlat with 50 lists has poor recall on about 150 rows, so the embedding indexes are HNSW.

- Temperature was dropped after a live 400. The design said `Temperature: 0.7`. The live model rejected the parameter. Commit c667a3f changed the design to "No temperature is sent" and a test now pins it:

  ```ts
  it('[Req 3.3] sends no temperature, which the current Haiku model rejects with a 400', async () => {
    stream.mockReturnValue(plainReply('ok'));
    await post({ number: '1023', message: 'hi', history: [], turnIndex: 0 });
    expect(stream.mock.calls[0]?.[0]).not.toHaveProperty('temperature');
  });
  ```

- The book shows even when a search finds nothing. Req 9.9 asks for a "no listings found" state. Task 44 said the 3D book is "Visible only when `results` is non-empty", which would have hidden that state. The component tree in design.md changed (9291268) to "shown once a search has come back, with an empty page when it found nothing".

- The poster. On a phone-class CPU the 3D scene put about 25 s of blocking time on the main thread and held Lighthouse mobile Performance at 66. The design gained a "Poster until the first tap" section (77f4a53): a still of the real scene, with the R3F canvas only mounted after the first tap or key press. `scripts/makePoster.mjs` renders the stills from our own render.

- The Supabase integration note. The database was created through the Vercel Supabase integration, which may add its own variables. Commit cc15476 added a line to the design saying the app reads only three of them and leaves the rest alone.

- Spec format. In d95a40b the requirements headings moved to the shape Kiro's spec validator expects (`## Requirements`, `### Requirement N`, `#### Acceptance Criteria`). I ran the validator on all three files today. `requirements.md` and `design.md` pass. `tasks.md` has one error: the dependency graph at the top uses `"wave"` where the validator wants `"id"`. I have not changed it.

Tasks ran one at a time. Each task went to a sub-agent that wrote the failing test first, then the code. The orchestrator ticked the box only after lint, typecheck and the full test run were green, then committed (`docs: tick task 22 and drop temperature from design` is a typical pair with the feature commit before it). Kiro's own task tracking is in `tasks.meta.json`, which records each execution against its task.

## Steering

The six files in `.kiro/steering/` are always in context, plus `AGENTS.md` at the repo root. One example each.

- product.md says no real directory, telecom or phone company names, anywhere. That produced `lib/brandNames.ts` (added in the seed commit, 0ef5408) and a test that scans the seed data:

  ```ts
  expect(findBrandNames(JSON.stringify({ BUSINESSES, RESIDENTS }))).toEqual([]);
  ```

  The same check runs over operator prompts, incoming messages, listing ghost prompts and the book's filler entries.

- tech.md says all Claude calls go through one server route with per-IP limits and a daily cap. `app/api/operator/route.ts` is the only place the SDK is called, and the cap and limits are in `lib/rateLimits.ts` with property tests P10 to P12.

- structure.md says operator numbers live in `lib/operators.ts` only. `lib/dialPlan.ts` imports `OPERATOR_NUMBERS` and `EMERGENCY_NUMBERS` from there, and the listing numbers are generated to stay clear of both.

- writing-style.md bans dashes. Tests enforce it where text is user facing, for example `expect(text).not.toMatch(/[\u2013\u2014]/)` over every operator prompt, greeting and name. The operators are also told to write in South African English ("colour, organise, just now, shame"), and speech picks an `en-ZA` voice when the browser has one.

- engineering-practices.md asks for red, green, refactor. Commits are made on green, so the git history cannot show the red runs. What it does show is the test files arriving in the same commit as the code, with requirement numbers in the names.

- testing.md fixes the name format and the stack. `[P1][Req 1.3] returnDuration(d) === PULSES[d] * 100 for all digits` follows it exactly.

- AGENTS.md was written by `create-next-app` for this Next.js version and tells agents to read `node_modules/next/dist/docs/` before writing code. The config uses `cacheComponents` and `partialPrefetching`, which are not in older Next.js. I cannot point to one commit that came directly from a docs read, so I will not claim one.

The never-real-emergency-numbers rule from the product brief shows up as one constant:

```ts
export const EMERGENCY_NUMBERS = new Set<string>(['10111', '10177', '107', '112', '911', '999']);
```

`lib/dialPlan.ts` builds `RESERVED_NUMBERS` from it, and `conflictsWithReserved` rejects any listing number that starts with a reserved number or is the start of one. The reason is in the comment there: dialling pauses for two seconds before the call is placed, so a listing that began with 112 would reach the emergency notice.

## Hooks

Five hooks in `.kiro/hooks/`. Kiro does not keep hook output, and no commit message records one firing, so I cannot claim a catch for any of them. What I can say is what each checks and what happens when I run the same check by hand today.

- lint-on-save runs ESLint with `--max-warnings 0` on the saved `.ts` or `.tsx` file, then `tsc --noEmit`.
- test-on-save runs Vitest when a file under `lib/` or `components/RotaryDial` is saved. Task 5 described it as filtered to the saved file. As written it runs the whole suite and shows the last 20 lines.
- rls-check runs on any save under `supabase/migrations/`. It finds each `create table` and exits 2 if the file lacks `enable row level security`. Run by hand over the migrations folder, `0002_businesses.sql`, `0003_residents.sql` and `0004_rate_limits.sql` pass, and the other four files create no tables.
- operator-safety runs on `lib/operators.ts`. It reads each `number: '...'` and exits 2 if one is an emergency number. By hand it finds 1023, 1026, 666 and 1313 and reports no clash.
- update-writeup fires on a prompt and asks the agent to refresh this file from the specs, steering, hooks and source. No draft from it existed when I wrote this, so this file was written fresh from the repo.

## MCP

No MCP server was used. There is no `mcp.json` in the repo or in my user settings. The database work went through the Supabase CLI and a few scripts instead:

- `pnpm db:push:dry` and `pnpm db:push` apply migrations over the direct connection.
- `pnpm db:verify` runs `supabase/verify.sql` through `scripts/psql-readonly.mjs`, which opens a read-only session and prints only rows that start with `CHECK|`.
- `pnpm db:types` regenerates `lib/database.types.ts` from the live schema.
- `pnpm fn:deploy`, `pnpm fn:smoke`, `pnpm db:seed` and `pnpm db:search-smoke` cover the embed function, the seed and the search.

The reasons were scope and output. A script uses one connection string and nothing else, verification can be made read-only in the script itself, and I decide what gets printed. With a database holding a secret key and a connection string, I wanted the output filtered rather than handed over whole.

## Property-based testing

The design lists 16 correctness properties. `tasks.md` still says "P1 through P13" in its notes, because P14 to P16 were added with the extra requirements. fast-check is pinned at 3.23.2.

| Property | What it says                                                       | Where it is tested                                                                   |
| -------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| P1       | Return time is pulses times 100 ms                                 | `lib/dial.test.ts`                                                                   |
| P2       | Pulse count matches the face value, 10 for zero                    | `lib/dial.test.ts`                                                                   |
| P3       | Hole angles are unique integers in 0 to 360                        | `lib/dial.test.ts`                                                                   |
| P4       | A drag registers only within 3 degrees of the stop                 | `lib/dial.test.ts`                                                                   |
| P5       | The call reducer never returns an unknown state                    | `lib/callMachine.test.ts`                                                            |
| P6       | Only the exact emergency number reaches the notice                 | `lib/callMachine.test.ts`                                                            |
| P7       | Spooky detection is true when a keyword is present                 | `lib/spooky.test.ts`                                                                 |
| P8       | Spirit listings stay out unless asked for                          | unit tests in `supabase/migrations.test.ts` (Req 7.2)                                |
| P9       | Spirit listings come back when asked for                           | unit tests in `supabase/migrations.test.ts` (Req 7.3)                                |
| P10      | A count at or under the limit is allowed                           | `lib/rateLimits.test.ts`                                                             |
| P11      | A count over the limit is denied                                   | `lib/rateLimits.test.ts`                                                             |
| P12      | Input over `MAX_INPUT_CHARS` fails the schema                      | `lib/rateLimits.test.ts`                                                             |
| P13      | The operator never invents listings                                | prompt wording tested in `lib/operators.test.ts`, behaviour is manual review and E2E |
| P14      | Listing numbers are unique, dialable and clear of reserved numbers | `supabase/seed/seed.test.ts`                                                         |
| P15      | The session book keeps its bounds                                  | `lib/bookSession.test.ts`                                                            |
| P16      | The phone never rings by itself mid-call                           | `lib/callMachine.test.ts`                                                            |

P8 and P9 are marked "unit" in the design and are tagged by requirement rather than by P number. P13 is marked manual in the design, so it has no property test.

P1, from `lib/dial.test.ts`:

```ts
const digitArb = fc.constantFrom(...DIGITS);

it('[P1][Req 1.3] returnDuration(d) === PULSES[d] * 100 for all digits', () => {
  fc.assert(fc.property(digitArb, (d: Digit) => returnDuration(d) === PULSES[d] * 100));
});
```

P5 and P6, from `lib/callMachine.test.ts`:

```ts
it('[P5] never returns undefined or an unknown state, for any state and event', () => {
  fc.assert(
    fc.property(anyState, anyEvent, (state, event) => {
      const next = callReducer(state, event);
      return next !== undefined && STATUSES.includes(next.status);
    }),
  );
});

it('[P6] the exact emergency number goes to emergency-notice, extra digits do not', () => {
  fc.assert(
    fc.property(fc.constantFrom(...EMERGENCY_NUMBERS), digit, (number, extra) => {
      const exact = callReducer(dialling(number), { type: 'CALL_PLACED' });
      const longer = number + extra;
      const next = callReducer(dialling(longer), { type: 'CALL_PLACED' });
      return (
        exact.status === 'emergency-notice' &&
        (EMERGENCY_NUMBERS.has(longer) || next.status !== 'emergency-notice')
      );
    }),
  );
});
```

## What was not done in Kiro

Tasks 6 to 8 (the rotary dial maths, the dial component and the drag) were done with Claude Code on 14 November 2026 while I waited for the Kiroween Kiro credits. The commits are 00f7572 (task 6) and f2f4e20 (tasks 7 and 8), and `tasks.md` says so in its notes. The work follows the spec and the steering files. It also corrected the spec: the finger stop moved to about 4 o'clock to match a real desk phone, and the `rotation` prop on the dial was dropped because the component owns its own rotation.

The goo rework (commit 8595359, recessed pools sized to the measured hole openings and leak stains on the plate instead of drips) was started in Kiro and finished with Claude Code on 15 November, because Kiro could not sign in that day. The goo look is still being reworked. The later horror pass (0360a0a) is marked in `tasks.md` as built, look unfinished, parked.

## Friction

- A psql error showed part of the database password. psql's own error message can echo connection details, and its URI parser trips on some passwords. That is why `scripts/psql-readonly.mjs` splits the URL itself, hands psql `PG*` variables, and prints only "psql failed" on a bad exit. I rotated the password afterwards.
- CSP against cacheComponents. The task asked for a strict `script-src 'self'`. Next writes inline bootstrap scripts into every page, and the browser blocked all eight of them on the home page. A nonce needs per-request rendering, which `cacheComponents` and `partialPrefetching` rule out. I kept the cache features and allowed `'unsafe-inline'` for scripts, limited to our own origin. The reasoning is in the comment at the top of `next.config.ts` and in the design.
- Lighthouse and the poster. Mobile Performance sat at 66 with the live 3D scene. Rather than strip the scene, the page now shows a still until the first tap (see Specs above).
- A spec that disagrees with its own tooling. The validator rejects the wave graph in `tasks.md`, and the notes there still say 13 properties when there are 16.
