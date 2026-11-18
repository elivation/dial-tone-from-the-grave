'use client';
import { useRef, useState, type KeyboardEvent } from 'react';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import type { BookSection } from './sections';
import { SHEET_BAR, TABS_BAR, type SheetLayout } from './panel';

const TABS: readonly { section: BookSection; label: string }[] = [
  { section: 'white', label: 'White Pages' },
  { section: 'business', label: 'Business' },
];

type Props = {
  active: BookSection;
  onChange: (section: BookSection) => void;
  /** Builds the DOM id of a tab or its panel, so each can name the other. */
  tabId: (section: BookSection) => string;
  panelId: (section: BookSection) => string;
  layout?: SheetLayout;
};

/**
 * WAI-ARIA tabs with manual activation: the arrow keys, Home and End move focus, and Enter or
 * Space selects. Only one tab is in the tab order at a time (roving tabindex).
 */
export function SectionTabs({ active, onChange, tabId, panelId, layout = 'twin' }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const [focused, setFocused] = useState<BookSection | null>(null);
  const buttons = useRef<Record<BookSection, HTMLButtonElement | null>>({
    white: null,
    business: null,
  });
  const stop = focused ?? active;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (index + last) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    buttons.current[TABS[target]!.section]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Phone book sections"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null);
      }}
      className={layout === 'sheet' ? SHEET_BAR : TABS_BAR}
    >
      {TABS.map(({ section, label }, index) => (
        <button
          key={section}
          ref={(node) => {
            buttons.current[section] = node;
          }}
          type="button"
          role="tab"
          id={tabId(section)}
          aria-selected={active === section}
          aria-controls={panelId(section)}
          tabIndex={stop === section ? 0 : -1}
          onFocus={() => setFocused(section)}
          onClick={() => onChange(section)}
          onKeyDown={(event) => onKeyDown(event, index)}
          className={
            (layout === 'sheet' ? 'min-h-[44px] ' : '') +
            'px-4 py-2 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
            'focus-visible:outline-stone-900 ' +
            (reducedMotion ? 'transition-none ' : 'transition-colors duration-150 ') +
            (active === section ? 'bg-amber-200 font-bold' : 'bg-amber-50')
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}
