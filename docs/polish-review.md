# Sound and book feel review (task 51)

Nothing here is built. This is a read of the code, plus a few numbers measured offline, with costed proposals so you can pick.

## How I looked, and what I could not do

I read `lib/audio.ts` and every caller, `components/PhoneScene`, `lib/speak.ts`, `lib/voice.ts`, `OperatorPanel`, `StaticOverlay`, `PhoneBook3D.tsx`, `pageTurn.ts`, `pageDeck.ts`, `leafGeometry.ts` and the lights. For the click, static and ring levels I re-implemented the Web Audio bandpass in a node one-liner (48 kHz, 200 runs) and measured peaks. That is my own filter, not the browser's, so treat the numbers as close, not exact.

I cannot hear anything and I did not render the book. Every "thin" below is a judgement from the code and the levels. Each sound proposal therefore includes some blind tuning, and the cheapest way to close that gap is a small script that writes the generated buffers to WAV files so you can listen before anything is wired in. I have counted that script in the estimates where it matters.

## Things that cut across everything

- Sound starts muted (`readMuted` in `lib/audio.ts`, line 199) and the only way on is the small Unmute button top right. A judge who never finds it hears none of this. The demo video is fine because you will unmute, but live judging is not.
- CSP has `media-src 'none'` (`next.config.ts`). So no `<audio>` elements, not even from data: or blob: URLs. Everything below is plain Web Audio nodes and buffers made in code, which needs no CSP change. Anything that needs an AudioWorklet loaded from a blob would need `script-src` changes, so I have avoided it.
- Existing tests pin the current sound spec: the click is 5 ms through an 800 Hz, Q 2 bandpass at gain 0.5 (`lib/audio.test.ts`, Req 8.2), the ring is 400 plus 450 Hz on the 400/200/400/2000 ms cadence (Req 8.4), and `turnEase` is symmetric and must be slow at both ends (`pageTurn.test.ts`, Req 13.2). Changing the click or the ease means changing those tests and the design text, with a reason stated in the commit. I will not weaken one silently. The ring, busy and pip cadences can stay as they are.
- Sound ignores reduced motion on purpose (see the comment on `AudioEngine`). Page and book motion proposals must still respect it. Sound proposals do not need to.
- The iPhone ring/silent switch mutes Web Audio. The usual workaround is a silent looping `<audio>` element, which `media-src 'none'` forbids. I would leave that alone and say so in the demo notes.

## Dial: clicks, wind-up, return, finger stop

Now. Each pulse calls `click()` (`lib/audio.ts` line 151), fired from the 100 ms interval in `useDialController.ts` (`runBack`). The click is a 5 ms slice of white noise through the 800 Hz bandpass at gain 0.5. The buffer is made once (`clickBuffer ??=`), so every pulse is the identical waveform. Nothing sounds while the wheel is dragged out, and nothing sounds when the wheel reaches rest.

Measured. Click peak is about 0.11 (0.07 to 0.18 across runs), about minus 19 dBFS, with an RMS of 0.043 inside the 5 ms. Compared with the other sounds that is 9 dB under the dial tone peak (0.3), 11 dB under the static peaks (about 0.39) and 13 dB under the ring peak (0.5). It also has no decay shape, only a hard 5 ms cut, and a Q 2 band at 800 Hz rings for under a millisecond.

Thin. A very quiet, very short, always identical tick is the first sound anyone hears and it repeats up to ten times per digit, so the sameness is obvious. A real dial has three things this lacks: the ratchet as the wheel is wound out, the whirr of the governor while it returns, and a clunk when it lands against the stop.

D1. Rebuild the click and add the landing clunk (small, 30 to 45 credits)

- Changes: each pulse plays a short tick (1 to 2 ms of noise with a fast exponential decay, centred about 1.5 to 3 kHz) plus a quiet body thump (a 150 to 220 Hz sine, 25 ms decay). Gain and playback rate vary by a few percent per pulse. Peak rises to about 0.3. The last pulse of a digit adds a heavier clunk, since it coincides with the wheel arriving at rest (`left === 0` in `runBack`).
- Why: every demo digit becomes audible and physical. This is the cheapest way to make the hero feature sound as good as it looks.
- Risk: no autoplay issue, since a pointer press has already woken the context. Tests for Req 8.2 change, as noted above. Gain is the only real danger: keep the peak under 0.3 so it does not fight the dial tone on laptop speakers.

D2. Wind-up ratchet and a governor whirr (medium, 70 to 110 credits)

- Changes: `useDialController` gets two more callbacks (a step while dragging, throttled to one tick per hole width of travel, and a start/stop for the return). The engine plays a faint ratchet tick on the way out, and a low band-limited buzz (about 1.5 to 3 kHz noise, 20 to 30 Hz amplitude wobble) for the length of the return.
- Why: the wind and the return are what make a rotary dial sound like a rotary dial, but they are the part a judge notices least. Worth it only after D1.
- Risk: the controller is meant to hold no business logic, so these must stay as plain callbacks. Touch drags fire pointer moves fast, so the throttle matters. The whirr needs the same stop handling as `stopAll` so a hang-up cuts it.

## Ring: cadence, timbre, bell, the double ring

Now. `startRingTone()` (line 116) plays two sine oscillators, 400 and 450 Hz, at gain 0.25 each, switched on and off with hard `setValueAtTime` steps on the cadence 0.4 s on, 0.2 off, 0.4 on, 2.0 off (`RING_CADENCE`, line 18). That is the South African double ring cadence, and it is correct. It plays the same sound in two different situations: the ringback while you wait for an operator (`useCall.ts`) and the phone ringing by itself (`useIncomingCall.ts`).

Thin. Two pure sines is the right sound for ringback, because that is what the network sent down the line. It is the wrong sound for a phone that rings by itself, where you expect a bell with a clapper. The incoming ring is the moment the tagline depends on, and it currently sounds like an exchange tone, not a haunted bell. The hard gain steps also give a faint click on each edge.

R1. A bell for the incoming ring (small to medium, 40 to 70 credits)

- Changes: a new `startBell()` that keeps the same 0.4/0.2/0.4/2.0 cadence but strikes a bell: a few sine partials at inharmonic ratios (for example 1, 2.4, 4.1 and 5.8 times about 900 Hz), each with a fast attack and an exponential decay, rapidly retriggered at 16 to 20 Hz within each 0.4 s burst for the clapper. `useIncomingCall` calls it. `startRingTone()` and its tests stay as they are, so outbound ringback is unchanged.
- Why: the phone ringing by itself is the strongest "someone picked up" moment, and it is the one time the audience does not control the sound.
- Risk: the incoming ring only starts after the first pointer or key press, so no autoplay issue. A bell is louder and brighter than a sine, so keep the peak at or under 0.35 and check it on a phone speaker.

Q1. Soften every on and off edge (small, 20 to 30 credits)

- Changes: replace the hard gain steps in `schedule` and the instant start and stop of the dial tone with 3 to 8 ms ramps.
- Why: removes the tiny pops at tone edges and on pick up and hang up. Small, and it makes everything else sound cleaner.
- Risk: the cadence tests read the gain `sets`, so they need to read the ramp targets instead, with the same timings. Same cadence, only the edge shape changes.

## Static and the wrong number whisper

Now. `startStatic()` (line 165) loops a 2 s white noise buffer through a 2000 Hz, Q 0.5 bandpass, with the level swinging between 0.05 and 0.4 by a sine LFO at 7 to 12 Hz. After 2 s (`STATIC_MS`) the static stops and the three pips play, and the line goes idle at 2.9 s. The static overlay on screen flickers twice a second and lasts for the same 2.9 s (`StaticOverlay.tsx`, `globals.css`).

Thin. A sine LFO on noise gives a regular stutter, which reads as a machine rather than a dead line. Real line noise is a hiss with sparse irregular pops. `product.md` promises "static, crackle and a whisper", and there is no whisper. It also has no sound of its own when the number is rejected, only the same noise.

S1. Line noise with real crackle, and optionally a whisper (medium, 60 to 90 credits)

- Changes: build one 4 s buffer in code of low hiss (lowpassed noise, about 3 kHz) with random sparse impulses of varying size, about 5 to 30 a second, and loop it. For the whisper, either breath-shaped noise (two bandpass formants at about 500 Hz and 2000 Hz, with a slow irregular envelope) mixed in under the crackle, or a very quiet `speechSynthesis` line ("who is this?" at low volume, pitch 0.1, rate 0.6) fired on the way into the static. The synthesised breath is controllable. The spoken whisper is more recognisable but its timing and voice vary by platform and it must not fire when muted.
- Why: the wrong number is the cheapest gag in the whole demo and a judge will try it within 30 seconds. A line that sounds dead and then breathes is worth more than any other single effect on the phone.
- Risk: the spoken whisper adds the mobile Safari speech rule (see V1). Breath noise alone is safe. This is the proposal where blind tuning is the biggest cost, so I would do the WAV audition first.

## Busy tone, disconnected pips and the emergency path

Now. Busy is a 400 Hz sine on 375 ms and 375 ms off (`startBusyTone`, line 128) for 3 s, four beats. The pips are three 400 Hz bursts, 150 ms on and 150 off (`playDisconnectedTone`, line 141). Both match the design. The emergency path plays nothing, on purpose: `EmergencyNotice` is a plain white screen and `useCall` leaves the dial tone off in that state (Req 2.8).

Thin. Nothing worth spending on except the edge pops, which Q1 covers. Leave the emergency path silent. Adding a sound there would work against the rule that it looks and feels like a real safety notice.

## Operator voice

Now. `speak()` (`lib/speak.ts`) sets `lang` to en-ZA, copies pitch and rate from the operator (directory 1.1/0.85, clock 0.8/0.9, caretaker 0.6/0.8, spirit 1.3/0.7, listing ghosts 0.9/0.85, the incoming message 0.6/0.8 in `lib/incoming.ts`), and picks a voice with `pickVoice`: a `en-ZA` voice if the browser has one, otherwise a voice whose name contains the whole word "male" or "female". When a reply finishes streaming, `OperatorPanel` speaks it unless muted.

What I found by reading.

1. The opening line is not spoken for the directory, clock, caretaker or listing ghosts. The greeting is added to the transcript on the client (`useOperatorChat.ts`, the `transcript` memo), but `OperatorPanel` only speaks a reply when `streaming` flips to false, and the greeting is not a streamed reply. Only 1313 streams its greeting from the server. So on connect the ghost picks up and says nothing until the caller types. I have not run this in a browser, so please check it first. If true, it is the biggest hole in the demo.
2. `speak()` is called seconds after the pick up click, from a timer or a stream, not from a click. Mobile Safari generally wants the first utterance to come from a user gesture. Chrome fills `getVoices()` late, so the first call can see an empty list and fall back to the default voice.
3. `voiceHint` is "male" or "female", matched against voice names. Names like those only appear on some voices (for instance some Google voices). Many platform voices have personal names, so the hint often matches nothing and every operator uses the same default voice, apart from pitch. Pitch itself is ignored by some voices. I have not checked each platform.

What is possible. `speechSynthesis` output goes straight to the speakers. It cannot be routed through a Web Audio node, so there is no way to apply a telephone bandpass, distortion, reverb or ring modulation to it. Recording it is not available either. What can be done is to sit sound around the voice: a line bed (hiss, hum, crackle) under it, a click on connect, a click on hang up, quiet duckings, and a choice of voice, pitch and rate. Pre-rendered and processed TTS clips are out for two reasons: replies are written by the model at call time, and the recordings would not be ours.

V1. Speak the greeting on connect, and prime speech on a gesture (small, 30 to 40 credits)

- Changes: `OperatorPanel` speaks the greeting once when the call connects (unless muted). The pick up click and the Unmute click each fire a silent priming utterance (volume 0, empty text) so mobile Safari lets the later speech through. `pickVoice` reads the voice list again after `voiceschanged`.
- Why: the ghost answers the phone out loud. That is the demo.
- Risk: the first utterance can still be blocked on some mobile browsers. The text is already on screen, so the fallback works. Reduced motion is not involved. It must respect mute and must stop on hang up, which `stopSpeaking` already does.

V2. A line bed under the voice, plus connect and hang up clicks (medium, 50 to 80 credits, or about 30 to 40 if S1 is built first)

- Changes: when a call connects, fade in a faint bed (the S1 hiss and crackle at about minus 30 dBFS, plus a 50 Hz mains hum with its 150 and 250 Hz harmonics so it reaches small speakers) and fade it out on hang up. Add a short relay click when the operator answers and a different one when the line drops.
- Why: it is the only honest way to make a browser voice sound like it travelled down a wire. It also gives the connect moment a sound, which today is silence between the ring stopping and the transcript appearing.
- Risk: the bed also plays while the caller uses the Speak button, and the browser's speech recogniser will hear it through the speakers, so it has to be quiet. It follows the master gain so mute silences it.

V3. Choose voices by platform list, not by "male" or "female" (small, 20 to 40 credits)

- Changes: after the en-ZA check, `pickVoice` tries a short ordered list of known voice names per operator (a deep one for the caretaker, a high one for the spirit line) before the old word match, and then falls back to the default.
- Why: a deeper voice for the caretaker and a clearly different one for the clock is audible in a demo, even without any filter. Today the operators may all sound the same.
- Risk: voice names vary across macOS, Windows, Android and iOS, so the list cannot be complete and I would test only on the machines you own. Never use a name that is a brand.

## Pick up, hang up and room tone

Now. The handset is a DOM button (`Handset.tsx`), not part of the 3D scene, and it makes no sound. Picking up starts the dial tone at once at full level (`useCall.ts`, off-hook effect) and hang up stops every sound through `stopAll`, with no fade. There is no room tone: the scene is silent between sounds.

Thin. Pick up and hang up are the two most repeated actions, and they have no feedback beyond the button label. The dark room is silent, which works against the candlelit look. A faint tone running under everything is what makes a screen recording feel recorded in a place.

H1. Handset lift and cradle sounds (small, 25 to 35 credits)

- Changes: pick up plays a short plastic clack and a rustle (about 120 ms of filtered noise with a low thump). Hang up plays a heavier clunk and a brief bell "ting" from the cradle.
- Why: it rewards the first click a judge makes. With Q1 it also removes the pop at the start of the dial tone.
- Risk: on the pick up click the context is already awake, so there is no autoplay issue. Keep both under about 150 ms so they never lag behind the button.

H2. Room tone (medium, 40 to 70 credits)

- Changes: a very quiet loop (low brown noise, a 50 Hz hum with upper harmonics so laptop speakers carry it, a slow wind gust from a swept bandpass, an occasional creak) starting when the context first wakes. It is separate from the line bed in V2 and is cross-faded out while a call is connected.
- Why: it lifts every other effect and is cheap to keep running.
- Risk: it is continuous audio, so WCAG 1.4.2 expects a way to stop it. The Mute button already is one. On a phone the battery cost is small. At minus 40 dBFS or below it will not mask the speech recogniser, but at that level it needs listening tests on a quiet laptop and a loud room.

## The book opening

Now. When the first search returns, `chat.bookOpen` turns true and `PhoneBook3D` mounts. The book drops from 0.08 above the desk (0.03 m after the book scale) over `BOOK_APPEAR_SECONDS` = 0.6 s with `easeOutCubic` (`PhoneBook3D.tsx` lines 43 and 184). With reduced motion it appears at once. No sound, no landing shake, no dust, and no settle.

Thin. An ease-out cubic lands dead flat, so the book arrives with no weight. Nothing says a heavy book hit a wooden desk. Painting the page textures runs on mount (`createPageTextures` in the render path), so the first frame can be long, and because the drop is measured in frame deltas a long frame can swallow part of the animation. I have not profiled that.

B1. Landing thump and a small settle (small, 25 to 40 credits)

- Changes: a new engine call `bookLand()` (a 90 to 120 Hz sine thump with 80 ms decay, plus 300 ms of lowpassed noise for paper) fired once from the `useFrame` loop when the drop progress reaches 1. Replace `easeOutCubic` with a damped settle, so it overshoots the desk by a hair and rests. Clamp the frame delta so a slow first frame does not skip the drop.
- Why: the book appearing is the payoff of every search, and it is currently the quietest moment in the demo.
- Risk: the call must go through `getAudioEngine()`, which is a module singleton and works from inside the canvas. With reduced motion the book appears without motion, and I would still play a short, softer landing so the result is announced by ear too, but you may prefer silence there. The settle must stop with reduced motion, as the drop does.

B1 cost does not include a dust puff. A puff reuses `DustMotes.tsx` sprites and would be an extra 30 to 50 credits, and costs frames, so I would hold it until after task 49 shows what the frame budget is.

## The page turn

Now. A turn takes `TURN_SECONDS` = 0.7 s. `turnEase` is a smoothstep, so it is symmetric, with the same slow start and slow end (`pageTurn.ts`). The leaf bends along its width by up to 0.8 radians (`BEND`) in the shape of `sin(pi p)`. Every row of the leaf (it has 10 rows, 32 columns) gets the same profile, so the top and bottom edges move together, as a stiff board hinged at the spine would. The leaf casts a shadow from the candle point light (`Lights.tsx`, map 1024, radius 4, bias minus 0.0004). No sound plays on a turn.

Thin. Paper is lifted by a corner, so the corner leads, then the body swings fast, then it floats and settles a little. A symmetric ease with a uniform bend reads as a hinged panel. There is no sound at all, and the turn is the most repeated book action. I did not render the shadow, so I cannot say how the point light shadow looks on a 0.38 scale book. A 1024 cube shadow spread over a 2.5 m light range gives very coarse texels on a 0.2 m page, so I would look at a render before spending anything on it.

B2. Page swish and landing tick (small to medium, 35 to 55 credits)

- Changes: a new `pageTurn(direction)` call that plays 0.7 s of noise through a bandpass swept from about 1.5 kHz up to 4 kHz and back down to 1 kHz, with an envelope shaped by the speed of the leaf, and a soft tick as it lands. Fired from `PhoneBook3D` when a new turn starts (`turn.id` changes in `useFrame`) and again at progress 1. The same sound serves both directions, with a slightly different tilt.
- Why: the turn is the second most visible thing in the book, and with sound it moves from "an animation" to "a page".
- Risk: with reduced motion the page swaps at once, so there is no turn to sound. I would play a very short swish for the swap so the change is still announced. It is optional. Rapid flips start a new turn mid turn (`deckReducer` ends the old one), so the sound must be cut and restarted, not stacked.

B3. A more paper-like turn, and a check of the shadow (medium, 60 to 100 credits)

- Changes: an asymmetric ease (slow lift, fast middle, short damped settle at the end). A per-row phase offset so the top corner leads by up to 0.1 to 0.15 of the turn (so `leafProfile` is computed per row, 11 calls a frame, trivial). Then a look at the shadow in a render, and a tweak to its resolution or radius only if it looks wrong.
- Why: looks more like paper in the video. Most useful if you plan to zoom on the book.
- Risk: three tests in `pageTurn.test.ts` assume a symmetric ease (`turnEase(0.5)` is 0.5, slow at both ends) and need rewriting with a stated reason. It must still land flat, keep the leaf length, and run between 0.5 and 0.8 s. Reduced motion already skips turns. Per-row profiles need to stay lighter than the texture work already done on each flip. Shadow changes cost frame rate, which task 49 is already spending.

## Not proposed

- Music, or anything recorded. Out of the rules.
- Filtering or distorting the operator voice. Not possible with `speechSynthesis`.
- Any sound on the emergency notice.
- A silent audio element for the iPhone silent switch. Blocked by CSP and I would not loosen it for this.

## Ranking for the demo video and live judging

1. V1, spoken greeting on connect with Safari priming (30 to 40). If my reading is right, the ghost is silent when it answers. This is a small fix with the largest effect.
2. D1, new click and the landing clunk (30 to 45). It is the first sound in every run and it repeats on every digit.
3. B1 and B2 together, the book landing and the page swish (60 to 95). The book is where results arrive, and it is silent today.
4. R1, a bell for the incoming ring (40 to 70). The phone ringing by itself is the hook of the tagline.
5. S1, real line noise with a whisper (60 to 90). The wrong number is the first thing a judge will try.

Not ranked but worth doing alongside: the sound nudge (X1 below) and Q1.

X1. A one line "sound is off" nudge (small, 20 to 30 credits)

- Changes: while muted, the status area shows a short in-character line on pick up, such as "The line is quiet. Unmute for sound." with a button that calls `setMuted(false)`.
- Why: without it a live judge may hear nothing at all.
- Risk: the start-muted rule stays, since unmuting is still the user's click. It adds one line of UI copy, which has to follow the writing rules, and it needs a test.

## Suggested bundle

Assumption: about 300 to 400 credits remain after tasks 49 and 50. I could not find any credit figures in the repo to check this, nor from earlier tasks to calibrate against, so the estimates come from counting the files each change touches, the tests the testing rules require (every acceptance criterion maps to a test) and an allowance for blind tuning, since I cannot listen. Treat them as rough.

Bundle A, about 330 credits (low 260, high 400):

| Item                           | Credits  |
| ------------------------------ | -------- |
| V1 spoken greeting and priming | 30 to 40 |
| X1 sound nudge                 | 20 to 30 |
| D1 click and clunk             | 30 to 45 |
| Q1 soft edges                  | 20 to 30 |
| B1 book landing                | 25 to 40 |
| B2 page swish                  | 35 to 55 |
| R1 incoming bell               | 40 to 70 |
| S1 line noise and whisper      | 60 to 90 |

Order of work: V1 and X1 first, because they fix things that may be broken now. Then D1 and Q1, which are the cheap quality gains. Then B1 and B2, then R1, then S1 last because it needs the most listening. Do the WAV audition script before D1, so the later sounds can be tuned by ear instead of by guess.

If only 300 remain, drop Q1 and the whisper half of S1 (keep the crackle, 60 credits). That comes to about 290 at the middle of the ranges, with little slack. If the total is nearer 400, add H1 (25 to 35) and V2 (30 to 40 once S1 exists). That gives the ghost a connect click and a line bed, which are the best available stand-ins for a filtered voice.

Next in line, outside the bundle: D2 (the wind and governor, 70 to 110), B3 (the paper-like turn, 60 to 100), H2 (room tone, 40 to 70), V3 (voice lists, 20 to 40) and a dust puff on the book landing (30 to 50).

## Open checks before building

- Confirm in a browser that the directory, clock and caretaker greetings are not spoken on connect (V1).
- Look at the page turn shadow in a render before deciding on B3.
- Listen to the current click, ring and static once with headphones, then again on a phone speaker, so we agree what "thin" means for you.
