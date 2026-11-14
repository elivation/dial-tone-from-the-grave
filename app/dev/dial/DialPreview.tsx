'use client';

import { useState } from 'react';

import { RotaryDial } from '@/components/RotaryDial';

export function DialPreview() {
  const [number, setNumber] = useState('');
  const [pulses, setPulses] = useState(0);
  const [disabled, setDisabled] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0b0a09] p-6 text-[#efe4c6]">
      <h1 className="font-serif text-xl tracking-widest">DIAL PREVIEW</h1>
      <RotaryDial
        disabled={disabled}
        onDigit={(d) => setNumber((n) => (n + d).slice(-12))}
        onPulse={() => setPulses((p) => p + 1)}
      />
      <p className="font-mono text-3xl tracking-[0.3em]" aria-label="Dialled number">
        {number || '...'}
      </p>
      <p className="font-mono text-sm text-[#a99b7a]">pulses: {pulses}</p>
      <div className="flex gap-3 text-sm">
        <button
          type="button"
          className="rounded border border-[#5a4f40] px-3 py-1"
          onClick={() => {
            setNumber('');
            setPulses(0);
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className="rounded border border-[#5a4f40] px-3 py-1"
          onClick={() => setDisabled((v) => !v)}
        >
          {disabled ? 'Enable' : 'Disable'}
        </button>
      </div>
    </main>
  );
}
