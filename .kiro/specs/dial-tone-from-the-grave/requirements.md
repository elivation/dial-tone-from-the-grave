# Requirements: Dial Tone from the Grave

## Introduction
A web app that brings back the rotary phone and the printed phone book. The user dials numbers on a haunted rotary phone, a ghost operator answers, and search results are shown on a phone book page. Built for Kiroween 2026 (Resurrection).

## Requirement 1: Rotary dial
**User story:** As a user, I want to dial numbers by dragging a rotary dial, so it feels like a real old phone.

Acceptance criteria
1. WHEN the user drags a finger hole clockwise to the finger stop and releases THEN the system SHALL register that digit.
2. WHEN a digit is registered THEN the dial SHALL spin back at a realistic speed and play one click per pulse.
3. IF the user releases before reaching the finger stop THEN the system SHALL NOT register a digit.
4. WHEN the user presses a number key on the keyboard THEN the system SHALL register that digit and animate the dial.
5. The dial SHALL work with mouse and touch.

## Requirement 2: Making a call
**User story:** As a user, I want to pick up the handset and dial a number, so I can reach an operator.

Acceptance criteria
1. WHEN the user picks up the handset THEN the system SHALL play a dial tone.
2. WHEN the user has dialled a full number and pauses for 2 seconds THEN the system SHALL place the call.
3. IF the number matches an operator THEN the system SHALL ring and connect to that operator.
4. IF the number does not match any operator THEN the system SHALL play static and a whispered "wrong number" line, then a disconnected tone.
5. WHEN the user hangs up THEN the system SHALL end the call and clear the dialled number.

## Requirement 3: Ghost operators
**User story:** As a user, I want each number to reach a different ghost operator with its own personality.

Acceptance criteria
1. The system SHALL have at least 3 operators, one of them on 1023 for directory enquiries.
2. WHEN connected THEN the operator SHALL greet the user in character.
3. WHEN the user speaks or types a request THEN the operator SHALL reply in character within 5 seconds.
4. The operator's reply SHALL be read aloud and also shown as text.
5. IF voice input is not available THEN the system SHALL offer a typed input.

## Requirement 4: Directory enquiries (1023)
**User story:** As a user, I want to ask the 1023 operator for a business or service in plain words, so I can find what I need.

Acceptance criteria
1. WHEN the user asks for a service (for example "someone to fix my geyser tonight in Edenvale") THEN the system SHALL search listings by meaning, not just by name.
2. The system SHALL return up to 10 matching listings ranked by relevance.
3. WHEN results are found THEN the operator SHALL summarise them in character and the phone book page SHALL open.
4. IF nothing matches THEN the operator SHALL say so in character and suggest a broader search.

## Requirement 5: Phone book page
**User story:** As a user, I want results shown like a printed phone book page.

Acceptance criteria
1. The page SHALL show listings in columns with bold business names, area, phone number and short description.
2. Some listings SHALL appear as small boxed adverts.
3. The page SHALL have an aged, yellowed, candle-lit look.
4. The page SHALL be readable on mobile.
5. Phone numbers SHALL be fictional (demo data only).

## Requirement 6: Spirit listings easter egg
**User story:** As a user, I want to find hidden ghost businesses, so the app is fun to explore.

Acceptance criteria
1. The seed data SHALL include spirit listings (for example a 24 hour haunted locksmith).
2. Spirit listings SHALL only appear for spooky searches or a secret number.

## Requirement 7: Cost and abuse limits
**User story:** As the owner, I want the app to stay cheap and online until judging ends.

Acceptance criteria
1. The system SHALL limit operator requests per IP per hour.
2. The system SHALL have a daily global cap on Claude calls.
3. WHEN a limit is hit THEN the system SHALL respond in character ("all lines are busy") instead of an error.
4. The Claude API key SHALL never reach the browser.

## Out of scope
- Real phone calls or telephony
- Real people's details
- User accounts and login
