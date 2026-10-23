/**
 * Voice widget tenants — which merchant sites may embed the public voice agent,
 * and which commerce project each one talks to.
 *
 * The widget is public (shoppers, not reps), so nothing identity-shaped is ever
 * taken from the browser. The page only sends an opaque `widgetKey`; this module
 * maps it to the tenant's real projectKey/clientId and checks the request's
 * Origin against that tenant's allowlist.
 *
 * Phase 1 configuration is the `VOICE_WIDGET_TENANTS` env var, a JSON object
 * keyed by widget key:
 *
 *   {
 *     "<widgetKey, ≥16 chars>": {
 *       "projectKey": "my-project",
 *       "clientId": "optional-tenant-id",
 *       "allowedOrigins": ["https://shop.example.com"],
 *       "serviceEmail": "voice-agent@example.com",
 *       "brandName": "Example Store",
 *       "lang": "en-US",
 *       "knowledgeBase": false
 *     }
 *   }
 */

import { z } from "zod";
import { createLogger } from "@csa/logger";

const log = createLogger("ai-assist").child({ module: "voice/tenants" });

const tenantSchema = z.object({
  projectKey: z.string().min(1),
  clientId: z.string().min(1).optional(),
  allowedOrigins: z.array(z.string().url()).min(1),
  /** Identity the voice agent acts as toward the BFF and authors handoff notes with. */
  serviceEmail: z.string().email(),
  /** Spoken in the greeting. Omitted → a greeting with no brand name. */
  brandName: z.string().min(1).optional(),
  /** BCP-47 language for browser speech recognition and synthesis. */
  lang: z.string().min(2).default("en-US"),
  /** Expose the knowledge base to callers. Off by default — the KB is written for reps. */
  knowledgeBase: z.boolean().default(false)
});

export type VoiceTenant = z.infer<typeof tenantSchema> & { widgetKey: string };

const tenantsSchema = z.record(z.string().min(16), tenantSchema);

let cached: { raw: string | undefined; tenants: Map<string, VoiceTenant> } | null = null;

function loadTenants(): Map<string, VoiceTenant> {
  const raw = process.env.VOICE_WIDGET_TENANTS?.trim() || undefined;
  if (cached && cached.raw === raw) return cached.tenants;

  const tenants = new Map<string, VoiceTenant>();
  if (raw) {
    try {
      const parsed = tenantsSchema.parse(JSON.parse(raw));
      for (const [widgetKey, tenant] of Object.entries(parsed)) {
        tenants.set(widgetKey, {
          ...tenant,
          allowedOrigins: tenant.allowedOrigins.map(normalizeOrigin).filter((o): o is string => o !== null),
          widgetKey
        });
      }
    } catch (err) {
      // Fail closed: a malformed config enables no tenants rather than a partial set.
      log.error("VOICE_WIDGET_TENANTS is invalid — voice widget disabled", err);
    }
  }
  cached = { raw, tenants };
  return tenants;
}

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export type TenantResolution =
  | { ok: true; tenant: VoiceTenant }
  | { ok: false; status: 403; reason: "unknown_widget" | "origin_not_allowed" };

/** Resolves a widget key and verifies the request Origin is on that tenant's allowlist. */
export function resolveTenant(widgetKey: string | undefined, origin: string | undefined): TenantResolution {
  const tenant = widgetKey ? loadTenants().get(widgetKey) : undefined;
  if (!tenant) return { ok: false, status: 403, reason: "unknown_widget" };
  const normalized = normalizeOrigin(origin);
  if (!normalized || !tenant.allowedOrigins.includes(normalized)) {
    return { ok: false, status: 403, reason: "origin_not_allowed" };
  }
  return { ok: true, tenant };
}

/** True when `origin` is allowed by at least one tenant — used to answer CORS preflights. */
export function isKnownOrigin(origin: string | undefined): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  for (const tenant of loadTenants().values()) {
    if (tenant.allowedOrigins.includes(normalized)) return true;
  }
  return false;
}
