'use client';
import type { CallState } from '@/lib/callMachine';
import { CallStatus } from '@/components/CallStatus';
import { DialledDisplay } from '@/components/DialledDisplay/DialledDisplay';
import { EmergencyNotice } from '@/components/EmergencyNotice';
import { Handset } from '@/components/Handset';
import { PhoneCanvasLoader } from '@/components/PhoneCanvas/PhoneCanvasLoader';
import { useCall } from './useCall';

const MAX_SHOWN = 14;

/** The number to show: what has been dialled so far, or the number that is ringing or connected. */
function numberShown(state: CallState): string {
  if (state.status === 'dialling') return state.digits.slice(-MAX_SHOWN);
  if (state.status === 'ringing' || state.status === 'connected') return state.operatorNumber;
  return '';
}

/** The haunted desk, the number being dialled on it, and the handset that starts and ends the call. */
export function PhoneScene() {
  const { state, controller, pickUp, hangUp, dismiss } = useCall();
  return (
    <div className="relative h-full w-full">
      <PhoneCanvasLoader
        controller={controller}
        fallback={
          <p className="flex h-full items-center justify-center px-6 text-center font-serif text-amber-200/80">
            This switchboard needs WebGL to show the phone.
          </p>
        }
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex flex-col items-center gap-3 text-center">
        <CallStatus state={state} />
        <DialledDisplay digits={numberShown(state)} />
        <Handset state={state} onPickUp={pickUp} onHangUp={hangUp} />
      </div>
      {state.status === 'emergency-notice' && <EmergencyNotice onDismiss={dismiss} />}
    </div>
  );
}
