const statuses: Record<string, { label: string; color: string; description: string }> = {
  not_analyzed: { label: "Not analyzed", color: "bg-slate-100 text-slate-600", description: "No saved AI review yet." },
  analyzing: { label: "Analyzing", color: "bg-blue-50 text-blue-700", description: "AI is reviewing the request." },
  agent_input_needed: { label: "Agent input needed", color: "bg-amber-50 text-amber-800", description: "The agent needs to clarify information or handle the request." },
  awaiting_approval: { label: "Awaiting approval", color: "bg-violet-50 text-violet-700", description: "An AI proposal is ready for agent approval." },
  waiting_for_customer: { label: "Waiting for customer", color: "bg-orange-50 text-orange-800", description: "An information-request email was accepted for delivery; the ticket is pending." },
  ai_working: { label: "AI working", color: "bg-blue-50 text-blue-700", description: "An approved action or closure is in progress." },
  action_completed: { label: "AI action completed", color: "bg-teal-50 text-teal-800", description: "The approved action succeeded; the ticket has not been closed by this review." },
  ai_resolved: { label: "AI resolved", color: "bg-emerald-50 text-emerald-800", description: "The approved AI action succeeded and the review closed the ticket." },
  review_completed: { label: "Review completed", color: "bg-teal-50 text-teal-800", description: "Review completed without a confirmed automated account or order change." },
  review_needed: { label: "Review needed", color: "bg-amber-50 text-amber-800", description: "The saved proposal is out of date; analyze the ticket again." },
  check_outcome: { label: "Check action outcome", color: "bg-red-50 text-red-700", description: "The action outcome is uncertain. Verify it before retrying." },
  analysis_failed: { label: "Analysis failed", color: "bg-red-50 text-red-700", description: "AI analysis failed; open the ticket to retry." },
  email_needs_attention: { label: "Email needs attention", color: "bg-amber-50 text-amber-800", description: "The information-request email was rejected or its outcome is unconfirmed." },
  not_supported: { label: "Not supported", color: "bg-slate-100 text-slate-600", description: "AI reviews currently support native tickets." },
  unavailable: { label: "Unavailable", color: "bg-slate-100 text-slate-600", description: "The saved AI status could not be loaded. Check AI Assist and refresh." }
};
export function AIStatusBadge({ status }: { status?: string }) {
  const value = statuses[status ?? "unavailable"] ?? statuses.unavailable;
  return <span title={value.description} className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${value.color}`}>{value.label}</span>;
}
