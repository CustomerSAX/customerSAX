'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDateTime, formatTime as formatSharedTime } from '@/lib/format-date';

interface SessionSummary {
  sessionId: string;
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  pageContext: { type: string; id: string } | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

function dateGroup(iso: string): string {
  const date = new Date(iso);
  const now  = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <  7) return 'This week';
  if (diffDays < 30) return 'This month';
  return 'Older';
}

function formatTime(iso: string): string {
  return formatSharedTime(iso);
}

function formatFullDate(iso: string): string {
  return formatDateTime(iso);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\[Conversation summary[^\]]*\]\n?/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

function groupSessions(
  sessions: SessionSummary[],
): Array<{ label: string; items: SessionSummary[] }> {
  const map = new Map<string, SessionSummary[]>();
  const ORDER = ['Today', 'Yesterday', 'This week', 'This month', 'Older'];

  for (const s of sessions) {
    const label = dateGroup(s.updatedAt);
    const bucket = map.get(label) ?? [];
    bucket.push(s);
    map.set(label, bucket);
  }

  return ORDER.filter((l) => map.has(l)).map((label) => ({
    label,
    items: map.get(label)!,
  }));
}

interface ChatHistoryProps {
  onContinue?: (sessionId: string, pageContext: { type: string; id: string } | null) => void;
}

export function ChatHistory({ onContinue }: ChatHistoryProps) {
  const [sessions, setSessions]   = useState<SessionSummary[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [activeSession, setActiveSession] = useState<SessionSummary | null>(null);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/chat/sessions?limit=40');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sessions: SessionSummary[]; total: number };
      setSessions(data.sessions ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchSessions(); }, [fetchSessions]);

  const openSession = useCallback(async (s: SessionSummary) => {
    setActiveSession(s);
    setDetailLoading(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/chat?sessionId=${encodeURIComponent(s.sessionId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { messages: ChatMessage[] };
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const goBack = useCallback(() => {
    setActiveSession(null);
    setMessages([]);
  }, []);

  const spinnerElement = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px 0', color: 'var(--color-text-subtle)' }}>
      <div style={{
        width: '22px', height: '22px',
        border: '2px solid var(--color-border)', borderTopColor: 'var(--color-text-muted)',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: '12px' }}>{activeSession ? 'Loading conversation…' : 'Loading history…'}</span>
    </div>
  );

  if (activeSession) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <button
            onClick={goBack}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-primary)', padding: '0',
              fontSize: '12px', fontWeight: 600,
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to history
          </button>
          {onContinue && (
            <button
              onClick={() => onContinue(activeSession.sessionId, activeSession.pageContext)}
              title="Resume this conversation in the chat window"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: 'var(--color-primary)', color: 'var(--color-text-inverse)', border: 'none',
                borderRadius: '6px', padding: '6px 12px', cursor: 'pointer',
                fontSize: '11px', fontWeight: 600,
              }}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Continue this conversation
            </button>
          )}
        </div>

        <div style={{
          fontSize: '11px', color: 'var(--color-text-muted)',
          borderBottom: '1px solid var(--color-border)', paddingBottom: '10px', marginBottom: '12px',
        }}>
          {formatFullDate(activeSession.createdAt)}
          <span style={{ marginLeft: '8px', color: 'var(--color-text-subtle)' }}>·</span>
          <span style={{ marginLeft: '8px' }}>
            {activeSession.messageCount} {activeSession.messageCount === 1 ? 'message' : 'messages'}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '2px' }}>
          {detailLoading ? spinnerElement : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-subtle)', fontSize: '12px', padding: '24px 0' }}>
              No messages found for this session.
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isAgent   = msg.role === 'user';
              const isSummary = msg.content.startsWith('[Conversation summary');

              if (isSummary) {
                const summaryBody = msg.content.replace(/^\[Conversation summary[^\]]*\]\n?/, '');
                return (
                  <div key={idx} style={{
                    backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)',
                    borderRadius: '8px', padding: '10px 12px',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      fontSize: '11px', fontWeight: 700, color: 'var(--color-warning)', marginBottom: '5px',
                    }}>
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Earlier part of this conversation (summarised)
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-warning)', lineHeight: '1.6' }}>
                      {summaryBody}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isAgent ? 'flex-end' : 'flex-start',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {!isAgent && (
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '50%',
                        backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <svg width="10" height="10" fill="none" viewBox="0 0 20 20">
                          <path d="M10 1C10.8 5.5 12.5 7.5 18 10C12.5 12.5 10.8 14.5 10 19C9.2 14.5 7.5 12.5 2 10C7.5 7.5 9.2 5.5 10 1Z" fill="var(--color-primary)" />
                        </svg>
                      </div>
                    )}
                    <span style={{
                      fontSize: '10px', fontWeight: 600,
                      color: isAgent ? 'var(--color-primary)' : 'var(--color-ink-soft)',
                    }}>
                      {isAgent ? 'You' : 'AI Assistant'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-subtle)' }}>
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>

                  <div style={{
                    maxWidth: '88%',
                    padding: '9px 13px',
                    borderRadius: isAgent ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    backgroundColor: isAgent ? 'var(--color-primary)' : 'var(--color-surface-3)',
                    color: isAgent ? 'var(--color-text-inverse)' : 'var(--color-ink)',
                    fontSize: '12px',
                    lineHeight: '1.65',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const groups = groupSessions(sessions);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          {loading ? '' : total > 0 ? `${total} conversation${total !== 1 ? 's' : ''}` : 'No conversations yet'}
        </span>
        <button
          onClick={() => void fetchSessions()}
          title="Refresh"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-subtle)', padding: '2px', display: 'flex', alignItems: 'center',
          }}
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {loading ? spinnerElement : error ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ fontSize: '12px', color: 'var(--color-error)', marginBottom: '8px' }}>Could not load history</p>
          <button
            onClick={() => void fetchSessions()}
            style={{
              fontSize: '12px', color: 'var(--color-primary)', background: 'none',
              border: 'none', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Try again
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-subtle)' }}>
          <svg
            width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            style={{ margin: '0 auto 10px', display: 'block' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-soft)', margin: '0 0 4px' }}>
            No conversations yet
          </p>
          <span style={{ fontSize: '11px' }}>
            Your chat history will appear here after your first AI session.
          </span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {groups.map(({ label, items }) => (
            <div key={label}>
              <div style={{
                fontSize: '10px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--color-text-subtle)', marginBottom: '8px',
              }}>
                {label}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.map((s) => {
                  const preview  = stripMarkdown(s.preview ?? '').slice(0, 70) || 'No preview available';
                  const hasMore  = stripMarkdown(s.preview ?? '').length > 70;
                  const ctxLabel = s.pageContext?.type
                    ?.replace(/_/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase());

                  return (
                    <button
                      key={s.sessionId}
                      onClick={() => void openSession(s)}
                      style={{
                        width: '100%', textAlign: 'left',
                        background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                        borderRadius: '10px', padding: '11px 13px',
                        cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--color-primary-light)';
                        e.currentTarget.style.borderColor = 'var(--color-primary-border)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--color-surface-2)';
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '5px' }}>
                        <span style={{
                          fontSize: '12px', fontWeight: 500, color: 'var(--color-ink)',
                          flex: 1, lineHeight: '1.4',
                        }}>
                          {preview}{hasMore ? '…' : ''}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-subtle)', flexShrink: 0, paddingTop: '1px' }}>
                          {formatTime(s.updatedAt)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="var(--color-text-subtle)" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-subtle)' }}>
                          {s.messageCount} {s.messageCount === 1 ? 'message' : 'messages'}
                        </span>
                        {ctxLabel && (
                          <>
                            <span style={{ color: 'var(--color-border)', fontSize: '10px' }}>·</span>
                            <span style={{
                              fontSize: '10px', color: 'var(--color-text-muted)',
                              backgroundColor: 'var(--color-primary-light)', border: '1px solid var(--color-primary-border)',
                              padding: '1px 6px', borderRadius: '4px',
                            }}>
                              {ctxLabel}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
