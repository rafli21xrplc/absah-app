import { Suspense } from 'react';
import { SignIn } from '../sign-in';

// The address the parents' app and the old links use: it opens the "Orang tua" tab, and after signing in goes to /portal.
export default function PhoneSignInPage() {
  return (
    <Suspense>
      <SignIn start="ortu" fallbackNext="/portal" />
    </Suspense>
  );
}
