"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Sparkles, TicketCheck, ShoppingBag, Bot, BarChart3 } from "lucide-react";
import { Button, Input, Label, Separator } from "@csa/ui";

function safeInternalPath(raw: string | null) {
  if (!raw) return "/dashboard";
  try {
    const decoded = decodeURIComponent(raw);
    return decoded.startsWith("/") && !decoded.startsWith("//") ? decoded : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

const features = [
  { icon: TicketCheck, label: "Ticket management & SLA tracking" },
  { icon: ShoppingBag, label: "Live order & cart operations" },
  { icon: Bot,         label: "AI-powered resolution suggestions" },
  { icon: BarChart3,   label: "Real-time service analytics" },
];

export function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(
    () => safeInternalPath(searchParams.get("callbackUrl")),
    [searchParams]
  );
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");
  const [isLoading, setIsLoading]       = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Invalid credentials. Please check your email and password.");
        return;
      }
      await res.json().catch(() => ({}));
      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError("Unable to reach the auth service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen overflow-hidden font-sans" style={{ background: "var(--color-bg)" }}>

      {/* ── Left — Blue brand panel ──────────────────────── */}
      <aside
        className="hidden lg:flex flex-col justify-between w-[44%] min-h-screen relative overflow-hidden px-14 py-12"
        style={{ background: "linear-gradient(160deg, var(--csa-blue-500) 0%, var(--csa-blue-700) 100%)" }}
      >
        {/* Glow blobs */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 15% 15%, rgba(245,166,36,0.12) 0%, transparent 50%), " +
              "radial-gradient(ellipse at 85% 85%, rgba(7,16,61,0.20) 0%, transparent 50%)",
          }}
        />

        {/* Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl shadow-brand flex-shrink-0"
              style={{ background: "var(--csa-yellow-500)" }}
            >
              <Sparkles size={18} style={{ color: "var(--csa-navy-950)" }} />
            </div>
            <div>
              <div className="text-white font-bold text-lg tracking-tight leading-none">
                customerSAX
              </div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
                Studio · Enterprise Platform
              </div>
            </div>
          </div>

          <h1
            className="font-extrabold text-white mb-5 leading-tight"
            style={{ fontSize: "clamp(26px, 2.8vw, 38px)", letterSpacing: "-0.03em", maxWidth: 420 }}
          >
            Unified Customer Service Operations Platform
          </h1>
          <p className="text-base mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.52)", maxWidth: 380 }}>
            Resolve every customer issue faster — with AI-assisted context, real-time commerce data, and governed actions.
          </p>

          {/* Feature list */}
          <div className="space-y-2.5">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.78)",
                }}
              >
                <Icon size={15} style={{ color: "var(--csa-yellow-500)", flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
          © 2026 customerSAX — Powered by Royal Cyber
        </p>
      </aside>

      {/* ── Right — Login form ──────────────────────────── */}
      <section className="flex flex-1 flex-col items-center justify-center px-8 py-12 bg-card">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--csa-yellow-500)" }}
            >
              <Sparkles size={16} style={{ color: "var(--csa-navy-950)" }} />
            </div>
            <span className="font-bold text-xl tracking-tight" style={{ color: "var(--color-ink)" }}>
              customerSAX
            </span>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Sign in to Studio</h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Enter your credentials to access the backoffice.
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl mb-5 text-sm font-medium"
              style={{
                background: "var(--color-error-bg)",
                border: "1px solid var(--csa-red-700)",
                color: "var(--csa-red-700)",
              }}
            >
              <span className="shrink-0 mt-0.5">⚠</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email address</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                placeholder="agent@customersax.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                error={!!error}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                <button
                  type="button"
                  className="text-xs font-medium hover:underline focus:outline-none"
                  style={{ color: "var(--color-primary)" }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  error={!!error}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit — shadcn Button, variant="default" = yellow */}
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold mt-2"
              loading={isLoading}
              disabled={isLoading}
            >
              {isLoading ? "Signing in…" : "Sign in to Studio"}
            </Button>
          </form>

          <Separator className="my-6" />

          {/* Auth0 Button */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">or continue with</span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
            </div>
            <a
              href={`/auth/login?returnTo=${encodeURIComponent(
                `/auth/complete${callbackUrl !== '/dashboard' ? `?nextUrl=${encodeURIComponent(callbackUrl)}` : ''}`
              )}`}
              className="flex items-center justify-center gap-2.5 w-full h-11 rounded-lg text-sm font-semibold transition-colors hover:bg-gray-100"
              style={{
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                textDecoration: 'none',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 132 132" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M90.3 6H41.7L26 54.6l40 29.1 40-29.1L90.3 6Z" fill="#EB5424"/>
                <path d="M26 54.6C14.3 63.3 6 76.8 6 92c0 27.6 22.4 50 50 50 13.8 0 26.3-5.6 35.4-14.6L66 98.8 26 54.6Z" fill="#EB5424" fillOpacity=".7"/>
                <path d="M106 54.6 66 98.8 91.4 127.4C100.5 118.4 106 105.9 106 92c0-15.2-8.3-28.7-20-37.4Z" fill="#EB5424" fillOpacity=".4"/>
              </svg>
              Continue with Auth0
            </a>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-muted-foreground">
            Powered by{" "}
            <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
              customerSAX Studio
            </span>{" "}
            · Enterprise Edition
          </p>
        </div>
      </section>
    </main>
  );
}
