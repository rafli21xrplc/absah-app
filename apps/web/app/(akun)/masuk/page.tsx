import { Suspense } from 'react';
import { SignIn } from './sign-in';

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
