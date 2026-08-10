'use client';

import React from 'react';

export interface PendingApprovalNoteProps {
  pendingApproval?: { action?: string; summary?: string } | null;
  isLoading: boolean;
  /** Receives the raw (possibly undefined) action name — apply your own fallback wording here. */
  pendingLabel?: (action: string | undefined) => string;
  loadingLabel?: string;
  marginTop?: string;
}

/**
 * Shared inline status note: "waiting for approval" when the workflow
 * snapshot has a pendingApproval, or "working on it" while the assistant is
 * generating a reply. Renders nothing otherwise. Styled as the same info
 * alert-banner used elsewhere (icon + title + body) rather than a stray
 * line of gray text, so it reads clearly wherever it's used.
 */
export function PendingApprovalNote({
  pendingApproval,
  isLoading,
  pendingLabel = (action) => `${action || 'This change'} needs your confirmation in the chat before it applies.`,
  loadingLabel = 'Working on it…',
  marginTop = '8px',
}: PendingApprovalNoteProps) {
  if (pendingApproval) {
    return (
      <div className="alert-banner info" style={{ marginTop }}>
        <div className="alert-banner-icon">⏳</div>
        <div>
          <div className="alert-banner-title">Waiting for your approval</div>
          <div className="alert-banner-body">{pendingLabel(pendingApproval.action)}</div>
        </div>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="alert-banner info" style={{ marginTop }}>
        <div className="alert-banner-icon spinner" />
        <div>
          <div className="alert-banner-title">{loadingLabel}</div>
        </div>
      </div>
    );
  }
  return null;
}
