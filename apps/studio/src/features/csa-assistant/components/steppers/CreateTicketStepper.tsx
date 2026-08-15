'use client';

import React, { useState, useEffect } from 'react';
import { useConversationStore, type TicketWorkflowSnapshot } from '../../store/conversation-store';
import {
  CustomerResultList,
  StepperHeader,
  SuccessBox,
  PendingApprovalNote,
  useCustomerOrders,
  type CustomerSearchResult,
} from './stepper-shared';

const STEP_ORDER = ['customer', 'classify', 'details', 'extras', 'review', 'done'];

const CONTACT_TYPES = [
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'E-Mail' },
  { id: 'chat_bot', label: 'Chat Bot' },
];

const CATEGORIES = [
  { id: 'request', label: 'Request' },
  { id: 'generalInfoChange', label: 'General Info Change' },
  { id: 'passwordReset', label: 'Password Reset' },
  { id: 'orderInquiry', label: 'Order Inquiry' },
  { id: 'paymentMethod', label: 'Payment Methods' },
  { id: 'returns', label: 'Returns' },
];

const ORDER_LINKED_CATEGORIES = ['orderInquiry', 'paymentMethod', 'returns'];

const PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
  { id: 'urgent', label: 'Urgent' },
];

/**
 * Local draft — everything the rep fills in before submission. Nothing here
 * is sent anywhere until the single `ticket.create` action at the review
 * step; a ticket has no server-side draft object being built turn by turn
 * the way a cart does, so there's nothing to keep the assistant in sync with
 * before that point.
 */
export interface LocalTicketDraft {
  customer: { id?: string; name: string; email: string } | null;
  contactType: string;
  category: string | null;
  orderNumber: string | null;
  priority: string;
  assignTo: string;
  subject: string;
  message: string;
  worklogs: Array<{ text: string; created: string }>;
}

export const EMPTY_LOCAL_TICKET_DRAFT: LocalTicketDraft = {
  customer: null,
  contactType: 'phone',
  category: null,
  orderNumber: null,
  priority: 'normal',
  assignTo: 'Unassigned (queue)',
  subject: '',
  message: '',
  worklogs: [],
};

interface CreateTicketStepperProps {
  step: string;
  setStep: (s: string) => void;
  /** Read-only, derived from the assistant's own tool-call stream — see TicketWorkflowSnapshot. */
  workflow: TicketWorkflowSnapshot | null;
  localDraft: LocalTicketDraft;
  setLocalDraft: (updater: (prev: LocalTicketDraft) => LocalTicketDraft) => void;
  /** Submits a structured workflow action through the real conversation — the assistant executes it, never this component. */
  onAction: (action: Record<string, unknown>) => void;
  /** True while the assistant is generating a reply — used to show a visible "working on it" state instead of going silent between a click and the result. */
  isLoading: boolean;
  onClose: () => void;
}

export function CreateTicketStepper({
  step,
  setStep,
  workflow,
  localDraft,
  setLocalDraft,
  onAction,
  isLoading,
  onClose,
}: CreateTicketStepperProps) {
  const [customerSearch, setCustomerSearch] = useState('');
  const { orders, isLoading: isOrdersLoading } = useCustomerOrders(
    localDraft.customer?.id,
    !!localDraft.customer && ORDER_LINKED_CATEGORIES.includes(localDraft.category || '')
  );
  const [assignees, setAssignees] = useState<string[]>(['Unassigned (queue)']);
  const [worklogInput, setWorklogInput] = useState('');
  const [worklogHistoryOpen, setWorklogHistoryOpen] = useState(true);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);

  // Real assignee list — same BFF endpoint the agent registry uses elsewhere.
  // No fabricated fallback: if this fails, the picker just offers "Unassigned".
  useEffect(() => {
    let cancelled = false;
    fetch('/api/agent-registry/users')
      .then(res => res.ok ? res.json() : { users: [] })
      .then((data: any) => {
        if (!cancelled && data && Array.isArray(data.users)) {
          const list = data.users.map((u: any) => u.email).filter(Boolean);
          setAssignees(prev => Array.from(new Set([...prev, ...list])));
        }
      })
      .catch(e => console.error('Failed to load agents list:', e));
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-advance to 'done' only once the assistant's own create_ticket call
  // has actually succeeded — never on the local click itself.
  useEffect(() => {
    if (workflow?.createdTicket && step !== 'done') setStep('done');
  }, [workflow?.createdTicket, step, setStep]);

  // Safety net: if the AI stream ends (isLoading → false) while we're still
  // waiting for a created ticket, the stream must have failed — unlock the button.
  useEffect(() => {
    if (!isLoading && isCreatingTicket && !workflow?.createdTicket) {
      setIsCreatingTicket(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const selectCustomer = (cust: CustomerSearchResult) => {
    setLocalDraft((prev) => ({ ...prev, customer: cust }));
    setStep('classify');
  };

  const getTemplate = (cat: string) => {
    const templates: Record<string, string> = {
      orderInquiry: 'Customer has a question about a recent order and needs it looked into.',
      paymentMethod: 'Customer needs help with the payment method on their account or an order.',
      returns: 'Customer is requesting a return/refund and would like confirmation on timeline.',
      request: 'Customer has a request and needs it looked into.',
      generalInfoChange: 'Customer needs help with updating their general account information.',
      passwordReset: 'Customer is requesting a password reset.'
    };
    return templates[cat] || '';
  };

  const handleCategorySelect = (cat: string) => {
    const defaultSubject = CATEGORIES.find(c => c.id === cat)?.label || cat;
    const defaultMsg = getTemplate(cat);
    setLocalDraft((prev) => ({
      ...prev,
      category: cat,
      subject: prev.subject ? prev.subject : defaultSubject,
      message: prev.message ? prev.message : defaultMsg,
      orderNumber: ORDER_LINKED_CATEGORIES.includes(cat) ? prev.orderNumber : null
    }));
  };

  const addWorklog = () => {
    const text = worklogInput.trim();
    if (!text) return;
    setLocalDraft((prev) => ({
      ...prev,
      worklogs: [...prev.worklogs, { text, created: new Date().toISOString() }]
    }));
    setWorklogInput('');
  };

  const removeWorklog = (idx: number) => {
    setLocalDraft((prev) => ({
      ...prev,
      worklogs: prev.worklogs.filter((_, i) => i !== idx)
    }));
  };

  const isClassifyStepReady = () => {
    const hasCategory = !!localDraft.category;
    const hasPriority = !!localDraft.priority;
    const hasContact = !!localDraft.contactType;
    const isOrderOk = !ORDER_LINKED_CATEGORIES.includes(localDraft.category || '') || !!localDraft.orderNumber;
    return hasCategory && hasPriority && hasContact && isOrderOk;
  };

  // The one and only moment this stepper talks to the assistant — everything
  // above is local draft editing. The assistant validates, gets approval, and
  // calls the real create_ticket tool; the real ticketNumber comes back on
  // workflow.createdTicket, never fabricated here.
  const createTicket = () => {
    setIsCreatingTicket(true);
    onAction({
      type: 'ticket.create',
      customerId: localDraft.customer?.id,
      customerName: localDraft.customer?.name,
      email: localDraft.customer?.email,
      contactType: localDraft.contactType,
      category: localDraft.category,
      priority: localDraft.priority,
      assignTo: localDraft.assignTo === 'Unassigned (queue)' ? undefined : localDraft.assignTo,
      orderNumber: localDraft.orderNumber || undefined,
      subject: localDraft.subject,
      message: localDraft.message,
      worklog: localDraft.worklogs.length > 0 ? localDraft.worklogs.map(w => w.text).join('\n') : undefined,
    });
    // isCreatingTicket is cleared once the assistant either creates the ticket
    // (workflow.createdTicket appears — the auto-advance effect above moves
    // us to 'done') or the rep navigates away; there is no local "success" to
    // fabricate here.
  };

  const getStepNumberText = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < 5) return `Step ${idx + 1} of 5`;
    return 'Done';
  };

  const getStepTitleText = () => {
    switch (step) {
      case 'customer': return 'Who is this ticket for?';
      case 'classify': return 'Classify this ticket';
      case 'details': return 'Subject & message';
      case 'extras': return 'Worklog';
      case 'review': return 'Review & create ticket';
      case 'done': return 'Ticket created';
      default: return '';
    }
  };

  const getStepSubText = () => {
    switch (step) {
      case 'customer': return 'Pick a customer to create a ticket.';
      case 'classify': return 'Category and priority drive routing and notifications.';
      case 'details': return 'Drafted from classification — edit freely before continuing.';
      case 'extras': return 'Optional — skip if there is nothing to log.';
      case 'review': return 'Last check before this ticket is created.';
      default: return '';
    }
  };

  // Resets the local draft and returns to step 1 — mirrors CreateOrderStepper's
  // startNew. Purely local; nothing to tell the assistant since a fresh draft
  // has no server-side counterpart to reset.
  //
  // workflow.createdTicket is deliberately never cleared by the scrape effect
  // (same as returnWorkflow.completed) — without clearing it here, the
  // auto-advance effect above sees it's still truthy the instant this resets
  // to 'customer' and immediately flips back to 'done', making this button
  // look like it does nothing (same bug fixed for ReturnStepper's "Start
  // another return").
  const startNew = () => {
    setLocalDraft(() => ({ ...EMPTY_LOCAL_TICKET_DRAFT }));
    useConversationStore.getState().setTicketWorkflow(null);
    setStep('customer');
  };

  return (
    <div className="create-order-stepper-container create-ticket-stepper-container">
      <StepperHeader
        stepDots={{
          steps: STEP_ORDER,
          visibleCount: 5,
          currentStep: step,
          activeColor: 'var(--color-primary)',
          doneColor: 'var(--color-success)',
          isStepClickable: (i) => (i === 0 || !!localDraft.customer) && step !== 'done',
          onStepClick: setStep,
        }}
        eyebrow={getStepNumberText()}
        title={getStepTitleText()}
        sub={getStepSubText()}
        onClose={onClose}
        closeTitle="Close ticket flow"
      />

      <div className="options-body">
        {step === 'customer' && (
          <CustomerResultList
            search={customerSearch}
            setSearch={setCustomerSearch}
            onSelect={selectCustomer}
            placeholder="Search customers..."
            emptyBeforeTyping="Type at least 3 characters to search."
            noMatches={() => 'No matches yet — keep typing.'}
          />
        )}

        {step === 'classify' && (
          <>
            <div className="section-label">Contact type</div>
            <div className="chip-group">
              {CONTACT_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`chip-select ${localDraft.contactType === t.id ? 'selected' : ''}`}
                  onClick={() => setLocalDraft((prev) => ({ ...prev, contactType: t.id }))}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="section-label">Ticket category</div>
            <div className="chip-group">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip-select ${localDraft.category === c.id ? 'selected' : ''}`}
                  onClick={() => handleCategorySelect(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {ORDER_LINKED_CATEGORIES.includes(localDraft.category || '') && (
              <>
                <div className="section-label">Order number</div>
                {localDraft.orderNumber ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="order-chip">
                      {localDraft.orderNumber}
                      <span className="rm" onClick={() => setLocalDraft((prev) => ({ ...prev, orderNumber: null }))}>&times;</span>
                    </div>
                  </div>
                ) : isOrdersLoading ? (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '12.5px' }}>Loading eligible orders...</div>
                ) : orders.length > 0 ? (
                  orders.map(o => {
                    // /api/orders already returns a pre-formatted totalPrice
                    // string (e.g. "$9000.00") and a `status` field, not a
                    // raw {centAmount} Money object or `orderState` — reading
                    // those always rendered "$0.00 ·" with nothing after the
                    // dot for every real order (same bug already fixed in
                    // ReturnStepper's order list).
                    const price = o.totalPrice || '$0.00';
                    const orderNo = o.orderNumber || o.id;
                    return (
                      <div key={o.id} className="opt-card" onClick={() => setLocalDraft((prev) => ({ ...prev, orderNumber: orderNo }))}>
                        <div className="opt-main">
                          <div className="opt-name">{orderNo}</div>
                          <div className="opt-sub">{price} · {o.status}</div>
                        </div>
                        <div className="opt-chevron">&rsaquo;</div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: 'var(--color-text-subtle)', fontSize: '12.5px', padding: '4px 0' }}>No recent orders found for this customer.</div>
                )}
              </>
            )}

            <div className="section-label">Priority</div>
            <div className="chip-group">
              {PRIORITIES.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip-select pri-${p.id.toLowerCase()} ${localDraft.priority === p.id ? 'selected' : ''}`}
                  onClick={() => setLocalDraft((prev) => ({ ...prev, priority: p.id }))}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="section-label">Assign to</div>
            <div className="chip-group">
              {assignees.map(a => (
                <button
                  key={a}
                  type="button"
                  className={`chip-select ${localDraft.assignTo === a ? 'selected' : ''}`}
                  onClick={() => setLocalDraft((prev) => ({ ...prev, assignTo: a }))}
                >
                  {a}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'details' && (
          <>
            <div className="field-block">
              <label className="field-label">Subject</label>
              <input
                className="input"
                value={localDraft.subject}
                onChange={e => setLocalDraft((prev) => ({ ...prev, subject: e.target.value }))}
              />
            </div>
            <div className="field-block">
              <label className="field-label">Message</label>
              <textarea
                className="input"
                style={{ resize: 'vertical', minHeight: '120px' }}
                value={localDraft.message}
                onChange={e => setLocalDraft((prev) => ({ ...prev, message: e.target.value }))}
              />
            </div>
          </>
        )}

        {step === 'extras' && (
          <>
            <div className="section-label">Worklog</div>
            <div className="worklog-row">
              <input
                className="input"
                placeholder="Add a note about this call..."
                value={worklogInput}
                onChange={e => setWorklogInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addWorklog()}
              />
              <button type="button" className="btn" style={{ width: 'auto', padding: '9px 16px' }} onClick={addWorklog}>Add</button>
            </div>
            <div className="worklog-toggle" onClick={() => setWorklogHistoryOpen(!worklogHistoryOpen)}>
              {worklogHistoryOpen ? '▼' : '▶'} Worklog History
            </div>
            {worklogHistoryOpen && (
              <div className="worklog-table-wrap">
                <table className="worklog-table">
                  <thead>
                    <tr>
                      <th>Worklog</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {localDraft.worklogs.length > 0 ? (
                      localDraft.worklogs.map((w, idx) => (
                        <tr key={idx}>
                          <td className="text">{w.text}</td>
                          <td>{new Date(w.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <span className="rm" style={{ cursor: 'pointer', color: 'var(--color-text-subtle)' }} onClick={() => removeWorklog(idx)}>Remove</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-subtle)', padding: '12px' }}>No worklog entries yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {step === 'review' && (
          <div className="summary-card">
            <div className="summary-head">
              <b>{localDraft.customer?.name}</b>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginLeft: '6px' }}>
                {localDraft.customer?.email}
              </span>
            </div>
            <div className="summary-row">
              <span className="label">Contact type</span>
              <span className="value">{CONTACT_TYPES.find(t => t.id === localDraft.contactType)?.label || localDraft.contactType}</span>
            </div>
            <div className="summary-row">
              <span className="label">Category</span>
              <span className="value">{CATEGORIES.find(c => c.id === localDraft.category)?.label || localDraft.category}</span>
            </div>
            {localDraft.orderNumber && (
              <div className="summary-row">
                <span className="label">Order number</span>
                <span className="value">{localDraft.orderNumber}</span>
              </div>
            )}
            <div className="summary-row">
              <span className="label">Priority</span>
              <span className="value">{PRIORITIES.find(p => p.id === localDraft.priority)?.label || localDraft.priority}</span>
            </div>
            <div className="summary-row">
              <span className="label">Assigned to</span>
              <span className="value">{localDraft.assignTo}</span>
            </div>
            <div className="summary-row">
              <span className="label">Worklog entries</span>
              <span className="value">{localDraft.worklogs.length}</span>
            </div>
            <div className="summary-msg">
              <span className="label">Subject</span>
              {localDraft.subject}
            </div>
            <div className="summary-msg">
              <span className="label">Message</span>
              {localDraft.message}
            </div>
            <PendingApprovalNote
              pendingApproval={workflow?.pendingApproval}
              isLoading={isLoading || isCreatingTicket}
              pendingLabel={(action) => `${action || 'Creating this ticket'} needs confirming in the chat before it's created.`}
              loadingLabel="Creating the ticket…"
              marginTop="10px"
            />
          </div>
        )}

        {step === 'done' && (
          <SuccessBox
            title={workflow?.createdTicket?.ticketNumber || 'Ticket created'}
            sub={`Created for ${localDraft.customer?.name} — visible in Tickets dashboard.`}
          />
        )}
      </div>

      <div className="options-foot">
        {step === 'classify' && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isClassifyStepReady()}
            onClick={() => setStep('details')}
          >
            Continue to subject &amp; message
          </button>
        )}

        {step === 'details' && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!localDraft.subject.trim() || !localDraft.message.trim()}
            onClick={() => setStep('extras')}
          >
            Continue
          </button>
        )}

        {step === 'extras' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setStep('review')}
          >
            Continue to review
          </button>
        )}

        {step === 'review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setStep('extras')}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isCreatingTicket || isLoading}
              onClick={createTicket}
            >
              {isCreatingTicket || isLoading ? 'Creating ticket...' : 'Create ticket'}
            </button>
          </div>
        )}

        {step === 'done' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={startNew}
          >
            Create another ticket
          </button>
        )}
      </div>
    </div>
  );
}
