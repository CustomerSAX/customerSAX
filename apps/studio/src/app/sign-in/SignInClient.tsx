'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles, TicketCheck, ShoppingBag, Bot, BarChart3 } from 'lucide-react';
import { Button, Input, Label, Separator } from '@csa/ui';
import { safeInternalAppPath } from '@/lib/safe-internal-path';

interface DiscoverClient {
  id: string;
  name: string;
  ssoProvider: 'oidc' | 'saml' | 'none';
}

function oidcStartUrl(clientId: string, callbackUrl: string, hintEmail: string): string {
  const base = `/api/sso/oidc/start?clientId=${encodeURIComponent(clientId)}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const em = hintEmail.trim().toLowerCase();
  if (!em.includes('@')) return base;
  return `${base}&loginHint=${encodeURIComponent(em)}`;
}

const features = [
  { icon: TicketCheck, label: "Ticket management & SLA tracking" },
  { icon: ShoppingBag, label: "Live order & cart operations" },
  { icon: Bot,         label: "AI-powered resolution suggestions" },
  { icon: BarChart3,   label: "Real-time service analytics" },
];

export function SignInClient() {
  const searchParams = useSearchParams();
  const errCode = searchParams.get('error');
  const nextDefault = safeInternalAppPath(searchParams.get('callbackUrl'));

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<DiscoverClient[] | null>(null);
  const [pickedId, setPickedId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!errCode) return;
    const messages: Record<string, string> = {
      idp_error: 'Your identity provider rejected the sign-in request.',
      missing_code: 'The sign-in response was incomplete. Please try again.',
      session_expired: 'Your sign-in session expired. Start again from the email step.',
      client_invalid: 'This organisation is not available for SSO.',
      discovery_failed: 'Could not contact the identity provider. Check the issuer URL in superadmin.',
      token_fetch_failed: 'Could not reach the identity provider token endpoint.',
      token_exchange_failed: 'Could not complete sign-in with the identity provider.',
      email_missing: 'The identity provider did not return an email address.',
      user_not_found: 'No CSA account matches this identity. Ask an admin to invite you first.',
      tenant_mismatch: 'Your account is not linked to the organisation you selected.',
      oidc_not_configured: 'OIDC is not enabled for this organisation.',
      client_not_found: 'Organisation not found.',
      missing_client: 'Organisation was not specified.',
      bridge_failed: 'Could not complete session handoff.',
    };
    setError(messages[errCode] ?? 'Sign-in could not be completed.');
  }, [errCode]);

  const discover = async (e: FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!em || !em.includes('@')) {
      setError('Enter a valid work email.');
      return;
    }
    setLoading(true);
    setError('');
    setClients(null);
    setPickedId('');
    try {
      const res = await fetch('/api/sso/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em }),
      });
      const data = (await res.json()) as { clients?: DiscoverClient[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not look up organisations.');
        return;
      }
      const list = data.clients ?? [];
      if (list.length === 0) {
        setError('No organisation is associated with this email. Use password sign-in or ask an admin for access.');
        return;
      }
      setClients(list);

      if (list.length === 1) {
        const only = list[0];
        if (!only) return;
        
        if (only.ssoProvider === 'none') {
          setError('This organisation uses password sign-in.');
          setTimeout(() => {
            window.location.assign(`/login${nextDefault !== '/dashboard' ? `?callbackUrl=${encodeURIComponent(nextDefault)}` : ''}`);
          }, 2000);
          return;
        }
        if (only.ssoProvider === 'saml') {
          setError('SAML sign-in is not enabled in this deployment yet. Use password login or ask your admin to configure OIDC.');
          return;
        }
        window.location.assign(oidcStartUrl(only.id, nextDefault, em));
        return;
      }
    } catch (error) {
      console.error('[sign-in]', error);
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const continuePicked = () => {
    if (!pickedId.trim()) {
      setError('Select an organisation.');
      return;
    }
    const row = clients?.find((c) => c.id === pickedId);
    if (!row) return;

    const em = email.trim().toLowerCase();
    if (row.ssoProvider === 'none') {
      setError('This organisation uses password sign-in.');
      setTimeout(() => {
        window.location.assign(`/login${nextDefault !== '/dashboard' ? `?callbackUrl=${encodeURIComponent(nextDefault)}` : ''}`);
      }, 2000);
      return;
    }
    if (row.ssoProvider === 'saml') {
      setError('SAML sign-in is not enabled yet. Choose an organisation with OIDC or use password login.');
      return;
    }
    window.location.assign(oidcStartUrl(row.id, nextDefault, em));
  };

  const showPicker = clients !== null && clients.length > 1;

  return (
    <main className="flex min-h-screen overflow-hidden font-sans" style={{ background: "var(--color-bg)" }}>
      {/* ── Left — Blue brand panel ──────────────────────── */}
      <aside
        className="hidden lg:flex flex-col justify-between w-[44%] min-h-screen relative overflow-hidden px-14 py-12"
        style={{ background: "linear-gradient(160deg, var(--csa-blue-500) 0%, var(--csa-blue-700) 100%)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 15% 15%, rgba(245,166,36,0.12) 0%, transparent 50%), " +
              "radial-gradient(ellipse at 85% 85%, rgba(7,16,61,0.20) 0%, transparent 50%)",
          }}
        />

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
                Organisation SSO Portal
              </div>
            </div>
          </div>

          <h1
            className="font-extrabold text-white mb-5 leading-tight"
            style={{ fontSize: "clamp(26px, 2.8vw, 38px)", letterSpacing: "-0.03em", maxWidth: 420 }}
          >
            Seamless Enterprise SSO Sign-in
          </h1>
          <p className="text-base mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.52)", maxWidth: 380 }}>
            Enter your work email to automatically discover your customer organisation&apos;s single sign-on provider.
          </p>

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

        <p className="relative z-10 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
          © 2026 customerSAX — Powered by Royal Cyber
        </p>
      </aside>

      {/* ── Right — Form ──────────────────────────── */}
      <section className="flex flex-1 flex-col items-center justify-center px-8 py-12 bg-card">
        <div className="w-full max-w-sm">
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

          <div className="mb-7">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Organisation sign-in</h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Enter your work email address to be directed to your company&apos;s identity provider.
            </p>
          </div>

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

          {!showPicker ? (
            <form onSubmit={discover} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="signin-email">Email address</Label>
                <Input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  error={!!error}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold mt-2"
                loading={loading}
                disabled={loading}
              >
                {loading ? "Discovering SSO…" : "Continue with SSO"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="client-pick">Select Organisation</Label>
                <select
                  id="client-pick"
                  value={pickedId}
                  onChange={(e) => setPickedId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">— Select your organisation —</option>
                  {(clients ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                className="w-full h-11 text-base font-semibold mt-2"
                onClick={continuePicked}
              >
                Continue to Company Login
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full h-11 text-base font-semibold mt-2 text-muted-foreground"
                onClick={() => { setClients(null); setPickedId(''); setError(''); }}
              >
                Use a different email
              </Button>
            </div>
          )}

          <Separator className="my-6" />

          <p className="text-center text-sm text-muted-foreground">
            <a
              href={`/login${nextDefault !== '/dashboard' ? `?callbackUrl=${encodeURIComponent(nextDefault)}` : ''}`}
              className="font-medium hover:underline"
              style={{ color: "var(--color-primary)" }}
            >
              Sign in with password instead
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
