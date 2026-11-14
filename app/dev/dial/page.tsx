import { notFound } from 'next/navigation';

import { DialPreview } from './DialPreview';

export const metadata = { title: 'Dial preview' };

/** Local preview of the rotary dial. Not served in production. */
export default function DialPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DialPreview />;
}
