import { Suspense } from "react";
import { LoginView } from "../../features/auth/LoginView";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-white" />}>
      <LoginView />
    </Suspense>
  );
}
