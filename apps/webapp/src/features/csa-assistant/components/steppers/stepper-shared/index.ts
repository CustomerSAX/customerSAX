/**
 * Shared building blocks for Stepper panels (Order, Ticket, Return). Extracted
 * because these pieces were previously copy-pasted verbatim across
 * CreateOrderStepper.tsx and CreateTicketStepper.tsx. Business-specific steps
 * (item grid, address form, classify chips, worklog table, etc.) stay local
 * to each stepper — only genuinely-duplicated scaffolding lives here.
 */
export * from './useCustomerSearch';
export * from './useCustomerOrders';
export * from './StepDots';
export * from './StepperHeader';
export * from './CustomerResultList';
export * from './SuccessBox';
export * from './PendingApprovalNote';
