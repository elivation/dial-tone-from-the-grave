'use client';
import { useId, type KeyboardEvent } from 'react';
import type { BookPage } from '@/lib/bookSession';
import type { BusinessResult, ResidentResult } from '@/lib/listingSearch';
import { closesBook } from './CloseBookButton';
import { BusinessSection } from './BusinessSection';
import { PageStack } from './PageStack';
import { SectionTabs } from './SectionTabs';
import type { BookSection } from './sections';
import { WhiteSection } from './WhiteSection';

type Props = {
  businesses: readonly BusinessResult[];
  residents: readonly ResidentResult[];
  /** Controlled by the parent, so the 3D book can show the same section. */
  activeSection: BookSection;
  onSectionChange: (section: BookSection) => void;
  /** Escape from anywhere in the book puts it away. */
  onClose: () => void;
  /** The 1313 path: one business section of ghost listings, nothing to flip between. */
  spiritOnly: boolean;
  /** Dials a listing's short number on the phone. Without it the book only reads. */
  onDial?: ((digits: string) => void) | undefined;
  /** Listings the caller has dialled from this page. They are labelled "called". */
  calledIds?: readonly string[] | undefined;
  /** Every page of the session book, for flipping. Left out, the book has one page. */
  pageStack?: { pages: readonly BookPage[]; index: number; onFlip: (by: -1 | 1) => void };
};

/** The accessible HTML layer of the phone book: section tabs over the white and business lists. */
export function PhoneBookPage({
  businesses,
  residents,
  activeSection,
  onSectionChange,
  onClose,
  spiritOnly,
  onDial,
  calledIds,
  pageStack,
}: Props) {
  const base = useId();
  const tabId = (section: BookSection) => `${base}-tab-${section}`;
  const panelId = (section: BookSection) => `${base}-panel-${section}`;

  const onKeyDown = (event: KeyboardEvent) => {
    if (closesBook(event)) onClose();
  };
  if (spiritOnly) {
    return (
      <section aria-labelledby={`${base}-heading`} onKeyDown={onKeyDown}>
        <h2 id={`${base}-heading`} className="sr-only">
          The Dead Pages: Spirit Listings
        </h2>
        {pageStack && <PageStack {...pageStack} />}
        <BusinessSection listings={businesses} onDial={onDial} calledIds={calledIds} />
      </section>
    );
  }

  return (
    <section aria-labelledby={`${base}-heading`} onKeyDown={onKeyDown}>
      <h2 id={`${base}-heading`} className="sr-only">
        Phone book
      </h2>
      {pageStack && <PageStack {...pageStack} />}
      <SectionTabs
        active={activeSection}
        onChange={onSectionChange}
        tabId={tabId}
        panelId={panelId}
      />
      <div role="tabpanel" id={panelId(activeSection)} aria-labelledby={tabId(activeSection)}>
        {activeSection === 'white' ? (
          <WhiteSection residents={residents} onDial={onDial} calledIds={calledIds} />
        ) : (
          <BusinessSection listings={businesses} onDial={onDial} calledIds={calledIds} />
        )}
      </div>
    </section>
  );
}
