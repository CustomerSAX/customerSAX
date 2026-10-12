"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { initialCommitments, type Commitment } from "./data";

type Notice = { id: string; title: string; description: string; time: string };
function useDemoState() {
  const [approved, setApproved] = useState(false);
  const [resolutionReady, setResolutionReady] = useState(false);
  const [customerNotified, setCustomerNotified] = useState(false);
  const [ownerNotified, setOwnerNotified] = useState(false);
  const [policy, setPolicy] = useState([true, true, true, true, false]);
  const [commitments, setCommitments] = useState<Commitment[]>(initialCommitments);
  const [refreshTime, setRefreshTime] = useState("");
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState<Notice[]>([
    {
      id: "brief",
      title: "Summit brief is ready",
      description: "Meeting context and the conversation plan are prepared.",
      time: "8:06 AM"
    },
    {
      id: "quote",
      title: "Metro quote reopened",
      description: "Previously unavailable items are now ready for buyer review.",
      time: "7:52 AM"
    },
    {
      id: "promise",
      title: "Lakeside promise needs review",
      description: "Confirm the revised delivery date before contacting the customer.",
      time: "7:41 AM"
    },
    {
      id: "shipment",
      title: "Summit shipment confirmed",
      description: "Customer care recorded the replacement shipment update.",
      time: "7:28 AM"
    }
  ]);
  function notify(title: string, description: string) {
    setNotifications((previous) => [
      { id: crypto.randomUUID(), title, description, time: "Just now" },
      ...previous
    ]);
    setMessage(title);
  }
  function approve() {
    setApproved(true);
    notify(
      "Conversation plan approved",
      "Maya approved the Summit conversation plan in this demo."
    );
  }
  function capture(value: Omit<Commitment, "id" | "status">) {
    setCommitments((previous) => [
      ...previous,
      { ...value, id: crypto.randomUUID(), status: "Open" }
    ]);
    notify(
      "New customer commitment captured",
      `${value.owner}: ${value.title}. Visible to sales, customer care, and managers.`
    );
  }
  function refresh() {
    setRefreshTime(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
    setMessage("Sample data refreshed. No live service was contacted.");
  }
  return {
    approved,
    approve,
    resolutionReady,
    setResolutionReady,
    customerNotified,
    setCustomerNotified,
    ownerNotified,
    setOwnerNotified,
    policy,
    setPolicy,
    commitments,
    capture,
    refreshTime,
    refresh,
    message,
    setMessage,
    notifications,
    notify
  };
}
const DemoContext = createContext<ReturnType<typeof useDemoState> | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const state = useDemoState();
  return <DemoContext.Provider value={state}>{children}</DemoContext.Provider>;
}
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("DemoProvider is required");
  return value;
}
