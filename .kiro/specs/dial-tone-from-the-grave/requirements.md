# Requirements: Dial Tone from the Grave

## Introduction

A web app that brings back the rotary phone and the printed phone book. The user dials numbers on a haunted rotary phone, a ghost operator answers, and results appear on a phone book page: yellow-style pages for businesses or plain white pages for residents. Built for Kiroween 2026 (Resurrection category).

## Glossary

| Term           | Meaning                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Finger hole    | One of 10 holes in the rotary dial, labelled 1-9 and 0                                                                      |
| Finger stop    | The fixed metal peg at the bottom-right that limits clockwise rotation                                                      |
| Pulse          | One mechanical click per unit of a dialled digit (digit 1 = 1 pulse, digit 0 = 10 pulses)                                   |
| Operator       | A ghost persona reached by dialling a specific number                                                                       |
| Spirit listing | A fictional spooky business in the seed data, hidden by default                                                             |
| Spooky search  | A query whose text contains one or more words from the spooky keyword list in `lib/spooky.ts`                               |
| Dead Pages     | The app's own brand name for the directory; never use real brand names from any printed directory, telecom or phone company |
| White Pages    | The resident section of the phone book (people, not businesses)                                                             |

---

## Requirement 1: Rotary dial

**User story:** As a user, I want to dial numbers by dragging a rotary dial so it feels like a real old phone.

### Acceptance Criteria

1. WHEN the user drags a finger hole clockwise to the finger stop and releases THEN the system SHALL register that digit.
2. IF the user releases before reaching the finger stop THEN the system SHALL NOT register a digit.
3. WHEN a digit is registered THEN the dial SHALL return anticlockwise at a rate of exactly 10 pulses per second (100 ms per pulse), so digit 1 takes 100 ms and digit 0 takes 1 000 ms.
4. WHEN the dial is returning THEN the system SHALL play exactly one audible click per pulse (digit 1 = 1 click, digit 9 = 9 clicks, digit 0 = 10 clicks).
5. WHEN the user presses a number key (0-9) on the keyboard THEN the system SHALL register that digit and animate the dial with a full clockwise swing to the finger stop (approximately 150 ms) followed by the normal return with pulses and clicks.
6. The dial SHALL function with mouse drag, touch drag (mobile-first), and keyboard number keys.
7. The dial SHALL have an accessible name and SHALL announce each registered digit to screen readers via an ARIA live region.
8. WHERE the user has enabled `prefers-reduced-motion` THEN the dial SHALL skip all rotation animation, register the digit immediately, and still play the click sounds.

---

## Requirement 2: Call flow and state machine

**User story:** As a user, I want to pick up the handset and dial a number so I can reach an operator.

### Acceptance Criteria

1. The system SHALL model the call as an explicit state machine with the following states: `idle`, `off-hook`, `dialling`, `ringing`, `connected`, `wrong-number`, `emergency-notice`, and `busy`.
2. WHEN the user picks up the handset THEN the system SHALL transition from `idle` to `off-hook` and play a continuous dial tone.
3. WHEN the first digit is dialled THEN the system SHALL transition to `dialling` and stop the dial tone.
4. WHEN the user has dialled at least one digit and 2 seconds pass with no new digit (measured from when the dial finishes returning to rest) THEN the system SHALL place the call.
5. IF the dialled number matches a known operator THEN the system SHALL transition to `ringing`, ring the number of times defined for that operator in `lib/operators.ts` (2 or 3), then transition to `connected`.
6. IF the dialled number does not match any operator THEN the system SHALL transition to `wrong-number`, play static and crackle, play a whispered "wrong number…" line, then play the disconnected tone.
7. WHEN the user hangs up from any state THEN the system SHALL transition to `idle`, stop any sound that is playing, and clear the dialled number.
8. IF the user dials one of the reserved emergency numbers (10111, 10177, 107, 112, 911, 999) THEN the system SHALL transition to `emergency-notice`, not `wrong-number`, and show a plain, calm, out-of-character screen with a spoken message: "This is a game and cannot call anyone. If you have an emergency, please use a real phone and dial 112 or 10111." The system SHALL NOT play static, crackle or any spooky effect in this state.
9. WHEN the system is in `connected` state and a new digit is dialled THEN the system SHALL ignore the input (no hang-up, no re-dial).
10. WHEN the `busy` state is entered (rate limit hit) THEN the system SHALL play a busy tone and display an in-character "all lines are busy" message before returning to `idle`.

---

## Requirement 3: Ghost operators

**User story:** As a user, I want each number to reach a different ghost operator with its own personality.

### Acceptance Criteria

1. The system SHALL provide at least three operators, defined exclusively in `lib/operators.ts`. Adding a new operator SHALL require no changes to any UI component.
2. Each operator SHALL have: a dialling number, a display name, a persona prompt, a voice configuration (pitch, rate, voice name hint), and a ring count (2 or 3).
3. WHEN connected, the operator SHALL greet the user in character within 8 seconds, measured from the moment the connection is established to the first text token appearing on screen.
4. The operator reply SHALL stream: text SHALL begin appearing as soon as the first token arrives; it SHALL not wait for the full reply before displaying.
5. The operator reply SHALL also be read aloud using the browser's `speechSynthesis` API in the voice configured for that operator.
6. Each operator reply SHALL be no longer than 4 sentences.
7. WHEN the user sends a message THEN the operator SHALL reply within 8 seconds (first token).
8. The system SHALL allow a maximum of `MAX_TURNS_PER_CALL` user turns per call (default: 6, configurable via env var). On the final turn the operator SHALL say goodbye in character and the system SHALL hang up automatically.
9. The system SHALL reject any user input longer than `MAX_INPUT_CHARS` characters (default: 300, configurable via env var) with an in-character "I couldn't quite catch that" message.
10. IF voice input (SpeechRecognition) is not available or permission is denied THEN the system SHALL offer a visible typed-input field as a fallback.
11. The operator SHALL never claim to be a real service, never invent real people's personal details, and never provide medical, legal, or financial advice.
12. IF the user requests unsafe, harmful, or inappropriate content THEN the operator SHALL refuse in character without breaking persona.

---

## Requirement 4: Directory enquiries (1023)

**User story:** As a user, I want to ask the 1023 operator for a business or a person in plain words so I can find what I need.

### Acceptance Criteria

1. WHEN the user asks for a service or business (e.g. "someone to fix my geyser tonight in Edenvale") THEN the system SHALL execute `search_businesses`: a hybrid search combining vector similarity, Postgres full-text search, and suburb matching in a single SQL RPC function.
2. WHEN the user asks for a person (e.g. "I'm looking for a Botha in Edenvale") THEN the system SHALL execute `search_residents`: a search that matches on surname first (exact and fuzzy), then initial and suburb.
3. The 1023 operator SHALL choose between `search_businesses` and `search_residents` based on the nature of the query. The routing logic SHALL be tested with clearly classified example queries.
4. Each search SHALL return up to 10 results ranked by relevance.
5. WHEN results are found THEN the operator SHALL summarise them in character and the appropriate phone book page SHALL open.
6. IF no results are found THEN the operator SHALL say so in character and suggest a broader search term.
7. The operator SHALL ONLY describe listings returned by the search function. It SHALL NEVER invent or fabricate listings not present in the results.
8. WHEN the user asks a follow-up question about the current results (e.g. "what are their hours?") THEN the operator SHALL answer using the data already returned, without triggering a new search.
9. WHEN the user makes a clearly new request THEN the operator SHALL run a new search and replace the current result set.
10. IF the user asks for a real or famous person THEN the operator SHALL respond in character: "I'm afraid the line to the living is out of order."
11. WHEN a query contains one or more words from the spooky keyword list in `lib/spooky.ts` (e.g. ghost, haunt, haunted, seance, séance, spirit, dead, grave, coffin, witch, vampire, zombie, cursed, midnight) THEN spirit listings SHALL be included in the search results alongside regular listings.

---

## Requirement 5: Phone book, business section (yellow-style)

**User story:** As a user, I want business results shown like a printed phone book page.

### Acceptance Criteria

1. The page SHALL display listings in two or three columns (one column on mobile) with bold business name, suburb, phone number, hours, and short description.
2. Listings where `is_advert` is true SHALL appear as small boxed adverts.
3. The page background SHALL simulate aged yellow paper using CSS only (no copyrighted images or textures). A vignette overlay SHALL suggest candlelight.
4. WHERE `prefers-reduced-motion` is active THEN the candle flicker SHALL become a static vignette with no animation.
5. All text SHALL meet WCAG AA contrast ratio (minimum 4.5:1 for body text, 3:1 for large text) against the aged-paper background.
6. WHEN the user taps or clicks a listing THEN the system SHALL show the listing's full details in a torn-paper card overlay.
7. The page header SHALL show a letter range and page number in the style of a printed directory.

---

## Requirement 6: Phone book, white pages (resident section)

**User story:** As a user, I want resident search results shown like the residents section of a printed phone book.

### Acceptance Criteria

1. The white pages page SHALL display entries in a dense, small-print, multi-column layout (one column on mobile) in the classic format: SURNAME Initial, street address, suburb, phone number.
2. The white pages page SHALL have a plain white aged-paper background (no yellow tint, no adverts).
3. All resident entries in the seed data SHALL be entirely fictional (invented names, fictional street numbers, fictional phone numbers in the 011 000 xxxx range). No real people's data shall be included.
4. The phone book view SHALL have two sections the user can flip between: White Pages (residents) and the business section. The flip SHALL be accessible by keyboard.
5. All text on the white pages SHALL meet WCAG AA contrast ratio.
6. WHERE `prefers-reduced-motion` is active THEN section transitions SHALL use a fade of 200 ms or less instead of a page-flip animation.

---

## Requirement 7: Spirit listings easter egg

**User story:** As a user, I want to find hidden ghost businesses so the app rewards exploration.

### Acceptance Criteria

1. The seed data SHALL include approximately 12 spirit listings (e.g. a 24-hour haunted locksmith, a séance plumber). Each spirit listing SHALL have `is_spirit` set to true.
2. Spirit listings SHALL only appear in search results when the query is a spooky search (see Glossary) OR when the user dials the secret number 1313.
3. WHEN the user dials 1313 THEN the system SHALL connect to a brief spirit operator greeting (one line, in character, no further conversation), then open the phone book page filtered to spirit listings only.
4. Spirit listings are business listings only; they do not appear in the white pages.

---

## Requirement 8: Sound design

**User story:** As the developer, I want all sounds generated in code so the app has no unlicensed audio assets.

### Acceptance Criteria

1. The system SHALL generate all sounds using the Web Audio API. No audio files the project does not own SHALL be used.
2. The system SHALL generate the following distinct sounds in code: dial tone, ring tone, busy tone, disconnected tone, dial click (one per pulse), static and crackle.
3. WHEN the handset is picked up THEN the system SHALL play the dial tone.
4. WHEN the system is in `ringing` state THEN the system SHALL play the ring tone.
5. WHEN the system enters `wrong-number` state THEN the system SHALL play static, crackle, and the disconnected tone in sequence.
6. WHEN the system enters `busy` state THEN the system SHALL play the busy tone.
7. The system SHALL start muted until the first explicit user interaction (browser autoplay policy compliance). A visible mute toggle SHALL be present and SHALL remember the user's choice for the session.
8. `prefers-reduced-motion` SHALL NOT affect sound. Sound is controlled only by the mute toggle.

---

## Requirement 9: Accessibility and fallbacks

**User story:** As a user with different abilities or an older browser, I want the app to work for me.

### Acceptance Criteria

1. The rotary dial SHALL have an accessible name and SHALL announce each registered digit via an ARIA live region (see Requirement 1, AC 7).
2. The dial SHALL be fully operable by keyboard (number keys 0-9) as defined in Requirement 1, AC 5.
3. All interactive elements SHALL be reachable and operable via keyboard navigation with visible focus indicators.
4. WHERE `prefers-reduced-motion` is active THEN all animations SHALL be replaced as specified in Requirements 1, 5, 6, and 8.
5. WHERE voice input (SpeechRecognition) is unavailable or permission is denied THEN a typed input fallback SHALL be provided (see Requirement 3, AC 10).
6. WHERE the Claude API is unavailable THEN the system SHALL display an in-character error message ("the operator is unreachable") and allow the user to hang up.
7. WHERE speech synthesis is unavailable THEN the operator reply SHALL still be shown as text.
8. WHERE the user is offline THEN the system SHALL display an in-character message and disable dialling.
9. WHERE a search returns no results THEN the operator SHALL offer an in-character suggestion and the phone book page SHALL show a "no listings found" state (not a blank page or raw error).

---

## Requirement 10: Security and cost controls

**User story:** As the owner, I want the app to stay cheap, secure, and online until judging ends on 29 January 2027.

### Acceptance Criteria

1. The system SHALL rate-limit operator requests per IP per hour. The limit SHALL default to `OPERATOR_LIMIT_PER_IP_PER_HOUR=20` and be configurable via environment variable.
2. The system SHALL rate-limit search requests per IP per hour. The limit SHALL default to `SEARCH_LIMIT_PER_IP_PER_HOUR=60` and be configurable via environment variable.
3. The system SHALL enforce a daily global cap on Claude API calls. The cap SHALL default to `CLAUDE_DAILY_GLOBAL_CAP=500` and be configurable via environment variable. Rate-limit state SHALL be stored in Supabase (no additional vendor).
4. WHEN any rate limit is reached THEN the system SHALL return an in-character response ("all lines are busy, please try later") with HTTP 429. No raw error messages SHALL be shown to the user.
5. The Claude API key SHALL never be included in any client-side bundle or response.
6. Every Supabase table SHALL have Row Level Security enabled. The secret key (`SUPABASE_SECRET_KEY`) SHALL be used only in server-side routes.
7. The app SHALL validate all API inputs using Zod schemas before processing.
8. Security headers SHALL be set via `next.config` including a Content Security Policy that permits only the origins and directives actually used by the app.
9. A daily Vercel cron job SHALL call `/api/health`, which executes a lightweight Supabase query, to prevent the free Supabase project from pausing during the judging period.
10. A `.env.example` file SHALL be committed to the repository containing every environment variable name with a descriptive comment and no real values. `.env*` files SHALL be gitignored. The `.kiro/` directory SHALL NOT be gitignored.

---

## Out of scope

- Real phone calls or telephony
- Real people or real phone numbers in the white pages (the white pages ARE searchable, but every resident is fictional)
- User accounts and login
- Audio files (all sound is generated in code)
- Real brand names or logos of any directory, telecom or phone company
