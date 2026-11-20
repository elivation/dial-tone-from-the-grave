import { FictionNotice } from '@/components/FictionNotice/FictionNotice';
import { PhoneScene } from '@/components/PhoneScene/PhoneScene';

export default function Home() {
  return (
    <main className="relative h-screen w-screen desk-backdrop">
      <h1 className="sr-only">Dial Tone from the Grave</h1>
      <PhoneScene />
      <FictionNotice />
    </main>
  );
}
