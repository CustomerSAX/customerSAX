"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError("Invalid credentials. Please check your email and password.");
        return;
      }
      const payload = await response.json().catch(() => ({}));
      router.replace(
        payload.user?.requiresProjectSelection
          ? `/select-project?callbackUrl=${encodeURIComponent(callbackUrl)}`
          : callbackUrl
      );
      router.refresh();
    } catch {
      setError("Unable to reach the auth service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "var(--font-family)",
        background: "var(--color-bg)",
        overflow: "hidden",
      }}
    >
      {/* ── Left panel — Navy brand ─────────────────────────── */}
      <section
        style={{
          display: "none",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "45%",
          minHeight: "100vh",
          background: "linear-gradient(160deg, var(--csa-navy-900) 0%, var(--csa-navy-950) 100%)",
          padding: "48px 56px",
          position: "relative",
          overflow: "hidden",
        }}
        className="lg-flex"
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 20% 20%, rgba(245,166,36,0.08) 0%, transparent 55%), " +
              "radial-gradient(ellipse at 80% 80%, rgba(27,75,235,0.10) 0%, transparent 55%)",
            pointerEvents: "none",
          }}
        />

        {/* Brand logo */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 64 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-xl)",
                background: "var(--csa-yellow-500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--shadow-brand)",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--csa-navy-950)", lineHeight: 1 }}>C</span>
            </div>
            <div>
              <div
                style={{
                  fontSize: "var(--text-lg)",
                  fontWeight: "var(--weight-bold)",
                  color: "var(--csa-white)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                }}
              >
                customerSAX
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                Studio · Enterprise Platform
              </div>
            </div>
          </div>

          <h1
            style={{
              fontSize: "clamp(28px, 3vw, 40px)",
              fontWeight: "var(--weight-extrabold)",
              color: "var(--csa-white)",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              marginBottom: 20,
              maxWidth: 440,
            }}
          >
            Unified Customer Service Operations Platform
          </h1>
          <p
            style={{
              fontSize: "var(--text-base)",
              color: "rgba(255,255,255,0.55)",
              lineHeight: "var(--leading-relaxed)",
              maxWidth: 400,
              marginBottom: 48,
            }}
          >
            Resolve every customer issue faster — with AI-assisted context, real-time commerce data, and governed actions across all channels.
          </p>

          {/* Feature pills */}
          {[
            "🎫  Ticket management & SLA tracking",
            "🛒  Live order & cart operations",
            "🤖  AI-powered resolution suggestions",
            "📊  Real-time service analytics",
          ].map((feat) => (
            <div
              key={feat}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
                padding: "10px 16px",
                borderRadius: "var(--radius-lg)",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: "var(--text-sm)",
                color: "rgba(255,255,255,0.78)",
                fontWeight: "var(--weight-medium)",
              }}
            >
              {feat}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            fontSize: "var(--text-xs)",
            color: "rgba(255,255,255,0.28)",
          }}
        >
          © 2026 customerSAX — Powered by Royal Cyber
        </div>
      </section>

      {/* ── Right panel — Login form ────────────────────────── */}
      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 32px",
          background: "var(--color-surface-1)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Mobile-only logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 40,
              justifyContent: "center",
            }}
            className="show-mobile"
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-lg)",
                background: "var(--csa-yellow-500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 800, color: "var(--csa-navy-950)" }}>C</span>
            </div>
            <span style={{ fontSize: "var(--text-xl)", fontWeight: "var(--weight-bold)", color: "var(--color-ink)", letterSpacing: "-0.02em" }}>
              customerSAX
            </span>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: "var(--weight-bold)",
                color: "var(--color-ink)",
                letterSpacing: "-0.02em",
                marginBottom: 6,
              }}
            >
              Sign in to Studio
            </h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
              Enter your credentials to access the backoffice.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                borderRadius: "var(--radius-lg)",
                background: "var(--color-error-bg)",
                border: "1px solid var(--csa-red-700)",
                marginBottom: 20,
                fontSize: "var(--text-sm)",
                color: "var(--csa-red-700)",
                fontWeight: "var(--weight-medium)",
              }}
            >
              <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                style={{
                  display: "block",
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--weight-medium)",
                  color: "var(--color-ink-soft)",
                  marginBottom: 6,
                }}
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                placeholder="agent@customersax.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                style={{
                  width: "100%",
                  height: 42,
                  padding: "0 14px",
                  borderRadius: "var(--radius-lg)",
                  border: "1.5px solid var(--color-border)",
                  background: "var(--color-surface-1)",
                  fontSize: "var(--text-md)",
                  color: "var(--color-ink)",
                  outline: "none",
                  transition: "border-color var(--duration-fast), box-shadow var(--duration-fast)",
                  boxShadow: "var(--shadow-xs)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--color-brand)";
                  e.target.style.boxShadow = "var(--shadow-focus-brand)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--color-border)";
                  e.target.style.boxShadow = "var(--shadow-xs)";
                }}
              />
            </div>

            {/* Password */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label
                  htmlFor="login-password"
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: "var(--weight-medium)",
                    color: "var(--color-ink-soft)",
                  }}
                >
                  Password
                </label>
                <button
                  type="button"
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-primary)",
                    fontWeight: "var(--weight-medium)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 42px 0 14px",
                    borderRadius: "var(--radius-lg)",
                    border: "1.5px solid var(--color-border)",
                    background: "var(--color-surface-1)",
                    fontSize: "var(--text-md)",
                    color: "var(--color-ink)",
                    outline: "none",
                    transition: "border-color var(--duration-fast), box-shadow var(--duration-fast)",
                    boxShadow: "var(--shadow-xs)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--color-brand)";
                    e.target.style.boxShadow = "var(--shadow-focus-brand)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--color-border)";
                    e.target.style.boxShadow = "var(--shadow-xs)";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-text-muted)",
                    padding: 2,
                    fontSize: 14,
                  }}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                height: 44,
                marginTop: 8,
                borderRadius: "var(--radius-lg)",
                border: "none",
                background: isLoading ? "var(--csa-yellow-600)" : "var(--color-brand)",
                color: "var(--color-brand-text)",
                fontSize: "var(--text-base)",
                fontWeight: "var(--weight-semibold)",
                cursor: isLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "var(--shadow-brand)",
                transition: "background var(--duration-fast), box-shadow var(--duration-fast)",
                letterSpacing: "-0.01em",
              }}
            >
              {isLoading ? (
                <>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid rgba(5,8,46,0.25)",
                      borderTopColor: "var(--csa-navy-950)",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                      display: "inline-block",
                    }}
                  />
                  Signing in…
                </>
              ) : (
                "Sign in to Studio"
              )}
            </button>
          </form>

          {/* Footer */}
          <p
            style={{
              marginTop: 32,
              textAlign: "center",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-subtle)",
            }}
          >
            Powered by customerSAX Studio · Enterprise Edition
          </p>
        </div>
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 1024px) {
          .lg-flex { display: flex !important; }
          .show-mobile { display: none !important; }
        }
      `}</style>
    </main>
  );
}
