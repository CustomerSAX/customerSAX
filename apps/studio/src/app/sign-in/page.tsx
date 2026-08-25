
import { Suspense } from 'react';
import { SignInClient } from './SignInClient';

export default function SignInPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: '#050B14' }} />}>
      <SignInClient />
    </Suspense>
  );
}
