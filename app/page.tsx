import { PhoneCanvasLoader } from '@/components/PhoneCanvas/PhoneCanvasLoader';

export default function Home() {
  return (
    <main className="h-screen w-screen bg-black">
      <h1 className="sr-only">Dial Tone from the Grave</h1>
      <PhoneCanvasLoader
        fallback={
          <p className="flex h-full items-center justify-center px-6 text-center font-serif text-amber-200/80">
            This switchboard needs WebGL to show the phone.
          </p>
        }
      />
    </main>
  );
}
