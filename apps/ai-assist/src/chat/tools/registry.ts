/**
 * Dynamic Tool Registry for CustomerX AI Agent.
 *
 * Provides a declarative, discoverable specification of all business tools,
 * APIs, parameters, validation contracts, required RBAC permissions, and
 * safety confirmation requirements.
 */

export interface ToolParameterContract {
  type: string;
  description: string;
  required?: boolean;
}

export interface ToolContract {
  name: string;
  category: "commerce" | "tickets" | "crm" | "ui" | "analytics";
  description: string;
  parameters: Record<string, ToolParameterContract>;
  requiredPermissions: string[];
  operationType: "read" | "write";
  requiresConfirmation: boolean;
  supportedFilters?: string[];
  responseStructure?: string;
  limitations?: string;
}

export const TOOL_REGISTRY: Record<string, ToolContract> = {
  // ─── Commerce / Order Tools ────────────────────────────────────────────────
  query_orders: {
    name: "query_orders",
    category: "commerce",
    description:
      "Search, filter, paginate, and analyze commerce orders across the tenant. Supports date ranges (e.g. tomorrow, this month, last month), status filters, shipment states, customer filters, and statistical aggregations.",
    parameters: {
      orderId: { type: "string", description: "Internal order UUID", required: false },
      orderNumber: { type: "string", description: "Human-readable order number (e.g. ORD-1234)", required: false },
      customerId: { type: "string", description: "Customer ID", required: false },
      customerEmail: { type: "string", description: "Customer email", required: false },
      orderState: { type: "string", description: "Order status (Open, Complete, Cancelled, Confirmed)", required: false },
      shipmentState: { type: "string", description: "Shipment status (Shipped, Delivered, Delayed, Ready, Pending, Partial)", required: false },
      paymentState: { type: "string", description: "Payment status (Paid, Pending, Failed)", required: false },
      relativeDate: {
        type: "string",
        description: "Relative date filter: 'today', 'tomorrow', 'yesterday', 'this_month', 'last_month'",
        required: false,
      },
      startDate: { type: "string", description: "Start of date range (ISO date / YYYY-MM-DD)", required: false },
      endDate: { type: "string", description: "End of date range (ISO date / YYYY-MM-DD)", required: false },
      searchQuery: { type: "string", description: "Free-text search within orders", required: false },
      limit: { type: "number", description: "Max results to return (default 20, max 100)", required: false },
      offset: { type: "number", description: "Offset for pagination", required: false },
      sortKey: { type: "string", description: "Sort field ('createdAt', 'lastModifiedAt', 'totalPrice')", required: false },
      sortOrder: { type: "string", description: "Sort direction ('asc', 'desc')", required: false },
    },
    requiredPermissions: ["canViewOrders"],
    operationType: "read",
    requiresConfirmation: false,
    supportedFilters: ["date ranges", "orderState", "shipmentState", "paymentState", "customer", "text search"],
    responseStructure: "{ total: number, count: number, orders: Order[], analytics?: { totalAmount, delayedCount, deliveredCount, topCustomers } }",
    limitations: "Respects tenant data boundary.",
  },

  get_order: {
    name: "get_order",
    category: "commerce",
    description:
      "Retrieve a specific order by ID or order number, or list recent orders for a customer by their ID or email.",
    parameters: {
      orderId: { type: "string", description: "Internal order UUID", required: false },
      orderNumber: { type: "string", description: "Human order number", required: false },
      customerId: { type: "string", description: "Customer ID", required: false },
      customerEmail: { type: "string", description: "Customer email", required: false },
      limit: { type: "number", description: "Max orders when listing for customer", required: false },
    },
    requiredPermissions: ["canViewOrders"],
    operationType: "read",
    requiresConfirmation: false,
    responseStructure: "{ order: Order | null, orders: Order[], total: number }",
  },

  update_order_status: {
    name: "update_order_status",
    category: "commerce",
    description:
      "Update the orderState or shipmentState of one or more orders. Consequential mutation: requires action_approval first.",
    parameters: {
      orderIds: { type: "string[]", description: "Array of order IDs or numbers to update", required: true },
      orderState: { type: "string", description: "New order state (Open, Confirmed, Complete, Cancelled)", required: false },
      shipmentState: { type: "string", description: "New shipment state (Shipped, Delivered, Delayed, Ready, Pending, Partial)", required: false },
      reason: { type: "string", description: "Reason for status change", required: false },
    },
    requiredPermissions: ["canUpdateOrders"],
    operationType: "write",
    requiresConfirmation: true,
    responseStructure: "{ success: boolean, updatedCount: number, results: Array<{ orderId: string, success: boolean, newState?: string }> }",
  },

  cancel_order: {
    name: "cancel_order",
    category: "commerce",
    description:
      "Cancel an order that has not yet shipped. Consequential mutation: requires action_approval first.",
    parameters: {
      orderId: { type: "string", description: "Internal order ID", required: true },
      reason: { type: "string", description: "Cancellation reason", required: false },
    },
    requiredPermissions: ["canUpdateOrders"],
    operationType: "write",
    requiresConfirmation: true,
    responseStructure: "{ success: boolean, orderId: string, orderState: string }",
    limitations: "Cannot cancel orders that have already shipped (shipmentState: Shipped). Offer returns instead.",
  },

  check_return_eligibility: {
    name: "check_return_eligibility",
    category: "commerce",
    description: "Check whether an order is eligible for return based on delivery date, status, and policy.",
    parameters: {
      orderId: { type: "string", description: "Order internal ID or order number", required: true },
    },
    requiredPermissions: ["canViewOrders"],
    operationType: "read",
    requiresConfirmation: false,
    responseStructure: "{ eligible: boolean, reasons?: string[], order?: Order }",
  },

  start_return: {
    name: "start_return",
    category: "commerce",
    description: "Record a return for eligible line items on an order. Consequential mutation: requires confirmation first.",
    parameters: {
      orderId: { type: "string", description: "Internal order UUID", required: true },
      reason: { type: "string", description: "Return reason code", required: true },
      lineItems: {
        type: "array",
        description: "Array of { lineItemId: string, quantity: number }",
        required: true,
      },
      comment: { type: "string", description: "Optional note", required: false },
    },
    requiredPermissions: ["canUpdateOrders"],
    operationType: "write",
    requiresConfirmation: true,
    responseStructure: "{ success: boolean, returnTrackingId: string }",
    limitations: "Records return in commerce backend; does not process automated bank refunds.",
  },

  // ─── Customer Tools ────────────────────────────────────────────────────────
  find_customer: {
    name: "find_customer",
    category: "commerce",
    description: "Look up a customer by email, ID, or full name.",
    parameters: {
      email: { type: "string", description: "Customer's email address", required: false },
      customerId: { type: "string", description: "Customer's platform ID", required: false },
      name: { type: "string", description: "Customer's full or partial name", required: false },
    },
    requiredPermissions: ["canViewCustomers"],
    operationType: "read",
    requiresConfirmation: false,
    responseStructure: "{ total: number, customers: Customer[] }",
  },

  search_customers: {
    name: "search_customers",
    category: "commerce",
    description:
      "Search, list, and rank customers across the tenant. Supports finding top customers by order count or volume.",
    parameters: {
      query: { type: "string", description: "Search term (name, email, company)", required: false },
      limit: { type: "number", description: "Max customers to return", required: false },
      offset: { type: "number", description: "Pagination offset", required: false },
      sortByOrders: { type: "boolean", description: "Sort by order volume/activity", required: false },
      period: { type: "string", description: "Filter activity period: 'this_month', 'all_time'", required: false },
    },
    requiredPermissions: ["canViewCustomers"],
    operationType: "read",
    requiresConfirmation: false,
    responseStructure: "{ total: number, customers: Customer[], topCustomers?: Array<{ customer: Customer, orderCount: number, totalSpent: string }> }",
  },

  update_customer_address: {
    name: "update_customer_address",
    category: "commerce",
    description:
      "Update a customer's address (street, city, state, postal code, country, phone). Consequential mutation: requires action_approval first.",
    parameters: {
      customerId: { type: "string", description: "Customer's platform UUID", required: true },
      addressId: { type: "string", description: "Address ID (optional, defaults to default shipping address)", required: false },
      address: {
        type: "object",
        description: "Address fields to update: { streetName?, streetNumber?, city?, state?, postalCode?, country?, phone? }",
        required: true,
      },
    },
    requiredPermissions: ["canUpdateCustomers"],
    operationType: "write",
    requiresConfirmation: true,
    responseStructure: "{ success: boolean, customerId: string, addressId: string, updatedAddress: object }",
  },

  update_customer_contact_number: {
    name: "update_customer_contact_number",
    category: "commerce",
    description:
      "Update the phone number for a customer's specific address. Version-bound. Requires action_approval first.",
    parameters: {
      customerId: { type: "string", description: "Customer platform ID", required: true },
      addressId: { type: "string", description: "Address ID", required: true },
      expectedVersion: { type: "number", description: "Current customer version", required: true },
      phone: { type: "string", description: "New contact phone number", required: true },
    },
    requiredPermissions: ["canUpdateCustomers"],
    operationType: "write",
    requiresConfirmation: true,
    responseStructure: "{ success: boolean, customer: object, message: string }",
  },

  // ─── Ticket Tools ──────────────────────────────────────────────────────────
  search_tickets: {
    name: "search_tickets",
    category: "tickets",
    description: "Search support tickets by keyword, customer email, customer ID, status, or priority.",
    parameters: {
      query: { type: "string", description: "Keyword search in subject or message", required: false },
      customerEmail: { type: "string", description: "Filter by customer email", required: false },
      customerId: { type: "string", description: "Filter by customer ID", required: false },
      status: { type: "string", description: "Filter by status: open, in progress, waiting, resolved, closed", required: false },
      priority: { type: "string", description: "Filter by priority: low, normal, high, urgent", required: false },
      limit: { type: "number", description: "Max tickets to return (default 10)", required: false },
    },
    requiredPermissions: ["canViewTickets"],
    operationType: "read",
    requiresConfirmation: false,
    responseStructure: "{ results: Ticket[], total: number }",
  },

  get_ticket: {
    name: "get_ticket",
    category: "tickets",
    description:
      "Retrieve full details of a single ticket by internal ID or ticket number, including conversation history, comments, and past solutions.",
    parameters: {
      id: { type: "string", description: "Ticket internal ID or ticket number (without '#')", required: true },
    },
    requiredPermissions: ["canViewTickets"],
    operationType: "read",
    requiresConfirmation: false,
    responseStructure: "Ticket with id, ticketNumber, subject, message, status, priority, orderNumber, comments[], history[]",
  },

  create_ticket: {
    name: "create_ticket",
    category: "tickets",
    description: "Create a new support ticket. Requires action_approval first.",
    parameters: {
      subject: { type: "string", description: "Ticket subject line", required: true },
      message: { type: "string", description: "Customer inquiry or issue description", required: true },
      customerEmail: { type: "string", description: "Customer email", required: true },
      category: { type: "string", description: "Category: request, orderInquiry, returns, generalInfoChange, etc.", required: false },
      priority: { type: "string", description: "Priority: low, normal, high, urgent", required: false },
      orderNumber: { type: "string", description: "Associated order number if applicable", required: false },
      assignee: { type: "string", description: "Agent email to assign to", required: false },
    },
    requiredPermissions: ["canCreateTickets"],
    operationType: "write",
    requiresConfirmation: true,
    responseStructure: "{ id: string, ticketNumber: string, status: string }",
  },

  update_ticket: {
    name: "update_ticket",
    category: "tickets",
    description: "Update ticket fields (status, priority, assignee, subject, etc.). Requires action_approval first.",
    parameters: {
      id: { type: "string", description: "Ticket ID", required: true },
      status: { type: "string", description: "New status: open, in progress, waiting, resolved, closed", required: false },
      priority: { type: "string", description: "New priority: low, normal, high, urgent", required: false },
      assignee: { type: "string", description: "Agent email", required: false },
      solution: { type: "string", description: "Resolution summary when closing", required: false },
    },
    requiredPermissions: ["canUpdateTickets"],
    operationType: "write",
    requiresConfirmation: true,
    responseStructure: "{ id: string, ticketNumber: string, status: string, ... }",
  },

  add_ticket_note: {
    name: "add_ticket_note",
    category: "tickets",
    description: "Add an internal worklog comment to a ticket. Not visible to the customer.",
    parameters: {
      ticketId: { type: "string", description: "Ticket ID", required: true },
      note: { type: "string", description: "Internal comment text", required: true },
    },
    requiredPermissions: ["canUpdateTickets"],
    operationType: "write",
    requiresConfirmation: true,
    responseStructure: "{ success: boolean, ticketId: string }",
  },

  // ─── CRM Tools ─────────────────────────────────────────────────────────────
  find_crm_contact: {
    name: "find_crm_contact",
    category: "crm",
    description: "Find a contact record in the connected CRM by email or name/phone query.",
    parameters: {
      email: { type: "string", description: "Contact email", required: false },
      query: { type: "string", description: "Name or phone query", required: false },
    },
    requiredPermissions: ["canViewCustomers"],
    operationType: "read",
    requiresConfirmation: false,
    responseStructure: "{ results: CrmContact[] }",
  },

  get_crm_contact_details: {
    name: "get_crm_contact_details",
    category: "crm",
    description: "Get full CRM contact profile, company account, and recent activities.",
    parameters: {
      contactId: { type: "string", description: "CRM contact ID", required: true },
    },
    requiredPermissions: ["canViewCustomers"],
    operationType: "read",
    requiresConfirmation: false,
    responseStructure: "{ contact: CrmContact, account: CrmAccount, activities: CrmActivity[] }",
  },

  log_crm_activity: {
    name: "log_crm_activity",
    category: "crm",
    description: "Log an activity (call, note, task) on a CRM contact. Requires action_approval.",
    parameters: {
      contactId: { type: "string", description: "CRM contact ID", required: true },
      type: { type: "string", description: "TASK, CALL, EMAIL, MEETING", required: true },
      subject: { type: "string", description: "Activity subject", required: true },
      description: { type: "string", description: "Activity notes", required: false },
    },
    requiredPermissions: ["canUpdateCustomers"],
    operationType: "write",
    requiresConfirmation: true,
    responseStructure: "{ success: boolean, id: string }",
  },

  // ─── UI & Safety Confirmation Tools ────────────────────────────────────────
  action_approval: {
    name: "action_approval",
    category: "ui",
    description:
      "Display an action confirmation card in the chat before executing any consequential mutation. The model stops and waits for rep approval.",
    parameters: {
      actionId: { type: "string", description: "Unique action ID", required: true },
      title: { type: "string", description: "Short title of action", required: true },
      description: { type: "string", description: "Plain-English description", required: true },
      intent: { type: "string", description: "Category of action", required: true },
      executeCommand: { type: "string", description: "Human-readable command signal", required: true },
      changes: { type: "array", description: "Before -> after diff lines", required: false },
      steps: { type: "array", description: "Steps to execute", required: false },
      fields: { type: "array", description: "Configurable fields", required: false },
    },
    requiredPermissions: [],
    operationType: "write",
    requiresConfirmation: false,
    responseStructure: "{ success: boolean }",
  },

  update_ui_state: {
    name: "update_ui_state",
    category: "ui",
    description: "Updates conversational working memory and background workspace intelligence.",
    parameters: {
      goal: { type: "string", description: "Turn goal summary", required: true },
      strategy: { type: "string", description: "Approach summary", required: true },
      sentiment: { type: "string", description: "Customer sentiment", required: false },
      confidence: { type: "number", description: "Confidence score (0-100)", required: false },
      nextSteps: { type: "array", description: "Next step labels", required: false },
      customerId: { type: "string", description: "Customer ID", required: false },
    },
    requiredPermissions: [],
    operationType: "write",
    requiresConfirmation: false,
    responseStructure: "{ success: boolean }",
  },
};

/**
 * Returns a clean, concise summary of available tools for dynamic LLM context.
 */
export function formatToolRegistryForPrompt(): string {
  const categories: Record<string, string[]> = {};

  for (const [name, contract] of Object.entries(TOOL_REGISTRY)) {
    if (!categories[contract.category]) {
      categories[contract.category] = [];
    }
    const mut = contract.operationType === "write" ? (contract.requiresConfirmation ? "[MUTATION: APPROVAL REQUIRED]" : "[DRAFT WRITE]") : "[READ]";
    categories[contract.category].push(`- \`${name}\` ${mut}: ${contract.description}`);
  }

  const lines: string[] = ["### Available Business Tool Registry"];
  for (const [cat, toolLines] of Object.entries(categories)) {
    lines.push(`\n**${cat.toUpperCase()}:**`);
    lines.push(...toolLines);
  }

  return lines.join("\n");
}
