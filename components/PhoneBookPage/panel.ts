// Off-screen until something inside has focus, then it shows as a panel so a sighted keyboard
// user can see what they are on (WCAG 2.4.7). Never display:none, so screen readers still read it.
export const PANEL =
  'absolute -left-[10000px] top-0 w-[min(40rem,100vw)] font-serif ' +
  'focus-within:pointer-events-auto focus-within:top-2 focus-within:left-2 focus-within:z-30 ' +
  'focus-within:max-h-[70vh] focus-within:overflow-y-auto focus-within:rounded ' +
  'focus-within:border-2 focus-within:border-stone-900 focus-within:bg-amber-50';

// In the listings sheet the same lists are the main thing on screen, so nothing is hidden.
export type SheetLayout = 'twin' | 'sheet';
export const SHEET_LIST = 'font-serif text-stone-900';
export const SHEET_BAR = 'flex font-serif border-2 border-stone-900 bg-amber-50';
// The tab bar follows the same rule as the panels: hidden until a tab has focus, then on screen.
export const TABS_BAR =
  'absolute -left-[10000px] top-0 flex font-serif ' +
  'focus-within:pointer-events-auto focus-within:top-2 focus-within:left-2 focus-within:z-40 ' +
  'focus-within:rounded focus-within:border-2 focus-within:border-stone-900 ' +
  'focus-within:bg-amber-50';

// The small buttons in the top right corner, beside Mute. They are on screen for everyone.
export const CONTROL_BUTTON =
  'pointer-events-auto rounded border border-amber-200/40 bg-black/70 px-4 py-1 font-serif text-sm tracking-widest text-amber-200/90 hover:bg-amber-200/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200';
