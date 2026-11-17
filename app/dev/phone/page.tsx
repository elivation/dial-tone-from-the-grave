import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { PhonePreview } from './PhonePreview';

export const metadata = { title: 'Phone preview' };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** Reads the query inside the Suspense boundary, so the page shell can still render at once. */
async function Preview({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const wheel = Number(params['wheel']);
  const dial = typeof params['dial'] === 'string' ? params['dial'].replace(/[^0-9]/g, '') : '';
  const book = params['book'] === 'business' || params['book'] === 'white' ? params['book'] : null;
  return <PhonePreview wheel={Number.isFinite(wheel) ? wheel : 0} dial={dial} book={book} />;
}

/**
 * Local preview of the 3D phone, for render checks. Not served in production.
 * Use `?wheel=90` to hold the wheel 90 degrees clockwise from rest, or `?dial=1023` to drag those
 * digits round, as a finger would, and see what dialling leaves behind. Use `?book=business` or
 * `?book=white` to lay the phone book on the desk with invented results.
 */
export default function PhonePreviewPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <Suspense fallback={<main className="h-screen w-screen bg-black" />}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}
