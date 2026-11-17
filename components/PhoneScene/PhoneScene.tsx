'use client';
import { useState } from 'react';
import type { CallState } from '@/lib/callMachine';
import type { BusinessResult, ResidentResult } from '@/lib/listingSearch';
import type { Listing } from '@/lib/sse';
import { CallStatus } from '@/components/CallStatus';
import { DialledDisplay } from '@/components/DialledDisplay/DialledDisplay';
import { EmergencyNotice } from '@/components/EmergencyNotice';
import { Handset } from '@/components/Handset';
import { MuteToggle } from '@/components/MuteToggle';
import { OperatorPanel } from '@/components/OperatorPanel';
import { PhoneBookPage } from '@/components/PhoneBookPage';
import type { BookSection } from '@/components/PhoneBookPage';
import { PhoneCanvasLoader } from '@/components/PhoneCanvas/PhoneCanvasLoader';
import { useCall } from './useCall';
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
  const { state, controller, pickUp, hangUp, dismiss, send } = useCall();
  const connected = state.status === 'connected' ? state : null;
  const chat = useOperatorChat({
    operatorNumber: connected?.operatorNumber ?? null,
    turnIndex: connected?.turnIndex ?? 0,
    maxTurns: MAX_TURNS,
    onTurnSent: () => send({ type: 'TURN_SENT' }),
    onRateLimited: () => send({ type: 'RATE_LIMITED' }),
  });
  const { residents, businesses, spiritOnly } = splitResults(chat.results);
  const defaultSection: BookSection = residents.length > 0 ? 'white' : 'business';
  // A new search starts on the section that holds its results. The tabs then override it.
  const [seen, setSeen] = useState(chat.results);
  const [chosen, setChosen] = useState<BookSection | null>(null);
  const section = chosen ?? defaultSection;
  if (seen !== chat.results) {
    setSeen(chat.results);
    setChosen(null);
  }

  return (
    <div className="relative h-full w-full">
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
            onMessage={chat.send}
            onHangUp={hangUp}
            turnIndex={connected.turnIndex}
            maxTurns={MAX_TURNS}
            transcript={chat.transcript}
            streaming={chat.streaming}
            closing={chat.closing}
            onClosed={() => send({ type: 'TURN_CAP_REACHED' })}
          />
        )}
        <CallStatus state={state} />
        <DialledDisplay digits={numberShown(state)} />
        <Handset state={state} onPickUp={pickUp} onHangUp={hangUp} />
      </div>
      {chat.bookOpen && (
        <PhoneBookPage
          businesses={businesses}
          residents={residents}
          activeSection={section}
          onSectionChange={setChosen}
          spiritOnly={spiritOnly}
        />
      )}
      <div className="absolute top-4 right-4 z-20">
        <MuteToggle />
      </div>
      {state.status === 'emergency-notice' && <EmergencyNotice onDismiss={dismiss} />}
    </div>
  );
}
