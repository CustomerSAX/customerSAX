# CustomerSAX Loyalty Adapter

## Overview

The Loyalty Adapter will give CustomerSAX a provider-neutral way to manage loyalty balances, rewards, vouchers, member benefits, and loyalty events. Voucherify is the proposed first provider, while CustomerSAX remains responsible for the agent experience, permissions, approvals, audit history, and commerce workflows.

## Goals

- Give agents a complete view of a customer's loyalty account.
- Apply eligible rewards, vouchers, member discounts, and delivery benefits.
- Redeem and restore points safely throughout the order lifecycle.
- Support subscription-specific loyalty benefits and earning rules.
- Avoid vendor lock-in through a common loyalty-provider contract.

## Agent capabilities

Agents should be able to:

- View balance, tier, expiring points, benefits, and transaction history.
- See rewards for which the customer and current order are eligible.
- Preview and redeem points against a cart or order.
- Explain why a reward or benefit is not eligible.
- Submit missing-points claims linked to an order.
- Make policy-controlled goodwill adjustments.
- Restore redeemed points after cancellation or payment failure.
- Reverse earned points and restore spent points after full or partial returns.
- Apply subscription benefits such as bonus points, tier discounts, or free delivery.
- Escalate large adjustments, suspicious activity, or account-merging requests.

## Proposed architecture

```text
CustomerSAX UI / AI Assistant
        |
        v
CustomerSAX Loyalty Service
  - permissions and approval
  - idempotency and audit
  - provider-neutral contract
        |
        v
Loyalty Provider Adapter
  - Voucherify initially
        |
        +----> Loyalty provider: eligibility, balance, tiers, redemption
        +----> commercetools: cart, order, price and shipping changes
        +----> Subscriptions: plan and renewal-cycle context
```

Voucherify can manage loyalty accounts, points, tiers, earning rules, rewards, eligibility, redemption, rollback, vouchers, gift cards, and promotional benefits. CustomerSAX will orchestrate those capabilities with commercetools orders and subscription events.

## Order and subscription lifecycle

| Event | Loyalty action |
|---|---|
| Order paid | Award or activate earned points |
| Payment failed | Cancel pending points and roll back redemption |
| Order cancelled | Restore redeemed points |
| Partial return | Reconcile earned and redeemed points by eligible line item |
| Full refund | Reverse earned points and restore redeemed points |
| Service failure | Add approved goodwill points as a separate transaction |
| Subscription renewal paid | Award standard and subscription bonus points |
| Subscription resumed | Apply an eligible retention reward |
| Subscription cancelled/refunded | Reverse the relevant cycle rewards |

Every write must use an idempotency key based on the source event, such as `orderId:eventType:version`, to prevent duplicate point movements.

## Governance

- Agents must never directly edit a displayed balance.
- Every change creates an immutable transaction with a reason and source reference.
- Redemption requires customer confirmation.
- Manual adjustments have role-based and monetary-equivalent limits.
- Large adjustments, tier changes, transfers, and account merges require approval.
- Failed downstream commerce operations trigger a compensating loyalty rollback.
- API credentials remain server-side and are scoped per CustomerSAX project.

## MVP delivery

1. Customer 360 loyalty summary and transaction history.
2. Eligible-benefits panel for rewards, vouchers, member discounts, and free delivery.
3. Governed points-redemption flow on carts and orders.
4. Automatic rollback for cancellation and payment failure.
5. Goodwill adjustment with reason codes and supervisor thresholds.
6. Subscription metadata and bonus-point rules for successful renewals.
7. AI tools for reading loyalty information and initiating governed agent actions.

## Success measures

- Loyalty-related contacts resolved without escalation.
- Missing-points claim resolution time.
- Redemption and rollback success rate.
- Reduction in manual loyalty adjustments.
- Subscription retention after loyalty offers.
- Duplicate or unreconciled loyalty transaction rate.

## References

- [Voucherify loyalty cards](https://docs.voucherify.io/api-reference/loyalties/loyalty-card-object)
- [Voucherify balance adjustments](https://docs.voucherify.io/api-reference/loyalties/adjust-loyalty-card-balance)
- [Voucherify redemption rollback](https://docs.voucherify.io/api-reference/redemptions/rollback-redemption)
- [Voucherify loyalty transaction history](https://docs.voucherify.io/api-reference/loyalties/list-loyalty-card-transactions)
