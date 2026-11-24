'use client';

import { ErrorPage } from '@absah/ui';

// Shows no text from the error itself: it is technical and may hold data. The user can retry; the digest stays in the server log.
export default function RouteError({ reset }: { reset: () => void }) {
  return <ErrorPage onRetry={reset} />;
}
