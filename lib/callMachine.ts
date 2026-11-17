import { EMERGENCY_NUMBERS } from './operators';

export { EMERGENCY_NUMBERS };

/** Who answers: a ghost operator, or the ghost of a listing from the book. */
export type Callee = 'operator' | 'listing';

export type CallState =
  | { status: 'idle' }
  | { status: 'off-hook' }
  | { status: 'dialling'; digits: string }
  | { status: 'ringing'; operatorNumber: string; callee: Callee; ringsRemaining: number }
  | { status: 'connected'; operatorNumber: string; callee: Callee; turnIndex: number }
  | { status: 'wrong-number' }
  | { status: 'emergency-notice' }
  | { status: 'busy' };

export type CallEvent =
  | { type: 'PICK_UP' }
  | { type: 'HANG_UP' }
  | { type: 'DIGIT_DIALLED'; digit: string }
  | { type: 'CALL_PLACED' }
  | { type: 'EMERGENCY_NUMBER' }
  | { type: 'NUMBER_MATCHED'; operatorNumber: string; callee: Callee; ringCount: number }
  | { type: 'NO_MATCH' }
  | { type: 'RING_TICK' }
  | { type: 'TURN_SENT' }
  | { type: 'TURN_CAP_REACHED' }
  | { type: 'RATE_LIMITED' }
  | { type: 'SEQUENCE_COMPLETE' }
  | { type: 'DISMISSED' };

export const initialCallState: CallState = { status: 'idle' };

const IDLE: CallState = { status: 'idle' };

/**
 * The reducer never looks operators up. After CALL_PLACED the caller resolves the number and
 * sends NUMBER_MATCHED or NO_MATCH. The one exception is emergency numbers, which are checked
 * here so no path can send them to an operator. Events that do not fit the current state
 * return the same state object.
 *
 * HANG_UP goes straight to idle. Stopping the sound is a side effect of leaving a state, not a state.
 */
export function callReducer(state: CallState, event: CallEvent): CallState {
  if (event.type === 'HANG_UP') return state.status === 'idle' ? state : IDLE;

  switch (state.status) {
    case 'idle':
      return event.type === 'PICK_UP' ? { status: 'off-hook' } : state;

    case 'off-hook':
      return event.type === 'DIGIT_DIALLED' ? { status: 'dialling', digits: event.digit } : state;

    case 'dialling':
      switch (event.type) {
        case 'DIGIT_DIALLED':
          return { status: 'dialling', digits: state.digits + event.digit };
        case 'CALL_PLACED':
          return EMERGENCY_NUMBERS.has(state.digits) ? { status: 'emergency-notice' } : state;
        case 'EMERGENCY_NUMBER':
          return { status: 'emergency-notice' };
        case 'NUMBER_MATCHED':
          return {
            status: 'ringing',
            operatorNumber: event.operatorNumber,
            callee: event.callee,
            ringsRemaining: event.ringCount,
          };
        case 'NO_MATCH':
          return { status: 'wrong-number' };
        default:
          return state;
      }

    case 'ringing':
      if (event.type !== 'RING_TICK') return state;
      return state.ringsRemaining > 1
        ? { ...state, ringsRemaining: state.ringsRemaining - 1 }
        : {
            status: 'connected',
            operatorNumber: state.operatorNumber,
            callee: state.callee,
            turnIndex: 0,
          };

    case 'connected':
      switch (event.type) {
        case 'TURN_SENT':
          return { ...state, turnIndex: state.turnIndex + 1 };
        case 'TURN_CAP_REACHED':
          return IDLE;
        case 'RATE_LIMITED':
          return { status: 'busy' };
        default:
          return state;
      }

    case 'wrong-number':
    case 'busy':
      return event.type === 'SEQUENCE_COMPLETE' ? IDLE : state;

    case 'emergency-notice':
      return event.type === 'DISMISSED' ? IDLE : state;
  }
}
