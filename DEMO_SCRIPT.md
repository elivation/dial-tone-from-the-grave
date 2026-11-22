# Demo script

Target: 2 minutes 40 seconds (160 s), hard limit 170 s. The video must be under 3 minutes. Shot times add up as 8 + 5 + 12 + 18 + 15 + 8 + 18 + 12 + 10 + 14 + 10 + 20 + 10 = 160 s.

Opening line, over the first shot: "In 1998, the line went dead. Tonight, someone picked up."

Record each shot as its own clip and cut them together. The live parts (Claude replies, speech, the ring-in timer) take longer than the time given here, so the edit does the trimming.

## What changed from the spec's shot list

The task text predates the phone book scene, the dialling of listings and the phone that rings by itself. This version drops the separate "operator greeting" shot (it is folded into the 1023 call), shortens the Night Caretaker to one beat, and adds three shots judges can only see in this build: dialling a listing from the book, the phone ringing by itself, and a short look at the Kiro files.

## Prep checklist

- Browser window 1440 by 900, no other tabs in view, bookmarks bar hidden, page zoom 100%. Record at 1080p or better.
- Sound on and the in-app mute toggle off. Do a ten second test recording first and check that the clicks, the ring and the operator voice are all on the track. The operator voice comes from the browser's speech engine, so it sounds different on each machine. Record system audio, not the microphone.
- Open a fresh tab for every take. The session book (the pages the phone book keeps for this visit) and the ring-in count both live in `sessionStorage`, which clears with the tab. A reused tab shows old pages and may have used up its two self-rings.
- Pick one input style before recording. Speech recognition works in Chrome and Edge and not everywhere. If the microphone prompt appears, or recognition fails, use the typed box in the call panel. The shot list works the same with typed input, so type if there is any doubt. Say the line aloud over the top in the edit.
- Check the seed numbers first. Open the live site, dial 1023, ask the geyser question, and confirm "Sithole Hot Water" shows in the book with HO 6-1019 (dial number 61019). If the search ranks it lower, scroll the page to it. The numbers below come from `supabase/seed/businesses.ts`.
- The phone ringing on cue: the production wait is 45 to 120 seconds from when the phone is idle and on the hook, and it rings at most twice per tab. Two practical ways:
  1. Shoot it in production. Hang up at the end of the Sithole call, leave the clip running, and cut the wait out in the edit. Allow two minutes of recording.
  2. For a reliable take, run a local build with a short wait: set `NEXT_PUBLIC_RING_IN_MIN_S=5` and `NEXT_PUBLIC_RING_IN_MAX_S=8` in `.env.local`, then run `pnpm build` and `pnpm start`. These variables are read at build time, so restart the build after changing them. Use this only for the ring clip. Never change the production values.
- The look may change before recording. The goo on the dial and the Halloween dressing are still in a polish round. Nothing in this script depends on how they look. Re-check the on-screen text after that round lands, and keep the shots short enough to swap.
- The 1023 replies come from Claude live, so the wording differs on every call. The voice-over never quotes the operator. It describes what happened ("the operator found three geyser people in Edenvale") only after you have checked the screen.
- Close notifications and any window that shows real names, paths or keys. The terminal in the Kiro shot must show nothing from `.env.local`.

## Shot list

### 1. Poster and first tap (0:00 to 0:08, 8 s)

- On screen: the desk poster still, the phone by candlelight, then the 3D scene taking over after the tap.
- Action: let the poster sit for two seconds, then tap or click once anywhere on the desk.
- Voice-over: "In 1998, the line went dead. Tonight, someone picked up."
- Sound: quiet room. When the scene loads, the first hum of the line. No music.

### 2. Pick up the handset (0:08 to 0:13, 5 s)

- On screen: the "Pick up the handset" button and the handset lifting.
- Action: press the button.
- Voice-over: "Lift the handset and you get a dial tone."
- Sound: generated dial tone starts.

### 3. Dial 1023 (0:13 to 0:25, 12 s)

- On screen: the rotary dial, the dialled number display.
- Action: drag the dial for 1, 0, 2, 3, then let the two second pause pass so the call is placed. Drag the first two digits for the camera, type the rest with the number keys if the drag is slow.
- Voice-over: "Dial 1023. Directory enquiries."
- Sound: dial click per pulse, the return whirr, then the ring tone twice or three times.

### 4. Ask for a geyser (0:25 to 0:43, 18 s)

- On screen: the operator panel with the conversation log, the voice speaking the greeting.
- Action: say or type "someone to fix my geyser tonight in Edenvale". Do not type a business name or a trade word like "plumber".
- Voice-over: "The old book only found what you already knew the name of. This one understands what you mean."
- Sound: the operator's speech voice, a little static under it. Cut the wait for the reply to about two seconds.

### 5. The book opens (0:43 to 0:58, 15 s)

- On screen: the 3D phone book opening to the results, yellowed pages, candle light, the section tabs. The exchange numbers are printed beside each listing, like "HO 6-1019".
- Action: let the book settle, then turn one page with the page controls. Point at a number with the cursor.
- Voice-over: "The answer lands in a phone book. Every number has an exchange, the way they used to print them."
- Sound: paper rustle if the build has it, otherwise the hum only. Add nothing from outside the app.

### 6. Open a listing (0:58 to 1:06, 8 s)

- On screen: the detail card for Sithole Hot Water (By Candlelight Since 1959), with address, hours and the Dial button.
- Action: click the listing. If search ranked a different geyser business first, open that one and use its number below.
- Voice-over: "Open a listing and there is a number you can dial."
- Sound: a soft click only.

### 7. Dial the listing from the book (1:06 to 1:24, 18 s)

- On screen: the Dial button, the dialled display showing 61019, the listing circled in the book, the call panel.
- Action: press Dial on Sithole Hot Water. Wait for the ring, then let the ghost who answers say a line or two. Ask one short thing, like "are you open tonight?".
- Voice-over: "No dialling by hand. The book dials for you, and whoever is in that listing picks up."
- Sound: ring tone, then a voice with a different pitch from the 1023 operator. Do not quote the reply.

### 8. The phone rings by itself (1:24 to 1:36, 12 s)

- On screen: the handset shaking, the status line "The phone is ringing."
- Action: hang up, then wait for the ring (see the prep checklist). Press the handset when it rings. The line plays a short invented message and hangs up.
- Voice-over: "Sometimes it rings and nobody dialled."
- Sound: the ring tone, then the message in a low slow voice. These messages are written by us and sit in `lib/incoming.ts`, so they are safe to quote if you want to.

### 9. Dial 666 (1:36 to 1:46, 10 s)

- On screen: the dial, then the Night Caretaker panel.
- Action: dial 6, 6, 6. Ask "got a story?" and cut as soon as the story is under way.
- Voice-over: "666 is the night caretaker. He has been on shift for sixty years."
- Sound: a lower voice than the 1023 operator. Cut the story off before it ends.

### 10. Dial 1313, the spirit listings (1:46 to 2:00, 14 s)

- On screen: the Spirit Line greeting, then the book open on the spirit listings.
- Action: hang up and dial 1, 3, 1, 3. Wait for the book to turn to the spirit pages. Move the cursor over "The Midnight Locksmith" (DU 3-1301) and "Seance Plumbing and Drains" (DU 3-1302).
- Voice-over: "1313 is the spirit line. Locksmiths who open doors after midnight. Drains with something down there."
- Sound: ring, the spirit line greeting in a high thin voice.

### 11. A wrong number (2:00 to 2:10, 10 s)

- On screen: the dialled display, then the wrong number state.
- Action: hang up, pick up, dial 4, 7, 2, 9 and wait.
- Voice-over: "Dial a number that does not exist and you get static, and a whisper."
- Sound: generated static and crackle, then the whisper. Let it play for four seconds in the clip before cutting.

### 12. Kiro (2:10 to 2:30, 20 s)

- On screen: the editor with the `.kiro/` folder open. Show `specs/dial-tone-from-the-grave/tasks.md` with ticked tasks, then the `steering/` folder, then the `hooks/` folder. End on the terminal with the test run finished and green.
- Action: click through the four views, about four seconds each. In the terminal, run `pnpm test` ahead of time and show the finished output, so the take does not wait on it. Do not scroll past anything from `.env.local`.
- Voice-over: "Kiro wrote this from a spec: requirements, a design, and a task list ticked off one at a time. Six steering files kept the writing and the tests honest. Hooks ran lint and the tests on every save. The design has sixteen properties, and each one is a test."
- Sound: no effects. Keep the voice-over clear.

### 13. Closing and tagline (2:30 to 2:40, 10 s)

- On screen: the desk again, the handset back on the cradle, the live URL as text: dial-tone-from-the-grave.vercel.app
- Action: hang up and let the scene sit. Fade the URL in over the last four seconds.
- Voice-over: "Dial Tone from the Grave. In 1998, the line went dead. Tonight, someone picked up."
- Sound: the line hum fading to silence.

## Time check

| Shot                   | Seconds |
| ---------------------- | ------- |
| 1 Poster and first tap | 8       |
| 2 Pick up              | 5       |
| 3 Dial 1023            | 12      |
| 4 Ask for a geyser     | 18      |
| 5 The book opens       | 15      |
| 6 Open a listing       | 8       |
| 7 Dial the listing     | 18      |
| 8 Rings by itself      | 12      |
| 9 Dial 666             | 10      |
| 10 Dial 1313           | 14      |
| 11 Wrong number        | 10      |
| 12 Kiro                | 20      |
| 13 Closing             | 10      |
| Total                  | 160     |

The total is 160 s, which leaves 10 s under the 170 s limit. If the edit runs long, cut shot 9 first (10 s), then shorten shot 5.

## Rules for the recording

- Sound comes from the app only. Every sound (dial clicks, ring, static, hum) is generated by the Web Audio API and the voices come from the browser's speech engine. No music, no recordings, nothing added in the edit apart from the voice-over.
- No real company or directory names on screen. All businesses and people in the book are invented.
- Do not state a price, a phone number for a real business or an operator reply as fact. The book is fiction.
