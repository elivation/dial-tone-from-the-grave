'use client';
import { useEffect, useRef, useState } from 'react';
import { useBookSession } from '@/lib/useBookSession';
import type { CallState } from '@/lib/callMachine';
import { LISTING_DEFAULT_MAX_TURNS } from '@/lib/listingGhost';
import type { BusinessResult, ResidentResult } from '@/lib/listingSearch';
import type { Listing } from '@/lib/sse';
import { useOnline } from '@/lib/useOnline';
import { CallStatus } from '@/components/CallStatus';
import { DialledDisplay } from '@/components/DialledDisplay/DialledDisplay';
import { EmergencyNotice } from '@/components/EmergencyNotice';
import { Handset } from '@/components/Handset';
import { IncomingMessage } from '@/components/IncomingMessage';
import { OfflineNotice } from '@/components/OfflineNotice';
import { MuteToggle } from '@/components/MuteToggle';
import { OperatorPanel } from '@/components/OperatorPanel';
import { CloseBookButton, OpenBookButton, PhoneBookPage } from '@/components/PhoneBookPage';
import { ListingsButton, ListingsSheet } from '@/components/PhoneBookPage/ListingsSheet';
import { OpenedListing } from '@/components/PhoneBookPage/OpenedListing';
import type { BookSection } from '@/components/PhoneBookPage';
import { StaticOverlay } from '@/components/Static';
import { PhoneCanvasLoader } from '@/components/PhoneCanvas/PhoneCanvasLoader';
import { useCall } from './useCall';
import { useDialNumber } from './useDialNumber';
import { useIncomingCall } from './useIncomingCall';
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

const NO_RESULTS: readonly Listing[] = [];

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
  const { dial: dialNumber, pending: dialPending } = useDialNumber({ call, offline: !online });
  useIncomingCall({ state, send, offline: !online, dialPending });
  const connected = state.status === 'connected' ? state : null;
  const callee = connected?.callee ?? 'operator';
  const maxTurns = callee === 'listing' ? LISTING_DEFAULT_MAX_TURNS : MAX_TURNS;
  const session = useBookSession();
  const { page, markDialled, addPage } = session;
  // A search that found nothing adds no page, but the book still says so until the caller flips.
  const [emptyShown, setEmptyShown] = useState(false);
  const [opened, setOpened] = useState<Listing | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const listingsButton = useRef<HTMLButtonElement>(null);
  const chat = useOperatorChat({
    operatorNumber: connected?.operatorNumber ?? null,
    callee,
    turnIndex: connected?.turnIndex ?? 0,
    maxTurns,
    onTurnSent: () => send({ type: 'TURN_SENT' }),
    onRateLimited: () => send({ type: 'RATE_LIMITED' }),
    onResults: (results, query) => {
      setEmptyShown(results.length === 0);
      addPage(query, results);
    },
  });
  // Dialling a listing, by the Dial button or by hand, circles it in the book.
  const calling =
    (state.status === 'ringing' || state.status === 'connected') && state.callee === 'listing'
      ? state.operatorNumber
      : null;
  useEffect(() => {
    if (calling !== null) markDialled(calling);
  }, [calling, markDialled]);

  const showEmpty = chat.bookOpen && (page === null || emptyShown);
  const shown = showEmpty ? NO_RESULTS : (page?.results ?? NO_RESULTS);
  const { residents, businesses, spiritOnly } = splitResults(shown);
  const defaultSection: BookSection = residents.length > 0 ? 'white' : 'business';
  // A new page starts on the section that holds its results. The tabs then override it.
  const pageKey = showEmpty ? 'empty' : (page?.id ?? 'none');
  const [seen, setSeen] = useState(pageKey);
  const [chosen, setChosen] = useState<BookSection | null>(null);
  const section = chosen ?? defaultSection;
  const handsetButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  // Each of the two buttons replaces the other, so focus is moved once the swap has rendered.
  const pendingFocus = useRef<'close' | 'open' | null>(null);
  const { closeBook, openBook, bookOpen } = chat;
  useEffect(() => {
    if (pendingFocus.current === 'close' && bookOpen) closeButton.current?.focus();
    else if (pendingFocus.current === 'open' && !bookOpen) openButton.current?.focus();
    else return;
    pendingFocus.current = null;
  }, [bookOpen]);
  const putBookAway = () => {
    closeBook();
    // With pages to come back to, focus lands on Open the book. Otherwise the book's controls
    // are simply gone, so it goes to the handset rather than to the page.
    if (session.count > 0) pendingFocus.current = 'open';
    else handsetButton.current?.focus();
  };
  const reopenBook = () => {
    pendingFocus.current = 'close';
    setEmptyShown(false);
    openBook();
  };
  // The stream cannot survive losing the network, so the line goes dead with it.
  useEffect(() => {
    if (!online) hangUp();
  }, [online, hangUp]);
  if (seen !== pageKey) {
    setSeen(pageKey);
    setChosen(null);
  }
  const flipBook = (by: -1 | 1) => {
    if (emptyShown) setEmptyShown(false);
    else session.flip(by);
  };
  const openListing = (id: string) => setOpened(shown.find((listing) => listing.id === id) ?? null);
  const calledIds = showEmpty ? undefined : page?.calledIds;
  const closeSheet = () => {
    setSheetOpen(false);
    listingsButton.current?.focus();
  };
  const pageStack = { pages: session.pages, index: session.index, onFlip: flipBook };

  return (
    <div className="relative h-full w-full">
      {/* inert keeps pointer, touch and tab focus out of the scene while the overlay is up */}
      <div className="contents" inert={!online}>
        <PhoneCanvasLoader
          controller={controller}
          book={
            chat.bookOpen
              ? {
                  results: shown,
                  pageId: pageKey,
                  pageIndex: showEmpty ? undefined : session.index,
                  activeSection: section,
                  calledIds,
                  dogEared: !showEmpty && page?.dogEared === true,
                  onOpenListing: openListing,
                  onFlip: flipBook,
                  canFlip: {
                    previous: emptyShown || session.index > 0,
                    next: emptyShown || session.index < session.count - 1,
                  },
                }
              : undefined
          }
          fallback={
            <p className="flex h-full items-center justify-center px-6 text-center font-serif text-amber-200/80">
              This switchboard needs WebGL to show the phone.
            </p>
          }
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex flex-col items-center gap-3 text-center">
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
          {state.status === 'incoming-message' && (
            <IncomingMessage messageIndex={state.messageIndex} />
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
            calledIds={calledIds}
            pageStack={pageStack}
          />
        )}
        {sheetOpen && chat.bookOpen && (
          <ListingsSheet
            businesses={businesses}
            residents={residents}
            activeSection={section}
            onSectionChange={setChosen}
            onClose={closeSheet}
            spiritOnly={spiritOnly}
            onDial={dialNumber}
            calledIds={calledIds}
            pageStack={pageStack}
          />
        )}
        {opened && (
          <OpenedListing listing={opened} onClose={() => setOpened(null)} onDial={dialNumber} />
        )}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          {chat.bookOpen && (
            <ListingsButton onOpen={() => setSheetOpen(true)} buttonRef={listingsButton} />
          )}
          {chat.bookOpen && <CloseBookButton onClose={putBookAway} buttonRef={closeButton} />}
          {!chat.bookOpen && session.count > 0 && (
            <OpenBookButton onOpen={reopenBook} buttonRef={openButton} />
          )}
          <MuteToggle />
        </div>
        <StaticOverlay visible={state.status === 'wrong-number'} />
        {state.status === 'emergency-notice' && <EmergencyNotice onDismiss={dismiss} />}
      </div>
      {!online && <OfflineNotice />}
    </div>
  );
}
