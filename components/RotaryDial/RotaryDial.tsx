'use client';

import { useId, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  DIGITS,
  HOLE_ANGLES,
  PULSE_INTERVAL_MS,
  STOP_ANGLE,
  pointerAngle,
  type Digit,
} from '@/lib/dial';
import { SPRING_BACK_MS, useDialController } from './useDialController';

export type RotaryDialProps = {
  /** Blocks all interaction, for example while a call is connecting. */
  disabled: boolean;
  /** Called once when a digit is dialled, at the moment the user lets go at the stop. */
  onDigit: (digit: Digit) => void;
  /** Called on every pulse while the dial runs back. Hook for the click sound. */
  onPulse?: () => void;
};

/** SVG coordinate size of the dial. */
export const DIAL_SIZE = 320;

const C = DIAL_SIZE / 2;
const PLATE_R = 158;
const WHEEL_R = 128;
const HOLE_ORBIT_R = 102;
const HOLE_R = 20;
const CARD_R = 70;
const STOP_R = 140;
const LABEL_R = 144;

const LETTERS: Record<Digit, string> = {
  '1': '',
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PRS',
  '8': 'TUV',
  '9': 'WXY',
  '0': '',
};

/** Point on a circle around the dial centre. Rounded so server and browser render the same numbers. */
function polar(r: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return { x: round(C + r * Math.sin(rad)), y: round(C - r * Math.cos(rad)) };
}

export function RotaryDial({ disabled, onDigit, onPulse }: RotaryDialProps) {
  const maskId = `dial-holes-${useId().replace(/:/g, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const { rotation, phase, activeDigit, reducedMotion, grab, drag, release } = useDialController({
    disabled,
    onDigit,
    onPulse,
  });

  const angleFromEvent = (event: ReactPointerEvent): number => {
    const rect = svgRef.current?.getBoundingClientRect();
    const width = rect && rect.width > 0 ? rect.width : DIAL_SIZE;
    const height = rect && rect.height > 0 ? rect.height : DIAL_SIZE;
    const cx = (rect?.left ?? 0) + width / 2;
    const cy = (rect?.top ?? 0) + height / 2;
    return pointerAngle(cx, cy, event.clientX, event.clientY);
  };

  const handlePointerDown = (digit: Digit) => (event: ReactPointerEvent) => {
    if (!grab(digit, angleFromEvent(event), event.pointerId)) return;
    event.preventDefault();
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent) => {
    drag(angleFromEvent(event), event.pointerId);
  };

  const finishDrag = (event: ReactPointerEvent) => {
    if (release(event.pointerId)) svgRef.current?.releasePointerCapture?.(event.pointerId);
  };

  const transition =
    phase === 'returning'
      ? `transform ${PULSE_INTERVAL_MS}ms linear`
      : phase === 'springing'
        ? `transform ${SPRING_BACK_MS}ms ease-out`
        : 'none';

  const stopTip = polar(STOP_R - 14, STOP_ANGLE);
  const stopBase = polar(STOP_R + 10, STOP_ANGLE);

  return (
    <div className="relative inline-block w-full max-w-[320px] select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
        className="h-auto w-full"
        role="group"
        aria-label="Rotary dial"
        aria-disabled={disabled}
        style={{ touchAction: 'none' }}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <defs>
          <radialGradient id={`${maskId}-plate`} cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#2b2722" />
            <stop offset="100%" stopColor="#0b0a09" />
          </radialGradient>
          <radialGradient id={`${maskId}-card`} cx="45%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#efe4c6" />
            <stop offset="100%" stopColor="#c9b98f" />
          </radialGradient>
          <mask id={maskId}>
            <circle cx={C} cy={C} r={WHEEL_R} fill="white" />
            {DIGITS.map((d) => {
              const p = polar(HOLE_ORBIT_R, HOLE_ANGLES[d]);
              return <circle key={d} cx={p.x} cy={p.y} r={HOLE_R} fill="black" />;
            })}
            <circle cx={C} cy={C} r={CARD_R - 6} fill="black" />
          </mask>
        </defs>

        {/* Fixed base plate */}
        <circle
          cx={C}
          cy={C}
          r={PLATE_R}
          fill={`url(#${maskId}-plate)`}
          stroke="#3d362d"
          strokeWidth={2}
        />

        {/* Pale metal plate, seen through the clear finger wheel */}
        <circle cx={C} cy={C} r={WHEEL_R} fill="#d9d3c4" />
        <circle cx={C} cy={C} r={WHEEL_R} fill={`url(#${maskId}-card)`} opacity={0.5} />

        {/* Numbers and letters on the fixed outer ring */}
        {DIGITS.map((d) => {
          const n = polar(LABEL_R, HOLE_ANGLES[d] - 5);
          const l = polar(LABEL_R, HOLE_ANGLES[d] + 6);
          return (
            <g key={d} aria-hidden="true">
              <text
                data-testid={`label-${d}`}
                x={n.x}
                y={n.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14}
                fontWeight={700}
                fill="#efe4c6"
                fontFamily="Georgia, 'Times New Roman', serif"
              >
                {d}
              </text>
              {LETTERS[d] && (
                <text
                  x={l.x}
                  y={l.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={7}
                  letterSpacing={0.5}
                  fill="#cfc3a3"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  transform={`rotate(${HOLE_ANGLES[d] + 6} ${l.x} ${l.y})`}
                >
                  {LETTERS[d]}
                </text>
              )}
            </g>
          );
        })}

        {/* Rotating finger wheel */}
        <g
          data-testid="finger-wheel"
          data-rotation={String(Math.round(rotation * 1000) / 1000)}
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${C}px ${C}px`,
            transformBox: 'view-box',
            transition: reducedMotion ? 'none' : transition,
          }}
        >
          <circle
            cx={C}
            cy={C}
            r={WHEEL_R}
            fill="#e9eef0"
            fillOpacity={0.22}
            mask={`url(#${maskId})`}
          />
          <circle
            cx={C}
            cy={C}
            r={WHEEL_R}
            fill="none"
            stroke="#f4f1ea"
            strokeOpacity={0.55}
            strokeWidth={2}
          />
          {DIGITS.map((d) => {
            const p = polar(HOLE_ORBIT_R, HOLE_ANGLES[d]);
            const blocked = disabled || (phase !== 'idle' && activeDigit !== d);
            return (
              <circle
                key={d}
                data-testid={`hole-${d}`}
                cx={p.x}
                cy={p.y}
                r={HOLE_R}
                fill="transparent"
                stroke="#f4f1ea"
                strokeOpacity={0.6}
                strokeWidth={2}
                pointerEvents="all"
                style={{ cursor: blocked ? 'default' : phase === 'dragging' ? 'grabbing' : 'grab' }}
                onPointerDown={handlePointerDown(d)}
                aria-hidden="true"
              />
            );
          })}
        </g>

        {/* Fixed centre card, number written in pen */}
        <circle cx={C} cy={C} r={CARD_R - 6} fill="#c9a94b" />
        <circle cx={C} cy={C} r={CARD_R - 12} fill={`url(#${maskId}-card)`} />
        <text
          x={C}
          y={C + 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={26}
          fill="#2f2a6b"
          fontFamily="'Segoe Script', 'Bradley Hand', 'Comic Sans MS', cursive"
          transform={`rotate(-8 ${C} ${C})`}
          aria-hidden="true"
        >
          1023
        </text>

        {/* Fixed metal finger stop */}
        <line
          data-testid="finger-stop"
          data-angle={String(STOP_ANGLE)}
          x1={stopBase.x}
          y1={stopBase.y}
          x2={stopTip.x}
          y2={stopTip.y}
          stroke="#b9b2a3"
          strokeWidth={7}
          strokeLinecap="round"
          aria-hidden="true"
        />
      </svg>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
    </div>
  );
}
