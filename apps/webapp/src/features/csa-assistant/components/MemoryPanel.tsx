'use client';

import React, { useEffect, useState } from 'react';
import { useConversationStore } from '../store/conversation-store';

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
  Positive:            { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  Neutral:             { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  'Slightly Negative': { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  Negative:            { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  Frustrated:          { color: '#b91c1c', bg: '#fff1f2', border: '#fecdd3' },
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
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
        let episodicData = data.episodicMemory ?? [];
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
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>Loading…</span>
          )}
        </div>

        {fetchState === 'error' && (
          <p style={{ fontSize: '11px', color: '#ef4444', margin: 0 }}>
            {fetchError ?? 'Failed to load past interactions.'}
          </p>
        )}

        {fetchState !== 'error' && episodic.length === 0 && fetchState !== 'loading' && (
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, lineHeight: '1.6' }}>
            {!sessionId && !customer?.id
              ? 'Past interactions appear after a customer is identified.'
              : 'No past interactions found for this customer.'}
          </p>
        )}

        {episodic.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {episodic.map((entry, idx) => (
              <div
                key={idx}
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #f3f4f6',
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
                    color: '#6b7280', letterSpacing: '0.05em',
                    backgroundColor: '#f3f4f6', padding: '1px 6px', borderRadius: '4px',
                  }}>
                    {ENTRY_TYPE_LABELS[entry.type] ?? entry.type}
                  </span>
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                    {formatEntryDate(entry.date)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#374151', lineHeight: '1.55' }}>
                  {entry.summary}
                </p>
                {(entry.intent || entry.sentiment) && (
                  <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {entry.intent && (
                      <span style={{
                        fontSize: '10px', fontWeight: 600,
                        backgroundColor: '#eef2ff', color: '#4338ca',
                        border: '1px solid #e0e7ff',
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
