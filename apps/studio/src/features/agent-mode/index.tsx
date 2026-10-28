"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useCurrentUser, roleLabel } from "@/lib/use-current-user";
import { useCsaChat } from "@/features/csa-assistant/hooks/use-csa-chat";
import { useConversationStore } from "@/features/csa-assistant/store/conversation-store";
import { CartProvider } from "@/features/csa-assistant/components/CartProvider";
import { CartDrawer } from "@/features/csa-assistant/components/CartDrawer";
import type { BusinessType, SessionContext } from "@/features/csa-assistant/types";
import { AgentModeHeader } from "./components/AgentModeHeader";
import { AgentChatPanel } from "./components/AgentChatPanel";
import { AgentHistorySidebar } from "./components/AgentHistorySidebar";
import { PriorityWorkspace } from "./components/PriorityWorkspace";
import type { AgentTask } from "./types";
import type { UIMessage } from "ai";

const rawBusinessType = process.env.NEXT_PUBLIC_CT_BUSINESS_TYPE;
const CT_BUSINESS_TYPE: BusinessType | undefined =
  rawBusinessType === "b2b" || rawBusinessType === "b2c" ? rawBusinessType : undefined;

const VIP_THRESHOLD = process.env.NEXT_PUBLIC_CSA_VIP_THRESHOLD || undefined;

export function AgentMode() {
  const { user, loading } = useCurrentUser();
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [allTasks, setAllTasks] = useState<AgentTask[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  // ChatGPT-like layout controls
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  // Right side on-demand workspace is CLOSED by default during normal conversations
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

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
    const newId = chat.clearSession();
    setActiveSessionId(newId);
    setSelectedTask(null);
    useConversationStore.getState().setActiveTicketId(null);
  }, [chat]);

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      setActiveSessionId(sessionId);
      chat.restoreSession(sessionId);
      try {
        const res = await fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId)}`);
        if (res.ok) {
          const data = (await res.json()) as {
            messages?: Array<{ role: "user" | "assistant"; content: string; createdAt?: string }>;
          };
          if (data.messages && Array.isArray(data.messages)) {
            const uiMessages: UIMessage[] = data.messages.map((m, idx) => ({
              id: `msg-${sessionId}-${idx}`,
              role: m.role,
              parts: [{ type: "text" as const, text: m.content }],
              createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            }));
            chat.setMessages(uiMessages);
          }
        }
      } catch {
        // Fall back gracefully
      }
    },
    [chat]
  );

  // Auto-restore active conversation on mount (survives browser refresh and server restarts)
  useEffect(() => {
    if (loading || !user?.email) return;

    let isMounted = true;
    const restoreInitialSession = async () => {
      try {
        let storedId = "";
        try {
          storedId = localStorage.getItem("csa-session-id") || "";
        } catch { /* ignore */ }

        if (storedId) {
          const res = await fetch(`/api/chat?sessionId=${encodeURIComponent(storedId)}`);
          if (res.ok) {
            const data = (await res.json()) as {
              messages?: Array<{ role: "user" | "assistant"; content: string; createdAt?: string }>;
            };
            if (data.messages && data.messages.length > 0) {
              if (!isMounted) return;
              setActiveSessionId(storedId);
              chat.restoreSession(storedId);
              const uiMessages: UIMessage[] = data.messages.map((m, idx) => ({
                id: `msg-${storedId}-${idx}`,
                role: m.role,
                parts: [{ type: "text" as const, text: m.content }],
                createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
              }));
              chat.setMessages(uiMessages);
              return;
            }
          }
        }

        // If stored session had no messages or was missing, check for the user's latest session
        const sessionsRes = await fetch("/api/chat/sessions?limit=1");
        if (sessionsRes.ok) {
          const sData = (await sessionsRes.json()) as { sessions?: Array<{ sessionId: string }> };
          const latestId = sData.sessions?.[0]?.sessionId;
          if (latestId && isMounted) {
            await handleSelectSession(latestId);
          }
        }
      } catch {
        // Fall back gracefully
      }
    };

    restoreInitialSession();
    return () => {
      isMounted = false;
    };
  }, [loading, user?.email, handleSelectSession]);

  // Whenever chat finishes streaming a turn, refresh the sidebar so the title and new item appear
  const lastStatusRef = useRef(chat.status);
  useEffect(() => {
    if (lastStatusRef.current !== "ready" && chat.status === "ready" && chat.messages.length > 0) {
      setSidebarRefreshKey((prev) => prev + 1);
    }
    lastStatusRef.current = chat.status;
  }, [chat.status, chat.messages.length]);

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
      <AgentModeHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isWorkspaceOpen={isWorkspaceOpen}
        onToggleWorkspace={() => setIsWorkspaceOpen((prev) => !prev)}
        priorityCount={allTasks.length}
      />

      {/* ── Conversational AI-First Workspace ── */}
      <main className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Left Region: Collapsible Conversation History Sidebar */}
        <AgentHistorySidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
          onNewChat={handleClearSession}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          refreshTrigger={sidebarRefreshKey}
        />

        {/* Center Region: Primary Conversational Chat Workspace */}
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
          <AgentChatPanel
            chat={chat}
            selectedTask={selectedTask}
            onSelectTask={setSelectedTask}
            onClearSession={handleClearSession}
            allTasks={allTasks}
            onOpenWorkspace={() => setIsWorkspaceOpen(true)}
          />
        </div>

        {/* Right Region: On-Demand Operational Workspace (Closed by Default) */}
        {isWorkspaceOpen && (
          <div className="w-[420px] max-w-full h-full flex flex-col shrink-0 border-l border-m-border bg-m-bg overflow-hidden shadow-lg z-20">
            <PriorityWorkspace
              selectedTask={selectedTask}
              onSelectTask={setSelectedTask}
              onAnalyzeTask={handleAnalyzeTask}
              isInvestigating={chat.isLoading}
              onClose={() => setIsWorkspaceOpen(false)}
              onTasksLoaded={setAllTasks}
            />
          </div>
        )}

        {/* Background Task Observer: When workspace is closed, sync real counts silently */}
        {!isWorkspaceOpen && (
          <div className="hidden" aria-hidden="true">
            <PriorityWorkspace
              selectedTask={selectedTask}
              onSelectTask={setSelectedTask}
              onAnalyzeTask={handleAnalyzeTask}
              isInvestigating={chat.isLoading}
              onTasksLoaded={setAllTasks}
            />
          </div>
        )}
      </main>
    </div>
  );
}
