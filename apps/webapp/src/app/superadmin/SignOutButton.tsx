"use client";

import { useRouter } from "next/navigation";
import { Button, Icon } from "@csa/ui";

/**
 * Small client-only sign-out trigger — the surrounding layout is a server
 * component. Calls the real /api/auth/logout route (same one AppShell's
 * sign-out uses), not a superadmin-specific auth mechanism.
 */
export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };

  return (
    <Button variant="ghost" size="sm" leftIcon={<Icon name="log-out" size="xs" />} onClick={() => void handleSignOut()}>
      Sign out
    </Button>
  );
}
