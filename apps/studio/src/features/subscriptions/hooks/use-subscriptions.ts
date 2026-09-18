"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CustomerSubscription,
  SubscriptionDraft,
  SubscriptionHistoryEntry,
  SubscriptionStatus
} from "../types/subscription-types";

const STORAGE_KEY = "csa_customer_subscriptions";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nextSubscriptionNumber(existingCount: number) {
  return `SUB-${String(existingCount + 1).padStart(5, "0")}`;
}

function readSubscriptions(): CustomerSubscription[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSubscriptions(rows: CustomerSubscription[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function history(action: string, note?: string): SubscriptionHistoryEntry {
  return {
    id: makeId("hist"),
    action,
    actor: "Current Agent",
    createdAt: nowIso(),
    note
  };
}

export function useSubscriptions(customerId?: string) {
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);

  useEffect(() => {
    setSubscriptions(readSubscriptions());
  }, []);

  const persist = useCallback((next: CustomerSubscription[]) => {
    setSubscriptions(next);
    writeSubscriptions(next);
  }, []);

  const scopedSubscriptions = useMemo(() => {
    if (!customerId) return subscriptions;
    return subscriptions.filter((subscription) => subscription.customerId === customerId);
  }, [customerId, subscriptions]);

  const createSubscription = useCallback(
    (draft: SubscriptionDraft) => {
      const createdAt = nowIso();
      const next: CustomerSubscription = {
        ...draft,
        id: makeId("sub"),
        subscriptionNumber: nextSubscriptionNumber(subscriptions.length),
        linkedOrderNumbers: draft.linkedOrderNumbers ?? [],
        history: [history("Created subscription draft")],
        createdAt,
        updatedAt: createdAt
      };
      persist([next, ...subscriptions]);
      return next;
    },
    [persist, subscriptions]
  );

  const updateSubscription = useCallback(
    (id: string, draft: SubscriptionDraft) => {
      const updatedAt = nowIso();
      const next = subscriptions.map((subscription) =>
        subscription.id === id
          ? {
              ...subscription,
              ...draft,
              linkedOrderNumbers:
                draft.linkedOrderNumbers ?? subscription.linkedOrderNumbers,
              history: [history("Updated subscription"), ...subscription.history],
              updatedAt
            }
          : subscription
      );
      persist(next);
    },
    [persist, subscriptions]
  );

  const changeStatus = useCallback(
    (id: string, status: SubscriptionStatus, note?: string) => {
      const updatedAt = nowIso();
      const next = subscriptions.map((subscription) =>
        subscription.id === id
          ? {
              ...subscription,
              status,
              cancellationReason:
                status === "Cancelled" ? note : subscription.cancellationReason,
              history: [history(`${status} subscription`, note), ...subscription.history],
              updatedAt
            }
          : subscription
      );
      persist(next);
    },
    [persist, subscriptions]
  );

  const skipNextCycle = useCallback(
    (id: string) => {
      const next = subscriptions.map((subscription) => {
        if (subscription.id !== id) return subscription;
        const current = subscription.nextDeliveryDate
          ? new Date(subscription.nextDeliveryDate)
          : new Date();
        const nextDate = new Date(current);
        switch (subscription.frequency) {
          case "Weekly":
            nextDate.setDate(current.getDate() + 7);
            break;
          case "Every 2 weeks":
            nextDate.setDate(current.getDate() + 14);
            break;
          case "Quarterly":
            nextDate.setMonth(current.getMonth() + 3);
            break;
          case "Yearly":
            nextDate.setFullYear(current.getFullYear() + 1);
            break;
          default:
            nextDate.setMonth(current.getMonth() + 1);
        }

        return {
          ...subscription,
          nextDeliveryDate: nextDate.toISOString().slice(0, 10),
          history: [
            history(
              "Skipped upcoming cycle",
              `Moved next delivery from ${subscription.nextDeliveryDate}`
            ),
            ...subscription.history
          ],
          updatedAt: nowIso()
        };
      });
      persist(next);
    },
    [persist, subscriptions]
  );

  const deleteDraft = useCallback(
    (id: string) => {
      persist(
        subscriptions.filter(
          (subscription) => subscription.id !== id || subscription.status !== "Draft"
        )
      );
    },
    [persist, subscriptions]
  );

  return {
    subscriptions: scopedSubscriptions,
    allSubscriptions: subscriptions,
    createSubscription,
    updateSubscription,
    changeStatus,
    skipNextCycle,
    deleteDraft
  };
}
