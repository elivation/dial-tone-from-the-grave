'use client';
import { useCallback, useEffect, useReducer } from 'react';
import {
  BOOK_STORAGE_KEY,
  addPage,
  emptySession,
  flipPage,
  markDialled,
  parseSession,
  serialiseSession,
  type BookPage,
  type BookSession,
} from '@/lib/bookSession';
import type { Listing } from '@/lib/sse';

type State = { session: BookSession; loaded: boolean };

type Action =
  | { type: 'load'; session: BookSession }
  | { type: 'search'; query: string; results: readonly Listing[] }
  | { type: 'dialled'; digits: string }
  | { type: 'flip'; by: -1 | 1 };

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'load':
      // Strict mode runs the load effect twice, and the second read must not stack on the first.
      return state.loaded ? state : { loaded: true, session: action.session };
    case 'search':
      return { ...state, session: addPage(state.session, action) };
    case 'dialled':
      return { ...state, session: markDialled(state.session, action.digits) };
    case 'flip':
      return { ...state, session: flipPage(state.session, action.by) };
  }
}

/** Storage can be missing or refuse writes (private modes, full quota). The book then lasts the page. */
function readStored(): BookSession {
  try {
    return parseSession(window.sessionStorage.getItem(BOOK_STORAGE_KEY));
  } catch {
    return emptySession;
  }
}

function writeStored(session: BookSession) {
  try {
    window.sessionStorage.setItem(BOOK_STORAGE_KEY, serialiseSession(session));
  } catch {
    // The book carries on in memory.
  }
}

export type BookSessionApi = {
  /** The open page, or null while the book has none. */
  page: BookPage | null;
  /** Every page, oldest first. */
  pages: readonly BookPage[];
  /** Position of the open page, from 0. */
  index: number;
  count: number;
  addPage: (query: string, results: readonly Listing[]) => void;
  markDialled: (digits: string) => void;
  flip: (by: -1 | 1) => void;
};

/**
 * The pages of the phone book for this tab. They are kept in `sessionStorage` only, so they
 * outlive a reload but not the tab, and nothing about them goes to the server. Storage is read
 * after mount so the server and first client render agree.
 */
export function useBookSession(): BookSessionApi {
  const [{ session, loaded }, dispatch] = useReducer(reduce, {
    session: emptySession,
    loaded: false,
  });

  useEffect(() => dispatch({ type: 'load', session: readStored() }), []);
  useEffect(() => {
    if (loaded) writeStored(session);
  }, [loaded, session]);

  const add = useCallback(
    (query: string, results: readonly Listing[]) => dispatch({ type: 'search', query, results }),
    [],
  );
  const dialled = useCallback((digits: string) => dispatch({ type: 'dialled', digits }), []);
  const flip = useCallback((by: -1 | 1) => dispatch({ type: 'flip', by }), []);

  return {
    page: session.pages[session.current] ?? null,
    pages: session.pages,
    index: session.current,
    count: session.pages.length,
    addPage: add,
    markDialled: dialled,
    flip,
  };
}
