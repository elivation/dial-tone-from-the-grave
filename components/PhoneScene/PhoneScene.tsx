'use client';
import { useEffect, useRef, useState } from 'react';
import type { CallState } from '@/lib/callMachine';
import { LISTING_DEFAULT_MAX_TURNS } from '@/lib/listingGhost';
import type { BusinessResult, ResidentResult } from '@/lib/listingSearch';
import type { Listing } from '@/lib/sse';
import { useOnline } from '@/lib/useOnline';
import { CallStatus } from '@/components/CallStatus';
import { DialledDisplay } from '@/components/DialledDisplay/DialledDisplay';
import { EmergencyNotice } from '@/components/EmergencyNotice';
import { Handset } from '@/components/Handset';
import { OfflineNotice } from '@/components/OfflineNotice';
import { MuteToggle } from '@/components/MuteToggle';
import { OperatorPanel } from '@/components/OperatorPanel';
import { CloseBookButton, PhoneBookPage } from '@/components/PhoneBookPage';
import type { BookSection } from '@/components/PhoneBookPage';
import { StaticOverlay } from '@/components/Static';
import { PhoneCanvasLoader } from '@/components/PhoneCanvas/PhoneCanvasLoader';
import { useCall } from './useCall';
import { useDialNumber } from './useDialNumber';
import { useOperatorChat } from './useOperatorChat';

const MAX_SHOWN = 14;
/** Matches the server default for MAX_TURNS_PER_CALL. The server enforces the real cap. */
const MAX_TURNS = 6;

/** The number to show: what has been dialled so far, or the number that is ringing or connected. */
function numberShown(state: CallState): string {
  if (state.status === 'dialling') return state.digits.slice(-MAX_SHOWN);
  if (state.status === 'ringing' || state.status === 'connected') return state.operatorNumber;
  return '';
}

const isResident = (listing: Listing): listing is ResidentResult => 'surname' in listing;

/** A search returns one kind of listing. Residents open the white pages, anything else the business pages. */
function splitResults(results: readonly Listing[]) {
  const residents = results.filter(isResident);
  const businesses = results.filter((listing): listing is BusinessResult => !isResident(listing));
  // Only the 1313 line sends nothing but ghosts, so that is the cue for the spirit-only book.
  const spiritOnly = businesses.length > 0 && businesses.every((business) => business.is_spirit);
  return { residents, businesses, spiritOnly };
}

/** The haunted desk, the number being dialled on it, and the handset that starts and ends the call. */
export function PhoneScene() {
  const online = useOnline();
  const call = useCall({ offline: !online });
  const { state, controller, pickUp, hangUp, dismiss, send } = call;
  const dialNumber = useDialNumber({ call, offline: !online });
  const connected = state.status === 'connected' ? state : null;
  const callee = connected?.callee ?? 'operator';
  const maxTurns = callee === 'listing' ? LISTING_DEFAULT_MAX_TURNS : MAX_TURNS;
  const chat = useOperatorChat({
    operatorNumber: connected?.operatorNumber ?? null,
    callee,
    turnIndex: connected?.turnIndex ?? 0,
    maxTurns,
    onTurnSent: () => send({ type: 'TURN_SENT' }),
    onRateLimited: () => send({ type: 'RATE_LIMITED' }),
  });
  const { residents, businesses, spiritOnly } = splitResults(chat.results);
  const defaultSection: BookSection = residents.length > 0 ? 'white' : 'business';
  // A new search starts on the section that holds its results. The tabs then override it.
  const [seen, setSeen] = useState(chat.results);
  const [chosen, setChosen] = useState<BookSection | null>(null);
  const section = chosen ?? defaultSection;
  const handsetButton = useRef<HTMLButtonElement>(null);
  // The book's controls vanish with it, so focus goes to the handset rather than to the page.
  const { closeBook } = chat;
  const putBookAway = () => {
    closeBook();
    handsetButton.current?.focus();
  };
  // The stream cannot survive losing the network, so the line goes dead with it.
  useEffect(() => {
    if (!online) hangUp();
  }, [online, hangUp]);
  if (seen !== chat.results) {
    setSeen(chat.results);
    setChosen(null);
  }

  return (
    <div className="relative h-full w-full">
      {/* inert keeps pointer, touch and tab focus out of the scene while the overlay is up */}
      <div className="contents" inert={!online}>
        <PhoneCanvasLoader
          controller={controller}
          book={chat.bookOpen ? { results: chat.results, activeSection: section } : undefined}
          fallback={
            <p className="flex h-full items-center justify-center px-6 text-center font-serif text-amber-200/80">
              This switchboard needs WebGL to show the phone.
            </p>
          }
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex flex-col items-center gap-3 text-center">
          {connected && (
            <OperatorPanel
              operatorNumber={connected.operatorNumber}
              callee={connected.callee}
              onMessage={chat.send}
              onHangUp={hangUp}
              turnIndex={connected.turnIndex}
              maxTurns={maxTurns}
              transcript={chat.transcript}
              streaming={chat.streaming}
              closing={chat.closing}
              onClosed={() => send({ type: 'TURN_CAP_REACHED' })}
            />
          )}
          <CallStatus state={state} />
          <DialledDisplay digits={numberShown(state)} />
          <Handset state={state} onPickUp={pickUp} onHangUp={hangUp} buttonRef={handsetButton} />
        </div>
        {chat.bookOpen && (
          <PhoneBookPage
            businesses={businesses}
            residents={residents}
            activeSection={section}
            onSectionChange={setChosen}
            onClose={putBookAway}
            spiritOnly={spiritOnly}
            onDial={dialNumber}
          />
        )}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          {chat.bookOpen && <CloseBookButton onClose={putBookAway} />}
          <MuteToggle />
        </div>
        <StaticOverlay visible={state.status === 'wrong-number'} />
        {state.status === 'emergency-notice' && <EmergencyNotice onDismiss={dismiss} />}
      </div>
      {!online && <OfflineNotice />}
    </div>
  );
}
