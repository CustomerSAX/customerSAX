'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useConversationStore, type ReturnWorkflowSnapshot } from '../../store/conversation-store';
import { RESOLUTION_REASONS } from './stepper-shared/resolution-reasons';
import {
  CustomerResultList,
  StepperHeader,
  SuccessBox,
  PendingApprovalNote,
  useCustomerOrders,
  type CustomerSearchResult,
} from './stepper-shared';

const STEP_ORDER = ['order', 'reason', 'review', 'done'];

const REASON_CATEGORIES = Object.keys(RESOLUTION_REASONS) as Array<keyof typeof RESOLUTION_REASONS>;

/**
 * Local draft — order and reason stay local until the single `return.confirm`
 * action at the review step, same pattern as a ticket's draft. There is no
 * item picker: the real `start_return` tool only supports "all items on the
 * order" or a single specific `lineItemId`, and the real `get_order` result
 * has no per-line-item id to select against (see ReturnWorkflowSnapshot doc
 * comment) — so this always returns everything on the order, and the Items
 * step is a read-only summary of what that means, not a picker.
 */
export interface LocalReturnDraft {
  order: { id: string; orderNumber: string; customerName?: string } | null;
  reasonCategory: string | null;
  reason: string | null;
}

export const EMPTY_LOCAL_RETURN_DRAFT: LocalReturnDraft = {
  order: null,
  reasonCategory: null,
  reason: null,
};

interface ReturnStepperProps {
  step: string;
  setStep: (s: string) => void;
  /** Read-only, derived from the assistant's own tool-call stream — see ReturnWorkflowSnapshot. */
  workflow: ReturnWorkflowSnapshot | null;
  localDraft: LocalReturnDraft;
  setLocalDraft: (updater: (prev: LocalReturnDraft) => LocalReturnDraft) => void;
  /** Submits a structured workflow action through the real conversation — the assistant executes it, never this component. */
  onAction: (action: Record<string, unknown>) => void;
  /** True while the assistant is generating a reply — used to show a visible "working on it" state instead of going silent between a click and the result. */
  isLoading: boolean;
  onClose: () => void;
}

export function ReturnStepper({
  step,
  setStep,
  workflow,
  localDraft,
  setLocalDraft,
  onAction,
  isLoading,
  onClose,
}: ReturnStepperProps) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const { orders, isLoading: isOrdersLoading } = useCustomerOrders(selectedCustomer?.id, !!selectedCustomer);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Auto-advance the visual step to match the assistant's actual progress ──
  // Same principle as CreateOrderStepper/CreateTicketStepper: this stepper
  // never decides "the order is confirmed" or "the return is submitted"
  // itself — it just reflects what the workflow snapshot already says happened.
  // The eligibility gate lives entirely here: step 2 (reason) is only ever
  // reached once the checked order matches the selected order AND it came
  // back eligible. An ineligible result never advances the step — the rep
  // sees it on step 1 and has to pick a different order.
  const eligibilityForSelectedOrder =
    localDraft.order && workflow?.order?.id === localDraft.order.id ? workflow?.eligibility ?? null : null;
  const isCheckingEligibility = !!localDraft.order && !eligibilityForSelectedOrder;

  const lastAdvancedOrderId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const id = workflow?.order?.id;
    if (
      id &&
      id === localDraft.order?.id &&
      workflow?.eligibility?.eligible === true &&
      id !== lastAdvancedOrderId.current
    ) {
      lastAdvancedOrderId.current = id;
      setStep('reason');
    }
  }, [workflow?.order?.id, workflow?.eligibility?.eligible, localDraft.order?.id, setStep]);

  useEffect(() => {
    if (workflow?.completed && step !== 'done') setStep('done');
  }, [workflow?.completed, step, setStep]);

  useEffect(() => {
    if (workflow?.completed) setIsSubmitting(false);
  }, [workflow?.completed]);

  const selectCustomer = (c: CustomerSearchResult) => {
    setSelectedCustomer(c);
  };

  const selectOrder = (o: { id: string; orderNumber?: string }) => {
    const orderNumber = o.orderNumber || o.id;
    setLocalDraft((prev) => ({
      ...prev,
      order: { id: o.id, orderNumber, customerName: selectedCustomer?.name },
    }));
    onAction({ type: 'return.select_order', orderId: o.id, orderNumber });
    // Stays on the 'order' step — the useEffect above only advances to
    // 'reason' once this order's eligibility check comes back eligible.
  };

  const lineItems = workflow?.order?.lineItems ?? [];

  const setReason = (category: string, reason: string) => {
    setLocalDraft((prev) => ({ ...prev, reasonCategory: category, reason }));
  };

  const isReasonStepReady = () => !!localDraft.reason;

  // Clears the picked order (staying on step 1) so the order list reappears —
  // used after an ineligible result. Doesn't touch the read-only workflow
  // snapshot; it's simply superseded once a new order triggers its own check.
  const backToOrderList = () => {
    setLocalDraft((prev) => ({ ...prev, order: null, reasonCategory: null, reason: null }));
  };

  // The one and only moment this stepper submits the return/refund for real —
  // everything above is local draft editing. The assistant validates, gets
  // approval, and calls the real start_return tool via confirm_action; the
  // real confirmation comes back on workflow.completed, never fabricated here.
  // No items are sent — start_return with no lineItemId returns everything on
  // the order, which is the only thing this UI offers (see doc comment above).
  const submitReturn = () => {
    setIsSubmitting(true);
    onAction({
      type: 'return.confirm',
      orderId: localDraft.order?.id,
      orderNumber: localDraft.order?.orderNumber,
      reason: localDraft.reason,
    });
    // isSubmitting is cleared once the assistant either completes the return/
    // refund (workflow.completed appears — the auto-advance effect above
    // moves us to 'done') or the rep navigates away; there is no local
    // "success" to fabricate here.
  };

  const startNew = () => {
    setLocalDraft(() => ({ ...EMPTY_LOCAL_RETURN_DRAFT }));
    setSelectedCustomer(null);
    setCustomerSearch('');
    // The workflow snapshot's `completed` field is never cleared by the scrape
    // effect itself (it deliberately carries forward once set, so the "done"
    // screen doesn't flicker away mid-stream) — without clearing it here, the
    // auto-advance effect above sees `workflow.completed` still truthy the
    // instant this resets to 'order' and immediately flips back to 'done',
    // making this button look like it does nothing. Same pattern the
    // "Start Return"/"Process Refund" quick actions already use.
    useConversationStore.getState().setReturnWorkflow(null);
    lastAdvancedOrderId.current = undefined;
    setStep('order');
  };

  const getHeaderDetails = () => {
    switch (step) {
      case 'order':
        return {
          eyebrow: 'Step 1 of 3',
          title: 'Which order?',
          sub: 'Search for the customer, then pick the order to return or refund.',
        };
      case 'reason':
        return {
          eyebrow: 'Step 2 of 3',
          title: 'Reason',
          sub: `Order ${workflow?.order?.orderNumber || localDraft.order?.orderNumber || ''} — this returns everything on the order. Pick a reason.`,
        };
      case 'review':
        return { eyebrow: 'Step 3 of 3', title: 'Review & submit', sub: 'Last check before this is submitted for approval.' };
      case 'done':
      default:
        return { eyebrow: 'Done', title: 'Submitted', sub: '' };
    }
  };

  const header = getHeaderDetails();

  return (
    <div className="create-order-stepper-container">
      <StepperHeader
        stepDots={{
          steps: STEP_ORDER,
          visibleCount: 3,
          currentStep: step,
          activeColor: '#F97316',
          doneColor: '#7c3aed',
          // Step 0 (order) always reachable; step 1 (reason) only once the
          // selected order has actually been confirmed eligible; step 2
          // (review) only once a reason is also set. Dots can't be used to
          // skip past the eligibility gate either.
          isStepClickable: (i) =>
            step !== 'done' &&
            (i === 0 || (i === 1 && eligibilityForSelectedOrder?.eligible === true) || (i === 2 && isReasonStepReady())),
          onStepClick: setStep,
        }}
        eyebrow={header.eyebrow}
        title={header.title}
        sub={header.sub}
        onClose={onClose}
        closeTitle="Close return/refund flow"
      />

      <div className="options-body">
        {step === 'order' && (
          <>
            {!selectedCustomer ? (
              <CustomerResultList
                search={customerSearch}
                setSearch={setCustomerSearch}
                onSelect={selectCustomer}
                placeholder="Search customers by name or email..."
                autoFocus
              />
            ) : (
              <>
                <div className="opt-card selected" style={{ cursor: 'default', marginBottom: '14px' }}>
                  <div className="opt-avatar">{selectedCustomer.initials}</div>
                  <div className="opt-main">
                    <div className="opt-name">{selectedCustomer.name}</div>
                    <div className="opt-sub">{selectedCustomer.email}</div>
                  </div>
                  <span
                    className="rm"
                    style={{ cursor: 'pointer', color: '#98a2b3', fontSize: '12px' }}
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch('');
                    }}
                  >
                    Change
                  </span>
                </div>

                {!localDraft.order ? (
                  <>
                    <div className="section-label">Orders</div>
                    {isOrdersLoading ? (
                      <div className="opt-empty-state">Loading orders…</div>
                    ) : orders.length === 0 ? (
                      <div className="opt-empty-state">No orders found for this customer.</div>
                    ) : (
                      orders.map((o) => {
                        // /api/orders already returns a pre-formatted
                        // totalPrice string (e.g. "$9000.00") and a `status`
                        // field, not a raw {centAmount} Money object or
                        // `orderState` — reading those always rendered
                        // "$0.00" and a blank status for every real order.
                        const price = o.totalPrice || '$0.00';
                        const orderNo = o.orderNumber || o.id;
                        return (
                          <div key={o.id} className="opt-card" onClick={() => selectOrder(o)}>
                            <div className="opt-main">
                              <div className="opt-name">{orderNo}</div>
                              <div className="opt-sub">{price} · {o.status}</div>
                            </div>
                            <div className="opt-chevron">&rsaquo;</div>
                          </div>
                        );
                      })
                    )}
                  </>
                ) : (
                  // The eligibility gate lives here — nothing advances to the
                  // reason step until this resolves eligible. Checking and
                  // ineligible are both handled without ever leaving step 1.
                  <>
                    <div className="section-label">Selected order</div>
                    <div className="opt-card selected" style={{ cursor: 'default', marginBottom: '14px' }}>
                      <div className="opt-main">
                        <div className="opt-name">{localDraft.order.orderNumber}</div>
                      </div>
                    </div>

                    {isCheckingEligibility ? (
                      <div className="opt-empty-state">Checking return eligibility…</div>
                    ) : eligibilityForSelectedOrder && !eligibilityForSelectedOrder.eligible ? (
                      <div className="alert-banner danger">
                        <div className="alert-banner-icon">!</div>
                        <div>
                          <div className="alert-banner-title">Not eligible for a return</div>
                          <div className="alert-banner-body">
                            {eligibilityForSelectedOrder.reason || 'This order does not meet the requirements for a return.'}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </>
            )}
          </>
        )}

        {step === 'reason' && (
          <>
            <div className="section-label">This order&apos;s items (all will be returned)</div>
            {lineItems.length === 0 ? (
              <div className="opt-empty-state">Loading order items…</div>
            ) : (
              <div className="cart-box" style={{ marginBottom: '14px' }}>
                {lineItems.map((li, i) => (
                  <div key={i} className="cart-row">
                    <span className="name">{li.name || 'Item'} &times; {li.quantity}</span>
                    <span>{li.price || ''}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="section-label">Reason</div>
            {REASON_CATEGORIES.map((cat) => (
              <div key={cat} style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#98a2b3', marginBottom: '4px' }}>{cat}</div>
                <div className="chip-group">
                  {RESOLUTION_REASONS[cat].map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`chip-select ${localDraft.reason === r ? 'selected' : ''}`}
                      onClick={() => setReason(cat, r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {step === 'review' && (
          <div className="summary-card">
            <div className="summary-head">
              <b>Order {localDraft.order?.orderNumber}</b>
            </div>
            {lineItems.map((li, i) => (
              <div key={i} className="summary-row">
                <span>{li.name || 'Item'} &times; {li.quantity}</span>
              </div>
            ))}
            <div className="summary-row">
              <span className="label">Reason</span>
              <span className="value">{localDraft.reason}</span>
            </div>
            <PendingApprovalNote
              pendingApproval={workflow?.pendingApproval}
              isLoading={isLoading || isSubmitting}
              loadingLabel="Submitting…"
            />
          </div>
        )}

        {step === 'done' && (
          <SuccessBox
            title={workflow?.completed?.orderNumber ? `Order ${workflow.completed.orderNumber}` : 'Submitted'}
            sub={workflow?.completed?.summary || 'The return/refund has been recorded.'}
          />
        )}
      </div>

      {(step !== 'order' || (eligibilityForSelectedOrder && !eligibilityForSelectedOrder.eligible)) && (
        <div className="options-foot">
          {step === 'order' && eligibilityForSelectedOrder && !eligibilityForSelectedOrder.eligible && (
            <button type="button" className="btn btn-primary" onClick={backToOrderList}>
              Choose a different order
            </button>
          )}

          {step === 'reason' && (
            <button className="btn btn-primary" disabled={!isReasonStepReady()} onClick={() => setStep('review')}>
              Continue to review
            </button>
          )}

          {step === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button type="button" className="btn" onClick={() => setStep('reason')}>
                Back
              </button>
              <button type="button" className="btn btn-primary" disabled={isSubmitting || isLoading} onClick={submitReturn}>
                {isSubmitting || isLoading ? 'Submitting…' : 'Submit for approval'}
              </button>
            </div>
          )}

          {step === 'done' && (
            <button type="button" className="btn btn-primary" onClick={startNew}>
              Start another return
            </button>
          )}
        </div>
      )}
    </div>
  );
}
