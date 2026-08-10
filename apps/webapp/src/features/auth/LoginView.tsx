"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";

function safeInternalPath(raw: string | null) {
  if (!raw) return "/dashboard";

  try {
    const decoded = decodeURIComponent(raw);
    return decoded.startsWith("/") && !decoded.startsWith("//") ? decoded : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(() => safeInternalPath(searchParams.get("callbackUrl")), [searchParams]);
  const [email, setEmail] = useState("agent@csa.local");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        setError("Invalid credentials. Please check your email and password.");
        return;
      }

      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError("Unable to reach the auth service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen overflow-hidden bg-white font-sans text-slate-950">
      <section className="relative hidden min-h-screen w-1/2 flex-col justify-between overflow-hidden bg-[#12233d] px-20 py-20 text-white lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,0.20),transparent_35%),linear-gradient(155deg,#101a31_0%,#173456_100%)]" />
        <div className="relative m-auto w-full max-w-[520px]">
          <div className="mb-14 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-900/30">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight">
                Royal Cyber<span className="text-cyan-400">. CSA</span>
              </div>
              <div className="text-sm font-semibold text-blue-300">Enterprise Customer Operations Platform</div>
            </div>
          </div>

          <h1 className="mb-7 max-w-[520px] text-5xl font-extrabold leading-tight tracking-tight">
            Unified Platform for Enterprise Customer Operations
          </h1>
          <p className="mb-12 max-w-[480px] text-xl leading-relaxed text-slate-300">
            Resolve support tickets, manage orders, and negotiate B2B quotes seamlessly in real time.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/8 p-5 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/35 text-lg">⚡</div>
              <div>
                <div className="text-base font-bold">Real-time Ticket Resolution</div>
                <div className="mt-1 text-sm text-slate-400">Auto-context recovery and 1-click status updates</div>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/8 p-5 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/25 text-lg">🛡</div>
              <div>
                <div className="text-base font-bold">Role-Based ACL Security</div>
                <div className="mt-1 text-sm text-slate-400">Multi-tenant isolation and granular agent permission control</div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative text-center text-sm text-slate-500">
          © 2026 Customer Service Accelerator. All rights reserved.
        </div>
      </section>

      <section className="flex min-h-screen flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px] rounded-[24px] border border-slate-200 bg-white p-10 shadow-[0_28px_80px_rgba(15,23,42,0.10)]">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">Sign In</h2>
            <p className="mt-3 text-base text-slate-500">Enter your credentials to access the workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-600">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                placeholder="you@company.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-600">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-16 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500 hover:text-slate-900"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="h-14 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-base font-extrabold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign in to Workspace"}
            </button>
          </form>

          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">or continue with</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            disabled
            className="flex h-14 w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 text-base font-extrabold text-slate-400"
          >
            <span className="h-4 w-4 rounded bg-orange-500" />
            Continue with Auth0
          </button>
        </div>
      </section>
    </main>
  );
}
