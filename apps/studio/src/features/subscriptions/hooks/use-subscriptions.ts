"use client";

import { useMutation, useQuery } from "@apollo/client";
import { useCallback, useMemo } from "react";
import {
  CHANGE_SUBSCRIPTION_STATUS,
  CREATE_SUBSCRIPTION,
  DELETE_SUBSCRIPTION_DRAFT,
  SKIP_SUBSCRIPTION_CYCLE,
  SUBSCRIPTIONS_QUERY,
  UPDATE_SUBSCRIPTION
} from "../api/queries";
import type { CustomerSubscription, SubscriptionDraft, SubscriptionStatus } from "../types/subscription-types";

type SubscriptionQueryData = { subscriptions: CustomerSubscription[] };

export function useSubscriptions(customerId?: string) {
  const { data, loading, error, refetch } = useQuery<SubscriptionQueryData>(SUBSCRIPTIONS_QUERY, {
    variables: { customerId: customerId ?? null },
    fetchPolicy: "cache-and-network"
  });
  const [createMutation] = useMutation(CREATE_SUBSCRIPTION);
  const [updateMutation] = useMutation(UPDATE_SUBSCRIPTION);
  const [changeStatusMutation] = useMutation(CHANGE_SUBSCRIPTION_STATUS);
  const [skipCycleMutation] = useMutation(SKIP_SUBSCRIPTION_CYCLE);
  const [deleteDraftMutation] = useMutation(DELETE_SUBSCRIPTION_DRAFT);
  const subscriptions = useMemo(() => data?.subscriptions ?? [], [data]);

  const createSubscription = useCallback(async (draft: SubscriptionDraft) => {
    const result = await createMutation({ variables: { draft } });
    await refetch();
    return result.data.createSubscription as CustomerSubscription;
  }, [createMutation, refetch]);

  const updateSubscription = useCallback(async (id: string, draft: SubscriptionDraft) => {
    await updateMutation({ variables: { id, patch: draft } });
    await refetch();
  }, [refetch, updateMutation]);

  const changeStatus = useCallback(async (id: string, status: SubscriptionStatus, note?: string) => {
    await changeStatusMutation({ variables: { id, status, note: note ?? null } });
    await refetch();
  }, [changeStatusMutation, refetch]);

  const skipNextCycle = useCallback(async (id: string) => {
    await skipCycleMutation({ variables: { id } });
    await refetch();
  }, [refetch, skipCycleMutation]);

  const deleteDraft = useCallback(async (id: string) => {
    await deleteDraftMutation({ variables: { id } });
    await refetch();
  }, [deleteDraftMutation, refetch]);

  return {
    subscriptions,
    allSubscriptions: subscriptions,
    createSubscription,
    updateSubscription,
    changeStatus,
    skipNextCycle,
    deleteDraft,
    loading,
    error,
    refetch
  };
}
