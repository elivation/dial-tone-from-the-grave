import { notFound } from 'next/navigation';
import { PhonePreview } from './PhonePreview';

export const metadata = { title: 'Phone preview' };

/**
 * Local preview of the 3D phone with the finger wheel held at one angle, for render checks.
 * Not served in production. Use `?wheel=90` to turn the wheel 90 degrees clockwise from rest.
 */
export default async function PhonePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const wheel = Number((await searchParams)['wheel']);
  return <PhonePreview wheel={Number.isFinite(wheel) ? wheel : 0} />;
}
