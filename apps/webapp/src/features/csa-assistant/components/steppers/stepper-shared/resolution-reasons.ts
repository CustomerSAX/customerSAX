/**
 * Canonical reason catalog for refund / cancellation / replacement flows.
 *
 * Single source of truth, imported by both:
 *  - lib/ai/ui-tools.ts's `get_resolution_reasons` pseudo-tool (so the model
 *    always offers valid, real reasons instead of inventing them), and
 *  - src/ui/dashboard/ReturnStepper.tsx (so the Items & Reason step's picker
 *    shows the exact same taxonomy, not a second hand-maintained copy).
 *
 * Plain data, no framework imports — safe for both server (AI tool) and
 * client (React component) code.
 */
export const RESOLUTION_REASONS = {
  'FSQA': [
    'FSQA - Expired', 'FSQA - Spoiled', 'FSQA - Damaged Package/Vacuum Loss',
    'FSQA - Spec Size (Inconsistent Size, Wedge Cuts)', 'FSQA - Different from Picture',
    'FSQA - Trimming/Fatness', 'FSQA - Labeling', 'FSQA - Discoloration',
    'FSQA - Flavor/Taste', 'FSQA - Smell/Odor', 'FSQA - Texture/Juiciness',
    'FSQA - Foreign Material', 'FSQA - Freezer Burn/Thawed',
    'FSQA - Foodborne Illness (Got Sick)', 'FSQA - General Quality', 'FSQA - Other',
  ],
  'Failed Delivery': [
    'Failed Delivery - Customer Generated', 'Failed Delivery - Delay/Lost',
    'Failed Delivery - Damage by Carrier',
  ],
  'Store Ops': [
    'Store Ops - Missing Goods', 'Store Ops - Wrong Products Shipped',
    'Store Ops - Thawed Dry Ice Issue',
  ],
  'Other': [
    'Other - Store Pickup/Did Not Want', 'Other - Does Not Want', 'Other - Pre-Authorization',
    'Other - Fraud Cancellation', 'Other - Shipping Fees', 'Other - Price Match', 'Other - Test Order',
  ],
} as const;
