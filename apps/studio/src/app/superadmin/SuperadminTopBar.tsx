"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, Button } from "@csa/ui";

interface SuperadminTopBarProps {
  userEmail: string;
}

/**
 * Persistent dark top bar for the superadmin portal — visually matches
 * ct-csa-standalone's app/superadmin/SuperadminTopBar.tsx. That app's
 * tailwind config exposes m-n300/m-n400/m-n800/m-n900/m-n950 as direct
 * utility names; this repo's preset (apps/studio/src/ui/preset/index.ts)
 * exposes the identical hex scale as m-neutral-300/400/800/900/950
 * instead — same colors, different utility name, so the classes below
 * are translated accordingly. Sign-out calls this repo's real
 * /api/auth/logout — no auth logic here.
 */
export function SuperadminTopBar({ userEmail }: SuperadminTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };

  const isClientsActive = pathname?.startsWith("/superadmin/clients");

  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-m-neutral-800 bg-m-neutral-950 px-6 shadow-m-sm text-white">
      {/* Left: Logo + title + navigation links */}
      <div className="flex items-center gap-6">
        <Link href="/superadmin" className="flex items-center gap-3 transition-opacity hover:opacity-90">
          <div className="flex h-9 w-9 items-center justify-center rounded-m-md bg-m-primary text-white shadow-m-primary">
            <Icon name="shield-check" size="sm" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-white leading-none">SuperAdmin</span>
            <span className="mt-0.5 text-[10px] font-semibold text-m-neutral-400 uppercase tracking-wider leading-none">
              Platform Portal
            </span>
          </div>
        </Link>

        <div className="h-5 w-px bg-m-neutral-800" />

        <nav className="flex items-center gap-1">
          <Link
            href="/superadmin/clients"
            className={`flex items-center gap-2 rounded-m-md px-3 py-1.5 text-xs font-semibold transition-all ${
              isClientsActive
                ? "bg-m-primary/15 text-m-primary-300 border border-m-primary/30"
                : "text-m-neutral-400 hover:bg-m-neutral-900 hover:text-white"
            }`}
          >
            <Icon name="building-2" size="xs" />
            Client Organisations
          </Link>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-m-md px-3 py-1.5 text-xs font-semibold text-m-neutral-400 transition-all hover:bg-m-neutral-900 hover:text-white"
          >
            <Icon name="layout-dashboard" size="xs" />
            CSA Workspace
          </Link>
        </nav>
      </div>

      {/* Right: User info + sign out */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[11px] font-semibold text-m-neutral-400 uppercase tracking-wider">Logged in as</span>
          <span className="max-w-[220px] truncate text-xs font-bold text-white bg-m-neutral-900 border border-m-neutral-800 px-2.5 py-1 rounded-m-md">
            {userEmail}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          leftIcon={<Icon name="log-out" size="xs" />}
          onClick={() => void handleSignOut()}
          className="border-m-neutral-800 bg-m-neutral-900 text-m-neutral-300 hover:bg-m-neutral-800 hover:text-white"
        >
          Sign Out
        </Button>
      </div>
    </header>
  );
}
