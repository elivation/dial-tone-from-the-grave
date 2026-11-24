# Submission checklist

Kiroween 2026, category Resurrection. Rules read on 23 November 2026 from the official rules page.

Deadline: 4 December 2026, 2:00 pm Pacific Time. That is 22:00 UTC, which is **midnight between Friday 4 and Saturday 5 December in Johannesburg (SAST)**. No extensions, no late entries. The plan in tasks.md is to submit by 2 December so there is slack.

Status values: done (checked on 23 November 2026), not done (nothing exists yet), needs you (only you can do it).

| Requirement                                                                                                                                                           | Status                                                                                           | Where to find it                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Working public URL, free and unrestricted for judges                                                                                                                  | done, returns 200                                                                                | https://dial-tone-from-the-grave.vercel.app                                                                 |
| Devpost text description (features and functionality)                                                                                                                 | not done, needs you                                                                              | Devpost submission form. Source material: README.md                                                         |
| Demo video, under 3 minutes, public on YouTube, no third-party trademarks or copyrighted music                                                                        | not done, needs you                                                                              | Shot list and timings in DEMO_SCRIPT.md (planned 2:40). Paste the YouTube link into the form                |
| Public GitHub repo, open source licence visible in the About section                                                                                                  | done, repo is public (unauthenticated request returns 200) and GitHub detects the licence as MIT | https://github.com/elivation/dial-tone-from-the-grave                                                       |
| MIT licence file                                                                                                                                                      | done                                                                                             | LICENSE at repo root                                                                                        |
| `.kiro/` at repo root and not in `.gitignore`                                                                                                                         | done, 15 files tracked (specs, steering, hooks) and `.gitignore` has no `.kiro` entry            | `.kiro/specs/dial-tone-from-the-grave/`, `.kiro/steering/`, `.kiro/hooks/`                                  |
| Kiro write-up (IDE, hooks, specs, steering, PBT and so on)                                                                                                            | done as a draft in the repo, needs you to paste it into the form                                 | KIRO_USAGE.md                                                                                               |
| Category named in the form                                                                                                                                            | needs you                                                                                        | Resurrection                                                                                                |
| Free judge access until 29 January 2027                                                                                                                               | done in setup, needs watching                                                                    | See "Keeping it live" below                                                                                 |
| Disclose pre-existing code and third-party assets                                                                                                                     | done in the repo, needs you to mention it in the description                                     | README.md credits: WE500 phone model (CC BY 4.0), Poly Haven desk texture (CC0), Google Fonts under the OFL |
| Project built after 30 October 2026                                                                                                                                   | done, GitHub repo created 13 November 2026                                                       | GitHub repo creation date, git history                                                                      |
| Project material in English                                                                                                                                           | done                                                                                             | All docs and UI copy                                                                                        |
| Bonus Blog Prize: public blog post about Kiro and the build, published before the deadline, saying it was written for the Kiroween 2026 hackathon                     | not done, later, needs you                                                                       | Blog URL goes in the form                                                                                   |
| Social Blitz Prize: public post that starts with `#KiroweenHackathon26`, your favourite thing about Kiro and how it changed your approach, posted before the deadline | not done, later, needs you                                                                       | Post URL goes in the form                                                                                   |
| Both bonus URLs added to the submission                                                                                                                               | not done, needs you                                                                              | Devpost submission form                                                                                     |

## Keeping it live

- Hosting is Vercel on the owner account (Pro plan). Every push to `main` deploys production, so avoid risky pushes after submitting.
- Supabase is on the free plan, which pauses idle projects. `vercel.json` has a daily cron at 10:00 UTC calling `/api/cron/keepalive` to prevent that. Confirm the cron shows in the Vercel dashboard.
- Claude is paid from Anthropic credit. The cost guard is `CLAUDE_DAILY_GLOBAL_CAP=500` (see `.env.example`), plus the per-IP limit. Check the credit balance covers 500 calls a day until 29 January 2027, and top up if not. When the cap is hit the operator answers in character that the line is busy.
- Judging runs from 16 December 2026 to 29 January 2027, so the site must stay up through both.

## Things the rules say that the project may not meet

- **Kiro credits.** The request form closes 1 December 2026, 12:00 pm Pacific (22:00 SAST), and codes must be redeemed by 4 December. Not a submission requirement, but the window is short.
- **"Insufficient use of Kiro" disqualifies.** Some work was done with Claude Code while Kiro was unavailable (tasks 6 to 8 and the goo rework, noted in tasks.md). KIRO_USAGE.md should say so plainly and show that the specs, steering, hooks and PBT came from Kiro.
- **Repo owner is an organisation (`elivation`).** The rules allow organisations as entrants, but the Devpost entrant should match whoever you register as.
- **Social post quality.** Judges rate originality and say they are looking for original thoughts instead of AI writing. Write it yourself.
- **Judges may not test the app.** They can judge from the video and description alone, so the video has to carry the demo.
- **Demo video has to show the device it was built for.** Record the phone on a real desktop browser, and consider a short mobile clip, since the app is mobile first.

## Before you press submit

1. Open the live URL in a fresh browser profile, pick up, dial 1023 and get a result. Do the same on your phone.
2. Watch the uploaded YouTube video logged out. Confirm it is public, under 3:00 and has no music you do not own.
3. Confirm the GitHub About box shows MIT and the description and homepage URL.
4. Paste the KIRO_USAGE.md write-up into the form and re-read it for dashes and chatbot phrasing.
5. Mention the CC BY 4.0 phone model and the other assets in the description.
6. Add the blog URL and the social post URL, and tick the category as Resurrection.
7. Save a draft first. After the deadline nothing can be edited.
8. Check the Anthropic credit balance and the Vercel cron before you stop looking at it.

## Final checks

Run on 24 November 2026 against the production deploy after the task 39 commit.

- Lint, typecheck and build: clean. Tests: 86 files, 886 tests pass. One of five runs had a single unidentified failure in a 3D dial geometry test and did not repeat. Watch for it in CI.
- Live end to end suite: 22 passed, 0 skipped, 0 failed, 1.2 minutes. The @live check spent one Claude call.
- Lighthouse mobile on the live URL, three runs (version 13.6.0): performance 99, 99, 99; accessibility 100, 100, 100; best practices 100, 100, 100. Medians 99, 100, 100.
- Brand names: the only hits are the blocklist in lib/brandNames.ts and its test. Seed data is clean.
- Model metadata: the glb title named a phone company, in both assets-src/phone/we500.glb and public/models/we500.glb. The title is now "WE500" and the source link is the id-only Sketchfab URL. Author and CC BY 4.0 licence are unchanged. Internal node and material names still contain the company name because preparePhone.ts looks the material up by name. They are not shown anywhere.
- Dashes: none in our own text. AGENTS.md has two em dashes in the block that `next dev` writes and re-adds, so they are left alone.
- Repo hygiene: .kiro/ is tracked, .env\* is ignored except .env.example. No secret patterns in the tracked files or git history, only placeholders (sb_secret_your-key-here and short test strings).
- Cron: /api/cron/keepalive on 0 10 \* \* \* is registered in Vercel.
- Still to do by hand: the Devpost form (URL, description, video link, repo link). Keep 2 December as the buffer. The real deadline is 4 December 2026, 2pm PT, which is midnight between 4 and 5 December in Johannesburg.
