---
inclusion: always
---
# Engineering practices

How the owner of this codebase works. Follow these on every task.

## 1. Think before code
- Before any feature, restate the goal in one or two sentences and list what is unclear. Ask instead of assuming.
- For anything bigger than a small fix, write a short plan first: files to touch, approach, risks, how it will be tested. Get approval if it changes the design.
- YAGNI: build only what a requirement asks for. No speculative options, flags or abstractions.

## 2. Test-driven development
- Red, green, refactor. Write the failing test first, watch it fail for the right reason, write the smallest code that passes, then clean up.
- Every acceptance criterion in requirements.md maps to at least one test. Note the requirement number in the test name.
- Property-based tests (fast-check) for anything with rules over many inputs: dial angle to digit, pulse counts, state machine transitions, search ranking, rate limit maths, emergency number blocking.
- Never delete or weaken a test to make it pass. If a test is wrong, explain why before changing it.

## 3. Systematic debugging
- Do not guess. Reproduce the bug first, ideally as a failing test.
- Find the root cause by reading errors fully, checking recent changes and tracing data back to where it goes wrong. One hypothesis at a time, test it, then change one thing.
- If three fixes in a row fail, stop and rethink the approach, then tell me what you found.
- Fix the cause, not the symptom. Add a test that would have caught it.

## 4. Verify before saying done
- A task is done only when lint, typecheck and all tests pass and you have run the thing you changed (or the relevant test) and seen it work.
- Report what you actually ran and what the output was. Never claim something works without evidence. If something could not be verified, say so plainly.

## 5. Small steps, clean history
- One task at a time from tasks.md. Mark it done only after step 4.
- Commit after each task with a conventional commit message. Small commits, each one leaves the app working.
- Never commit secrets, .env files or generated junk.

## 6. Code quality
- TypeScript strict, no any, no ts-ignore without a comment explaining why.
- Small focused functions and components, clear names, no dead code, no commented out code.
- DRY where it removes real duplication, not at the cost of clarity.
- Handle errors at the boundary (API routes, external calls) and fail in character for the user, never with a raw stack trace.
- Comments explain why, not what.

## 7. Self review before handing over
Before telling me a task is done, review your own diff as a strict senior reviewer would: correctness, edge cases, security (input validation, secrets, RLS), accessibility, performance, and whether it matches the requirement. Fix what you find first.

## 8. When stuck or unsure
Stop and ask. A short question is cheaper than a wrong day of work.
