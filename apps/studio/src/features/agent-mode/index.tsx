"use client";

import { useState, useCallback } from "react";
import { useCurrentUser, roleLabel } from "@/lib/use-current-user";
import { useCsaChat } from "@/features/csa-assistant/hooks/use-csa-chat";
import { useConversationStore } from "@/features/csa-assistant/store/conversation-store";
import { CartProvider } from "@/features/csa-assistant/components/CartProvider";
import { CartDrawer } from "@/features/csa-assistant/components/CartDrawer";
import type { BusinessType, SessionContext } from "@/features/csa-assistant/types";
import { AgentModeHeader } from "./components/AgentModeHeader";
import { AgentChatPanel } from "./components/AgentChatPanel";
import { PriorityWorkspace } from "./components/PriorityWorkspace";
import type { AgentTask } from "./types";

const rawBusinessType = process.env.NEXT_PUBLIC_CT_BUSINESS_TYPE;
const CT_BUSINESS_TYPE: BusinessType | undefined =
  rawBusinessType === "b2b" || rawBusinessType === "b2c" ? rawBusinessType : undefined;

const VIP_THRESHOLD = process.env.NEXT_PUBLIC_CSA_VIP_THRESHOLD || undefined;

export function AgentMode() {
  const { user, loading } = useCurrentUser();
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);

  const isWriter = user?.role === "agent" || user?.role === "admin" || user?.role === "superadmin";

  const sessionContext: SessionContext = {
    userEmail: user?.email,
    userRole: user ? roleLabel(user.role) : undefined,
    projectKey: user?.activeProjectKey,
    clientId: user?.activeClientId,
    businessType: CT_BUSINESS_TYPE,
    pageContext: selectedTask
      ? { type: selectedTask.type, id: selectedTask.id }
      : null,
    canViewTickets: true,
    canCreateTickets: isWriter,
    canUpdateTickets: isWriter,
    canViewOrders: true,
    canCreateOrders: isWriter,
    canUpdateOrders: isWriter,
    canViewCustomers: true,
    canCreateCustomers: isWriter,
    canUpdateCustomers: isWriter,
    canViewCarts: true,
    canCreateCarts: isWriter,
    canUpdateCarts: isWriter,
    canViewProducts: true,
    vipThreshold: VIP_THRESHOLD,
  };

  const chat = useCsaChat(sessionContext);

  const handleAnalyzeTask = useCallback(
    (task: AgentTask) => {
      // Sync active ticket ID to store if it's a ticket
      if (task.type === "ticket") {
        useConversationStore.getState().setActiveTicketId(task.id);
      }

      let prompt = "";
      if (task.type === "ticket") {
        prompt = [
          `Please investigate ticket ${task.referenceNumber} for customer ${task.customerName || task.customerEmail}.`,
          `Subject: "${task.title}".`,
          task.orderNumber ? `Associated Order Number: ${task.orderNumber}.` : "",
          `Verify evidence from the records, check order/shipment status if relevant, and prepare a complete, grounded resolution proposal.`,
        ]
          .filter(Boolean)
          .join(" ");
      } else if (task.type === "order") {
        prompt = [
          `Please investigate order ${task.referenceNumber} for customer ${task.customerName || task.customerEmail}.`,
          `Status: ${task.status}.`,
          `Check current tracking details, determine any shipment delay, and propose appropriate customer communication and actions.`,
        ].join(" ");
      } else {
        prompt = [
          `Please review quote ${task.referenceNumber} for ${task.customerName}.`,
          `Status: ${task.status}.`,
          `Check quote lines, item availability, and prepare next follow-up actions.`,
        ].join(" ");
      }

      chat.sendSuggestion(prompt);
    },
    [chat]
  );

  const handleClearSession = useCallback(() => {
    chat.setMessages([]);
    chat.clearSession();
    setSelectedTask(null);
    useConversationStore.getState().setActiveTicketId(null);
  }, [chat]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-m-bg text-m-text-muted text-sm select-none">
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          Loading Agent Mode workspace...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-m-bg">
      {/* Commerce cart provider & drawer portals */}
      <CartProvider />
      <CartDrawer />

      {/* ── Top Header ── */}
      <AgentModeHeader />

      {/* ── 2-Region Full-Screen Workspace ── */}
      <main className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {/* Left Region: Conversational Assistant (45-50%) */}
        <div className="h-full min-h-0 flex flex-col border-r border-m-border overflow-hidden">
          <AgentChatPanel
            chat={chat}
            selectedTask={selectedTask}
            onClearSession={handleClearSession}
          />
        </div>

        {/* Right Region: Minimal Priority Workspace (50-55%) */}
        <div className="h-full min-h-0 flex flex-col overflow-hidden">
          <PriorityWorkspace
            selectedTask={selectedTask}
            onSelectTask={setSelectedTask}
            onAnalyzeTask={handleAnalyzeTask}
            isInvestigating={chat.isLoading}
          />
        </div>
      </main>
    </div>
  );
}
