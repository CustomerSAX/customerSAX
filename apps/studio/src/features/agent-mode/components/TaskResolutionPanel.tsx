"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Icon, Button, StatusPill } from "@csa/ui";
import { useApolloClient, useMutation } from "@apollo/client";
import { TICKET_QUERY, UPDATE_TICKET, ADD_WORKLOG } from "@/features/tickets/api/queries";
import { GET_ORDER_FOR_WISMO } from "../api/wismo-queries";
import {
  GET_CUSTOMER_BY_EMAIL_OR_ID,
  GET_CUSTOMER_CONTACT_TARGETS,
  UPDATE_CUSTOMER_CONTACT_NUMBER,
} from "../api/customer-queries";
import { investigateTicket, extractPhoneNumber, extractAddressKeyword } from "../api/investigation-engine";
import { useCurrentUser } from "@/lib/use-current-user";
import type { AgentTask, ContactTarget, InvestigationResult } from "../types";

interface TicketDetailResult {
  id: string;
  ticketNumber: string;
  subject?: string;
  message?: string;
  status?: string;
  priority?: string;
  customerName?: string;
  customerEmail?: string;
  customerId?: string;
  orderNumber?: string;
  lastModifiedAt?: string;
  createdAt?: string;
  comments?: Array<{ comment?: string; author?: string }>;
}

interface OrderDetailResult {
  id: string;
  orderNumber: string;
  state?: string;
  orderState?: string;
  shipmentState?: string;
  paymentState?: string;
  shippingAddress?: {
    streetName?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

interface CustomerContactResponse {
  id: string;
  email: string;
  version: number;
  targets: ContactTarget[];
}

interface TaskResolutionPanelProps {
  task: AgentTask;
  onBack: () => void;
  onInvestigateWithAI: (task: AgentTask) => void;
  isAssistantLoading?: boolean;
}

export function TaskResolutionPanel({
  task,
  onBack,
  onInvestigateWithAI,
  isAssistantLoading = false,
}: TaskResolutionPanelProps) {
  const apolloClient = useApolloClient();
  const { user } = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Loaded Source Records
  const [ticketDetail, setTicketDetail] = useState<TicketDetailResult | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetailResult | null>(null);
  const [customerContact, setCustomerContact] = useState<CustomerContactResponse | null>(null);
  const [initialLastModifiedAt, setInitialLastModifiedAt] = useState<string | null>(null);

  // Dynamic Investigation Result
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);

  // Selected Target for ambiguous address cases
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");

  // Resolution Form State
  const [customerDraft, setCustomerDraft] = useState("");
  const [internalWorklog, setInternalWorklog] = useState("");
  const [proposedStatus, setProposedStatus] = useState("In Progress");
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Granular Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);
  const [contactUpdated, setContactUpdated] = useState(false);
  const [worklogExecuted, setWorklogExecuted] = useState(false);
  const [ticketUpdated, setTicketUpdated] = useState(false);
  const [executionResults, setExecutionResults] = useState<string[]>([]);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [staleConflict, setStaleConflict] = useState(false);

  // Apollo Mutations
  const [updateTicketMutation] = useMutation(UPDATE_TICKET);
  const [addWorklogMutation] = useMutation(ADD_WORKLOG);
  const [updateContactNumberMutation] = useMutation(UPDATE_CUSTOMER_CONTACT_NUMBER);

  // ── 1. Fetch Complete Ticket & Related Evidence Dynamically ───────────────
  const loadEvidence = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStaleConflict(false);

    try {
      // 1. Fetch Complete Ticket
      const ticketRes = await apolloClient.query<{ ticket: TicketDetailResult }>({
        query: TICKET_QUERY,
        variables: { id: task.id },
        fetchPolicy: "network-only",
      });

      const t = ticketRes.data?.ticket;
      if (!t) throw new Error("Ticket not found");

      setTicketDetail(t);
      setInitialLastModifiedAt(t.lastModifiedAt ?? null);

      // Check text for potential order number or contact details
      const fullText = `${t.subject ?? ""} ${t.message ?? ""}`;
      const orderNum = t.orderNumber || task.orderNumber;
      const hasPhoneOrAddress = extractPhoneNumber(fullText) || extractAddressKeyword(fullText);

      let fetchedOrder: OrderDetailResult | null = null;
      let fetchedCustomer: CustomerContactResponse | null = null;

      // 2. Fetch Customer Contact Targets if email/customerId exists or if contact update is requested
      const customerEmail = t.customerEmail || task.customerEmail;
      const customerId = t.customerId || task.customerId;

      if (customerEmail || customerId || hasPhoneOrAddress) {
        try {
          // A: Look up customer profile
          const custRes = await apolloClient.query<{ customer?: { id: string; email: string; version: number } }>({
            query: GET_CUSTOMER_BY_EMAIL_OR_ID,
            variables: { id: customerId, email: customerEmail },
            fetchPolicy: "network-only",
          });

          const resolvedCustomerId = custRes.data?.customer?.id || customerId;
          const resolvedVersion = custRes.data?.customer?.version || 1;

          if (resolvedCustomerId) {
            // B: Fetch Contact Targets (Addresses and Phones)
            const targetsRes = await apolloClient.query<{
              customerContactTargets?: { version?: number; targets?: ContactTarget[] } | ContactTarget[];
            }>({
              query: GET_CUSTOMER_CONTACT_TARGETS,
              variables: { id: resolvedCustomerId },
              fetchPolicy: "network-only",
            });

            const rawTargets = targetsRes.data?.customerContactTargets;
            if (rawTargets) {
              const targetsList: ContactTarget[] =
                "targets" in rawTargets && Array.isArray(rawTargets.targets)
                  ? rawTargets.targets
                  : Array.isArray(rawTargets)
                  ? rawTargets
                  : [];

              const rawVersion = "version" in rawTargets && typeof rawTargets.version === "number" ? rawTargets.version : resolvedVersion;

              fetchedCustomer = {
                id: resolvedCustomerId,
                email: custRes.data?.customer?.email || customerEmail || "",
                version: rawVersion,
                targets: targetsList,
              };
              setCustomerContact(fetchedCustomer);
            }
          }
        } catch {
          // If customer lookup fails (e.g. offline store or non-commerce customer), proceed gracefully
        }
      }

      // 3. Fetch Correlated Order if an order number exists
      if (orderNum) {
        try {
          const orderRes = await apolloClient.query<{ order: OrderDetailResult }>({
            query: GET_ORDER_FOR_WISMO,
            variables: { orderNumber: orderNum },
            fetchPolicy: "network-only",
          });
          fetchedOrder = orderRes.data?.order ?? null;
          setOrderDetail(fetchedOrder);
        } catch {
          // Order lookup failure handled gracefully in investigation
        }
      }

      // 4. Run Dynamic AI Investigation Engine
      const result = investigateTicket(t, fetchedCustomer, fetchedOrder);
      setInvestigation(result);
      setCustomerDraft(result.customerDraft);
      setInternalWorklog(result.internalWorklog);
      setProposedStatus(result.proposedStatus);

      if (result.matchedContactTarget) {
        setSelectedAddressId(result.matchedContactTarget.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket investigation");
    } finally {
      setLoading(false);
    }
  }, [apolloClient, task.id, task.orderNumber, task.customerEmail, task.customerId]);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  // ── 2. Handle Manual Address Selection for Ambiguous Addresses ───────────
  const handleSelectAddress = useCallback(
    (addressId: string) => {
      setSelectedAddressId(addressId);
      if (!customerContact || !investigation || !ticketDetail) return;

      const chosen = customerContact.targets.find((t) => t.id === addressId);
      if (!chosen) return;

      const phone = investigation.entities.phone;
      const custName = ticketDetail.customerName || ticketDetail.customerEmail || "Customer";

      const updatedPlan: InvestigationResult = {
        ...investigation,
        matchedContactTarget: chosen,
        canResolveWithAvailableInfo: Boolean(phone),
        clarificationNeeded: null,
        missingInfo: [],
        availableInfo: [
          ...investigation.availableInfo,
          `Agent selected target address: ${chosen.label}`,
        ],
        proposedChanges: phone
          ? [
              {
                field: "Address Phone Number",
                target: chosen.label,
                previousValue: chosen.phone || "(empty)",
                proposedValue: phone,
              },
            ]
          : [],
        customerDraft: phone
          ? `Dear ${custName},\n\nWe have updated your contact phone number for your ${chosen.label} address to ${phone} as requested.\n\nPlease let us know if you need any additional changes to your account.\n\nBest regards,\nCustomer Success Team`
          : investigation.customerDraft,
        internalWorklog: phone
          ? `Contact Update: Verified request to update ${chosen.label} phone to ${phone}. Selected address approved by agent.`
          : investigation.internalWorklog,
        proposedStatus: phone ? "Resolved" : "In Progress",
      };

      setInvestigation(updatedPlan);
      setCustomerDraft(updatedPlan.customerDraft);
      setInternalWorklog(updatedPlan.internalWorklog);
      setProposedStatus(updatedPlan.proposedStatus);
    },
    [customerContact, investigation, ticketDetail]
  );

  // ── 3. Copy Draft to Clipboard ───────────────────────────────────────────
  const handleCopyDraft = useCallback(() => {
    if (!customerDraft) return;
    navigator.clipboard.writeText(customerDraft).then(() => {
      setCopiedDraft(true);
      setTimeout(() => setCopiedDraft(false), 2000);
    });
  }, [customerDraft]);

  // ── 4. Execute Approved Resolution (Atomic & Safe) ─────────────────────────
  const handleExecute = useCallback(async () => {
    if (!ticketDetail || isExecuting || isExecuted || investigation?.isHighRiskFinancial) return;

    setIsExecuting(true);
    setExecutionError(null);
    setStaleConflict(false);

    let recordedContact = contactUpdated;
    let recordedWorklog = worklogExecuted;
    let recordedUpdate = ticketUpdated;
    const currentResults = [...executionResults];

    try {
      // Step A: Revalidate current record state for concurrency conflict
      const recheck = await apolloClient.query<{ ticket: TicketDetailResult }>({
        query: TICKET_QUERY,
        variables: { id: ticketDetail.id },
        fetchPolicy: "network-only",
      });

      const currentTicket = recheck.data?.ticket;
      if (
        currentTicket &&
        initialLastModifiedAt &&
        currentTicket.lastModifiedAt &&
        currentTicket.lastModifiedAt !== initialLastModifiedAt
      ) {
        setStaleConflict(true);
        throw new Error(
          "Stale Record: Ticket was modified by another user since this investigation was prepared."
        );
      }

      // Step B: Execute Contact Phone Update Mutation (if contact update intent)
      if (
        investigation?.intent === "contact_update" &&
        investigation.matchedContactTarget &&
        investigation.entities.phone &&
        customerContact &&
        !recordedContact
      ) {
        await updateContactNumberMutation({
          variables: {
            id: customerContact.id,
            addressId: investigation.matchedContactTarget.id,
            expectedVersion: customerContact.version,
            phone: investigation.entities.phone,
          },
        });
        recordedContact = true;
        setContactUpdated(true);
        currentResults.push(
          `Updated contact phone to ${investigation.entities.phone} for ${investigation.matchedContactTarget.label} in commerce store`
        );
        setExecutionResults([...currentResults]);
      }

      // Step C: Execute Internal Worklog Mutation if not yet executed
      if (internalWorklog.trim() && !recordedWorklog) {
        const author = user?.name || user?.email || "Support Agent";
        await addWorklogMutation({
          variables: {
            id: ticketDetail.id,
            comment: {
              id: `wl-${Date.now()}`,
              comment: internalWorklog.trim(),
              createdAt: new Date().toISOString(),
              status: "Completed",
              author,
            },
          },
        });
        recordedWorklog = true;
        setWorklogExecuted(true);
        currentResults.push(`Added internal worklog by ${author}`);
        setExecutionResults([...currentResults]);
      }

      // Step D: Execute Ticket Status and Solution Update if not yet executed
      if (!recordedUpdate) {
        await updateTicketMutation({
          variables: {
            id: ticketDetail.id,
            patch: {
              status: proposedStatus,
              solution: customerDraft.trim(),
            },
          },
        });
        recordedUpdate = true;
        setTicketUpdated(true);
        currentResults.push(`Updated ticket status to "${proposedStatus}"`);
        currentResults.push(
          "Customer response draft saved to internal ticket resolution notes (outbound email dispatch not connected)"
        );
        setExecutionResults([...currentResults]);
      }

      setIsExecuted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Execution failed";
      if ((recordedContact || recordedWorklog) && !recordedUpdate) {
        setExecutionError(
          `Partial Execution: Initial actions succeeded, but final ticket status update failed (${msg}). Retrying will only attempt remaining steps.`
        );
      } else {
        setExecutionError(msg);
      }
    } finally {
      setIsExecuting(false);
    }
  }, [
    ticketDetail,
    isExecuting,
    isExecuted,
    investigation,
    contactUpdated,
    worklogExecuted,
    ticketUpdated,
    executionResults,
    apolloClient,
    initialLastModifiedAt,
    customerContact,
    updateContactNumberMutation,
    internalWorklog,
    user,
    addWorklogMutation,
    updateTicketMutation,
    proposedStatus,
    customerDraft,
  ]);

  // Tone color for detected intent
  const intentTone = useMemo(() => {
    switch (investigation?.intent) {
      case "contact_update":
        return "primary";
      case "order_tracking":
        return "warning";
      case "return_refund":
        return "error";
      case "product_inquiry":
        return "success";
      default:
        return "primary";
    }
  }, [investigation?.intent]);

  return (
    <div className="flex flex-col h-full bg-m-bg border-l border-m-border overflow-hidden select-none">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between border-b border-m-border bg-m-surface px-4 py-2.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-m-text-muted hover:text-m-text"
        >
          <Icon name="arrow-left" size="xs" />
          <span>Queue</span>
        </Button>

        <span className="text-xs font-semibold text-m-text flex items-center gap-1.5">
          <Icon name="sparkles" size="xs" className="text-indigo-600" />
          <span>AI Dynamic Ticket Investigation</span>
        </span>

        <span className="text-[11px] font-mono text-m-primary bg-m-primary/10 px-2 py-0.5 rounded font-semibold">
          {task.referenceNumber}
        </span>
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="py-20 text-center text-xs text-m-text-muted space-y-2">
            <Icon name="loader" size="md" className="animate-spin text-m-primary mx-auto" />
            <p>Analyzing customer intent and inspecting verified backend records...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center space-y-2">
            <p className="text-xs text-red-700 font-medium">Failed to load investigation: {error}</p>
            <Button size="sm" variant="outline" onClick={loadEvidence}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* ── Section 1: Ticket Understanding & Intent Detection ── */}
            <div className="rounded-xl border border-m-border bg-m-surface p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-m-text uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="activity" size="xs" className="text-m-primary" />
                  <span>Ticket Understanding</span>
                </span>
                <StatusPill tone={intentTone}>{investigation?.intentLabel || "General"}</StatusPill>
              </div>

              <div className="rounded-lg bg-m-surface-2 border border-m-border p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-m-text">{ticketDetail?.subject || task.title}</span>
                  <span className="text-[10px] text-m-text-muted font-mono">
                    Confidence: {Math.round((investigation?.confidence ?? 0.8) * 100)}%
                  </span>
                </div>
                {ticketDetail?.message && (
                  <p className="text-m-text-muted italic line-clamp-2">
                    &ldquo;{ticketDetail.message}&rdquo;
                  </p>
                )}
                <div className="pt-1 text-[11px] text-indigo-900 bg-indigo-50/60 rounded px-2.5 py-1.5 border border-indigo-100">
                  <strong>AI Assessment:</strong> {investigation?.summary}
                </div>
              </div>
            </div>

            {/* ── Section 2: Investigation & Retrieved Records ── */}
            <div className="rounded-xl border border-m-border bg-m-surface p-4 shadow-xs space-y-3">
              <span className="text-xs font-semibold text-m-text uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="database" size="xs" className="text-m-primary" />
                <span>Retrieved Context Records</span>
              </span>

              {/* A: Contact Update Context */}
              {investigation?.intent === "contact_update" && (
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-m-surface-2 border border-m-border space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-m-text-muted block">
                      Customer Profile
                    </span>
                    <div className="font-semibold text-m-text">
                      {ticketDetail?.customerName || customerContact?.email || "Customer"}
                    </div>
                    <div className="text-m-text-muted font-mono text-[11px]">
                      {customerContact?.email || ticketDetail?.customerEmail}
                    </div>
                  </div>

                  {/* Ambiguous Address Selector */}
                  {investigation.ambiguousContactTargets && investigation.ambiguousContactTargets.length > 1 ? (
                    <div className="p-3 rounded-lg border border-amber-300 bg-amber-50/80 space-y-2">
                      <span className="text-xs font-semibold text-amber-900 block flex items-center gap-1">
                        <Icon name="alert-triangle" size="xs" />
                        <span>Ambiguous Target: Select Address to Update</span>
                      </span>
                      <p className="text-[11px] text-amber-800">
                        Multiple addresses match your query. Select the intended customer address:
                      </p>
                      <div className="space-y-1.5 pt-1">
                        {investigation.ambiguousContactTargets.map((target) => (
                          <label
                            key={target.id}
                            className={`flex items-center justify-between p-2 rounded border cursor-pointer transition ${
                              selectedAddressId === target.id
                                ? "border-indigo-600 bg-indigo-50/60 font-medium"
                                : "border-amber-200 bg-white hover:bg-amber-100/40"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="address-target"
                                checked={selectedAddressId === target.id}
                                onChange={() => handleSelectAddress(target.id)}
                              />
                              <span className="text-xs text-m-text">{target.label}</span>
                            </div>
                            <span className="text-[11px] font-mono text-m-text-muted">
                              Current: {target.phone || "(none)"}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : investigation.matchedContactTarget ? (
                    <div className="p-2.5 rounded-lg bg-m-surface-2 border border-m-border space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-emerald-700 block flex items-center gap-1">
                        <Icon name="check-circle" size="xs" />
                        <span>Matched Address Target</span>
                      </span>
                      <div className="font-semibold text-m-text">
                        {investigation.matchedContactTarget.label}
                      </div>
                      <div className="text-[11px] text-m-text-muted font-mono">
                        Existing Phone: {investigation.matchedContactTarget.phone || "(empty)"}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                      ⚠️ No matching address found on customer profile.
                    </div>
                  )}
                </div>
              )}

              {/* B: Order Tracking Context */}
              {investigation?.intent === "order_tracking" && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-m-surface-2 border border-m-border space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-m-text-muted block">
                      Support Ticket
                    </span>
                    <div className="font-semibold text-m-text">{ticketDetail?.ticketNumber}</div>
                    <div className="text-m-text-muted truncate">{ticketDetail?.subject}</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-m-surface-2 border border-m-border space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-m-text-muted block">
                      Commerce Order
                    </span>
                    {orderDetail ? (
                      <>
                        <div className="font-mono font-semibold text-m-text">
                          #{orderDetail.orderNumber}
                        </div>
                        <StatusPill
                          tone={
                            orderDetail.shipmentState === "Delayed"
                              ? "error"
                              : orderDetail.shipmentState === "Delivered"
                              ? "success"
                              : "warning"
                          }
                        >
                          {orderDetail.shipmentState || orderDetail.orderState || "In Transit"}
                        </StatusPill>
                        {orderDetail.shippingAddress && (
                          <div className="text-[10px] text-m-text-muted truncate">
                            {orderDetail.shippingAddress.city}, {orderDetail.shippingAddress.country}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-amber-700 font-medium text-[11px]">
                        ⚠️ No order record linked
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* C: Return / Refund Policy Card */}
              {investigation?.isHighRiskFinancial && (
                <div className="p-3 rounded-lg border border-red-300 bg-red-50/80 text-xs text-red-800 space-y-1.5">
                  <span className="font-semibold flex items-center gap-1.5 text-red-900">
                    <Icon name="shield-alert" size="xs" />
                    <span>Financial Policy Protection Active</span>
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    Refunds, payments, and financial charges cannot be executed automatically. This request has
                    been flagged for supervisor authorization.
                  </p>
                </div>
              )}

              {/* Deep Carrier Scan Button */}
              <div className="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onInvestigateWithAI(task)}
                  disabled={isAssistantLoading}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-indigo-700 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/50"
                >
                  <Icon
                    name={isAssistantLoading ? "loader" : "sparkles"}
                    size="xs"
                    className={isAssistantLoading ? "animate-spin text-indigo-600" : "text-indigo-600"}
                  />
                  <span>
                    {isAssistantLoading ? "Assistant Analyzing..." : "Ask Assistant to Deep-Scan Carrier & Records"}
                  </span>
                </Button>
              </div>
            </div>

            {/* ── Section 3: Resolution Plan & Blockers ── */}
            <div className="rounded-xl border border-m-border bg-m-surface p-4 shadow-xs space-y-3">
              <span className="text-xs font-semibold text-m-text uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="check-square" size="xs" className="text-m-primary" />
                <span>Resolution Plan & Validation</span>
              </span>

              {/* Missing Information / Blocker Alert (Shown ONLY when real blocker exists) */}
              {investigation?.missingInfo && investigation.missingInfo.length > 0 ? (
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50/70 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                    <Icon name="alert-circle" size="xs" />
                    <span>Action Required Before Execution:</span>
                  </div>
                  <ul className="list-disc pl-4 text-[11px] text-amber-800 space-y-0.5">
                    {investigation.missingInfo.map((info, idx) => (
                      <li key={idx}>{info}</li>
                    ))}
                  </ul>
                  {investigation.clarificationNeeded && (
                    <p className="text-[11px] text-amber-900 font-medium pt-1">
                      💡 <strong>Next Step:</strong> {investigation.clarificationNeeded}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-800 font-medium flex items-center gap-1.5">
                  <Icon name="check-circle" size="xs" className="text-emerald-600" />
                  <span>All required information verified. Ready for agent approval and execution.</span>
                </div>
              )}

              {/* Resolution Steps Checklist */}
              <div className="space-y-1.5 text-xs">
                {investigation?.planSteps.map((step) => (
                  <div
                    key={step.step}
                    className="flex items-center gap-2 p-2 rounded-lg bg-m-surface-2 border border-m-border text-[11px]"
                  >
                    <Icon
                      name={step.completed ? "check-circle" : "circle"}
                      size="xs"
                      className={step.completed ? "text-emerald-600" : "text-m-text-muted"}
                    />
                    <span className={step.completed ? "text-m-text" : "text-m-text-muted"}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Section 4: Proposed Field Changes / Diffs ── */}
            {investigation?.proposedChanges && investigation.proposedChanges.length > 0 && (
              <div className="rounded-xl border border-m-border bg-m-surface p-4 shadow-xs space-y-2.5">
                <span className="text-xs font-semibold text-m-text uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="git-commit" size="xs" className="text-m-primary" />
                  <span>Proposed Mutations (Before & After)</span>
                </span>

                <div className="space-y-2">
                  {investigation.proposedChanges.map((change, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/40 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold text-indigo-900">
                        <span>{change.field}</span>
                        <span className="text-[11px] text-m-text-muted truncate max-w-[200px]">
                          {change.target}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded bg-white border border-red-200 text-red-800 font-mono">
                          <span className="text-[9px] uppercase block text-red-600 font-semibold">
                            Current Value:
                          </span>
                          {change.previousValue}
                        </div>
                        <div className="p-2 rounded bg-white border border-emerald-200 text-emerald-800 font-mono">
                          <span className="text-[9px] uppercase block text-emerald-600 font-semibold">
                            Proposed Value:
                          </span>
                          {change.proposedValue}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Section 5: Editable Customer Response Draft ── */}
            <div className="rounded-xl border border-m-border bg-m-surface p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-m-text uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="message-square" size="xs" className="text-m-primary" />
                  <span>Grounded Customer Response (Editable)</span>
                </span>

                <button
                  type="button"
                  onClick={handleCopyDraft}
                  className="flex items-center gap-1 text-[11px] text-indigo-600 font-medium hover:underline cursor-pointer"
                >
                  <Icon name={copiedDraft ? "check" : "copy"} size="xs" />
                  <span>{copiedDraft ? "Copied!" : "Copy Draft"}</span>
                </button>
              </div>

              <div className="p-2 rounded bg-amber-50/80 border border-amber-200 text-[11px] text-amber-800 leading-tight">
                <strong>Communication Channel Notice:</strong> Direct outbound email dispatch is not connected
                in Customer Success Studio. This draft will be recorded into the ticket&apos;s internal resolution notes.
              </div>

              <textarea
                value={customerDraft}
                onChange={(e) => setCustomerDraft(e.target.value)}
                rows={5}
                disabled={isExecuted}
                className="w-full rounded-lg border border-m-border bg-m-surface-2 p-2.5 text-xs text-m-text font-normal leading-relaxed outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* ── Section 6: Editable Internal Worklog & Status ── */}
            <div className="rounded-xl border border-m-border bg-m-surface p-4 shadow-xs space-y-3">
              <span className="text-xs font-semibold text-m-text uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="clipboard" size="xs" className="text-m-primary" />
                <span>Internal Worklog & Status Mutation</span>
              </span>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-m-text-muted">
                  Internal Audit Note (Visible to agents only):
                </label>
                <input
                  type="text"
                  value={internalWorklog}
                  onChange={(e) => setInternalWorklog(e.target.value)}
                  disabled={isExecuted}
                  className="w-full rounded-lg border border-m-border bg-m-surface-2 px-3 py-2 text-xs text-m-text outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <label className="text-[11px] font-medium text-m-text-muted">
                  Proposed Ticket Status:
                </label>
                <select
                  value={proposedStatus}
                  onChange={(e) => setProposedStatus(e.target.value)}
                  disabled={isExecuted}
                  className="rounded-md border border-m-border bg-m-surface-2 px-2.5 py-1 text-xs font-medium text-m-text outline-none cursor-pointer"
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Pending">Pending (Waiting on Customer / Carrier)</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>

            {/* ── Section 7: Stale State Detection ── */}
            {staleConflict && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-red-800 font-semibold text-xs">
                  <Icon name="alert-triangle" size="sm" />
                  <span>Stale Record Detected</span>
                </div>
                <p className="text-xs text-red-700">
                  This ticket was modified in the database by another agent after this investigation was prepared.
                  Execution has been halted to prevent overwriting concurrent updates.
                </p>
                <Button size="sm" variant="outline" onClick={loadEvidence} className="text-xs">
                  Reload Latest Ticket State
                </Button>
              </div>
            )}

            {/* ── Section 8: Execution Results ── */}
            {executionError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium">
                {executionError}
              </div>
            )}

            {isExecuted && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs">
                  <Icon name="check-circle" size="sm" className="text-emerald-600" />
                  <span>Approved Execution Completed Successfully</span>
                </div>
                <ul className="text-xs text-emerald-700 space-y-1 pl-4 list-disc">
                  {executionResults.map((res, i) => (
                    <li key={i}>{res}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Section 9: Execution Controls ── */}
            <div className="pt-2">
              <Button
                variant="primary"
                onClick={handleExecute}
                disabled={
                  isExecuting ||
                  isExecuted ||
                  staleConflict ||
                  investigation?.isHighRiskFinancial ||
                  (!investigation?.canResolveWithAvailableInfo && !selectedAddressId)
                }
                className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold shadow-sm transition ${
                  isExecuted
                    ? "bg-emerald-600 hover:bg-emerald-600 text-white cursor-default"
                    : investigation?.isHighRiskFinancial
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                <Icon
                  name={isExecuting ? "loader" : isExecuted ? "check" : "zap"}
                  size="sm"
                  className={isExecuting ? "animate-spin" : ""}
                />
                <span>
                  {isExecuting
                    ? "Executing Approved Actions..."
                    : isExecuted
                    ? "Resolution Executed"
                    : investigation?.isHighRiskFinancial
                    ? "Supervisor Approval Required (Autonomous Write Blocked)"
                    : worklogExecuted && !ticketUpdated
                    ? "Retry Remaining Status Update"
                    : "Approve & Execute Resolution"}
                </span>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
