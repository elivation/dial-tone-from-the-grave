import type { Metadata } from 'next';
import { Nixie_One, Special_Elite } from 'next/font/google';
import './globals.css';

const specialElite = Special_Elite({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-special-elite',
});
const nixieOne = Nixie_One({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-nixie-one',
});

export const metadata: Metadata = {
  title: 'Dial Tone from the Grave',
  description: 'A haunted rotary phone that dials into a cursed phone book.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full ${specialElite.variable} ${nixieOne.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
