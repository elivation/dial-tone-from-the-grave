/** The digits dialled so far. Screen readers hear each new digit as it arrives. */
export function DialledDisplay({ digits }: { digits: string }) {
  return (
    <output
      aria-label="Dialled number"
      className="block min-h-8 font-mono text-2xl tracking-[0.35em] text-amber-200/90"
    >
      {digits}
    </output>
  );
}
