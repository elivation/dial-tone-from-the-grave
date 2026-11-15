import { PhoneScene } from '@/components/PhoneScene/PhoneScene';

export default function Home() {
  return (
    <main className="h-screen w-screen bg-black">
      <h1 className="sr-only">Dial Tone from the Grave</h1>
      <PhoneScene />
    </main>
  );
}
