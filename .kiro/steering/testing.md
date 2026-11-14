---
inclusion: always
---

# Testing rules

Applies to every test file in this project.

## Stack

- Unit and component tests: Vitest + React Testing Library (jsdom environment)
- Property-based tests: fast-check
- End-to-end tests: Playwright (Chromium only during development)

## Rules

- Write tests before or alongside the code they cover (TDD where practical)
- Every acceptance criterion in requirements.md maps to at least one test
- Test name format: `[Req N.AC] description` (e.g. `[Req 1.3] dial returns at 10 pulses per second`)
- Property-based tests are tagged with their design ID: `[P1]`, `[P2]`, etc.
- Never delete or weaken a failing test to make it pass. If a test is wrong, explain why before changing it.
- Never use `any` in test files. Never suppress TypeScript errors with `@ts-ignore` without a comment.
- Mock external dependencies (Claude, Supabase, Web Audio API) at the boundary, not inside the unit under test.
- Keep tests fast. No real network calls in unit tests. No real Supabase in unit tests.

## Coverage expectations

- lib/dial.ts: 4 fast-check property tests (P1-P4)
- lib/callMachine.ts: 13 unit transition tests + 2 property tests (P5, P6)
- lib/spooky.ts: 1 property test (P7) + 3 unit tests
- lib/rateLimits.ts: 3 property tests (P10-P12)
- lib/audio.ts: 3 unit tests with mocked AudioContext
- All API routes: unit tests with mocked Supabase and mocked Anthropic SDK
- All components: render tests + interaction tests with user-event
- E2E: 8 scenarios in tests/e2e/ (implemented in task 35)
