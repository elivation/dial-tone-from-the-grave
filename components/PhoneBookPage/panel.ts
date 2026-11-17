// Off-screen until something inside has focus, then it shows as a panel so a sighted keyboard
// user can see what they are on (WCAG 2.4.7). Never display:none, so screen readers still read it.
export const PANEL =
  'absolute -left-[10000px] top-0 w-[min(40rem,100vw)] font-serif ' +
  'focus-within:pointer-events-auto focus-within:top-2 focus-within:left-2 focus-within:z-30 ' +
  'focus-within:max-h-[70vh] focus-within:overflow-y-auto focus-within:rounded ' +
  'focus-within:border-2 focus-within:border-stone-900 focus-within:bg-amber-50';
