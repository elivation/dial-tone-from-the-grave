import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dial Tone from the Grave',
  description: 'A haunted rotary phone that dials into a cursed phone book.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
