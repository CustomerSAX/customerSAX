'use client';

import { useEffect, useState } from 'react';
import { useConversationStore } from '../store/conversation-store';
import { formatDate } from '@/lib/format-date';

interface EpisodicEntry {
  type: 'session_summary' | 'ticket_resolution' | 'customer_interaction';
  date: string;
  summary: string;
  intent?: string;
  sentiment?: string;
}

interface MemoryPanelProps {
  /** Active chat session ID — used to fetch Redis working memory. */
  sessionId: string | null;
}

/** Colour tokens for sentiment labels (shared with Sidebar). */
const SENTIMENT_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  Positive:            { color: 'var(--color-success)', bg: 'var(--color-success-bg)', border: 'var(--color-success)' },
  Neutral:             { color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)', border: 'var(--color-border)' },
  'Slightly Negative': { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', border: 'var(--color-warning)' },
  Negative:            { color: 'var(--color-error)', bg: 'var(--color-error-bg)', border: 'var(--color-error)' },
  Frustrated:          { color: 'var(--color-error)', bg: 'var(--color-error-bg)', border: 'var(--color-error)' },
};

/** Formats an ISO date as a human-readable relative or absolute string. */
function formatEntryDate(date: Date | string): string {
  try {
    const d      = new Date(date);
    const diffMs = Date.now() - d.getTime();
    const diffH  = Math.floor(diffMs / 3_600_000);
    if (diffH < 1)  return 'Just now';
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'Yesterday';
    if (diffD < 7)   return `${diffD} days ago`;
    return formatDate(d);
  } catch {
    return '';
  }
}

/** Entry type label map for the badge. */
const ENTRY_TYPE_LABELS: Record<EpisodicEntry['type'], string> = {
  session_summary:      'Session',
  ticket_resolution:    'Resolved',
  customer_interaction: 'Interaction',
};

/** Response shape returned by GET /api/memory. */
interface MemoryApiResponse {
  workingMemory: {
    activeGoal?:       string | null;
    currentIntent?:    string | null;
    currentSentiment?: string | null;
    currentStrategy?:  string | null;
    nextSteps?:        string[];
    lastUpdated?:      string | null;
  } | null;
  episodicMemory: EpisodicEntry[];
}

export function MemoryPanel({ sessionId }: MemoryPanelProps) {
  const customer  = useConversationStore((s) => s.customer);

  const [episodic,   setEpisodic]   = useState<EpisodicEntry[]>([]);
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId && !customer?.id) {
      setTimeout(() => setFetchState('idle'), 0);
      return;
    }

    setFetchState('loading');
    setFetchError(null);

    const abortController = new AbortController();
    const params = new URLSearchParams();
    if (sessionId)   params.set('sessionId',  sessionId);
    if (customer?.id) params.set('customerId', customer.id);
    if (customer?.name) params.set('customerName', customer.name);
    if (customer?.email) params.set('customerEmail', customer.email);

    fetch(`/api/memory?${params.toString()}`, { signal: abortController.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MemoryApiResponse>;
      })
      .then((data) => {
        if (abortController.signal.aborted) return;
        const episodicData = data.episodicMemory ?? [];
        setEpisodic(episodicData);
        setFetchState('done');
      })
      .catch((err: Error) => {
        if (abortController.signal.aborted) return;
        setFetchError(err.message);
        setFetchState('error');
      });
      
    return () => abortController.abort();
  }, [sessionId, customer?.id, customer?.email, customer?.name]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section>
        <div className="sb-section-header" style={{ marginBottom: '10px' }}>
          <h2 className="sb-section-title">Past Interactions</h2>
          {fetchState === 'loading' && (
            <span style={{ fontSize: '10px', color: 'var(--color-text-subtle)' }}>Loading…</span>
          )}
        </div>

        {fetchState === 'error' && (
          <p style={{ fontSize: '11px', color: 'var(--color-error)', margin: 0 }}>
            {fetchError ?? 'Failed to load past interactions.'}
          </p>
        )}

        {fetchState !== 'error' && episodic.length === 0 && fetchState !== 'loading' && (
          <p style={{ fontSize: '12px', color: 'var(--color-text-subtle)', margin: 0, lineHeight: '1.6' }}>
            {!sessionId && !customer?.id
              ? 'Past interactions appear after a customer is identified.'
              : 'No past interactions found for this customer.'}
          </p>
        )}

        {episodic.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            {episodic.map((entry, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 2px',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
                    color: 'var(--color-text-muted)', letterSpacing: '0.05em',
                    backgroundColor: 'var(--color-surface-3)', padding: '1px 6px', borderRadius: '4px',
                  }}>
                    {ENTRY_TYPE_LABELS[entry.type] ?? entry.type}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-subtle)' }}>
                    {formatEntryDate(entry.date)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-ink-soft)', lineHeight: '1.55' }}>
                  {entry.summary}
                </p>
                {(entry.intent || entry.sentiment) && (
                  <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {entry.intent && (
                      <span style={{
                        fontSize: '10px', fontWeight: 600,
                        backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)',
                        border: '1px solid var(--color-primary-border)',
                        padding: '1px 6px', borderRadius: '999px',
                        textTransform: 'capitalize',
                      }}>
                        {entry.intent.replace(/_/g, ' ')}
                      </span>
                    )}
                    {entry.sentiment && (
                      <span style={{
                        fontSize: '10px', fontWeight: 600,
                        backgroundColor: (SENTIMENT_COLORS[entry.sentiment] ?? SENTIMENT_COLORS['Neutral']).bg,
                        color: (SENTIMENT_COLORS[entry.sentiment] ?? SENTIMENT_COLORS['Neutral']).color,
                        border: `1px solid ${(SENTIMENT_COLORS[entry.sentiment] ?? SENTIMENT_COLORS['Neutral']).border}`,
                        padding: '1px 6px', borderRadius: '999px',
                      }}>
                        {entry.sentiment}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
