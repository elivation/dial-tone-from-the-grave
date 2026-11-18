import type { CallState } from '@/lib/callMachine';

const TEXT: Record<CallState['status'], string> = {
  idle: 'Pick up the handset to make a call.',
  'off-hook': 'Dial a number.',
  dialling: 'Dialling.',
  ringing: 'Ringing.',
  connected: 'Connected.',
  'wrong-number': 'Wrong number.',
  // The emergency notice covers the screen and speaks for itself.
  'emergency-notice': '',
  busy: 'All lines are busy. Please try again later.',
  'ringing-in': 'The phone is ringing.',
  'incoming-message': 'Someone is on the line.',
};

/** One line saying what the line is doing. A polite live region, so screen readers hear each change. */
export function CallStatus({ state }: { state: CallState }) {
  return (
    <p role="status" aria-live="polite" className="min-h-6 font-serif text-amber-200/80">
      {TEXT[state.status]}
    </p>
  );
}
