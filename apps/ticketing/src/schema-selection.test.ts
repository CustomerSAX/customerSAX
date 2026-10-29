import { expect, it } from "vitest";
import { parse, type FieldNode, type FragmentDefinitionNode } from "graphql";
import { selectionIncludes } from "./schema.js";

function info(source: string) {
  const document = parse(source);
  const operation = document.definitions.find((definition) => definition.kind === "OperationDefinition");
  if (!operation || operation.kind !== "OperationDefinition") throw new Error("operation required");
  const fragments = Object.fromEntries(
    document.definitions
      .filter((definition): definition is FragmentDefinitionNode => definition.kind === "FragmentDefinition")
      .map((fragment) => [fragment.name.value, fragment])
  );
  return {
    fieldNodes: [operation.selectionSet.selections[0] as FieldNode],
    fragments
  };
}

it("detects nested SLA selections through fragments", () => {
  const selected = info(`
    query Tickets { ticketPage { results { ...TicketRow } } }
    fragment TicketRow on Ticket { id sla { nextDueAt } }
  `);
  expect(selectionIncludes(selected, ["results", "sla"])).toBe(true);
});

it("leaves lightweight ticket lists free of SLA enrichment", () => {
  const selected = info(`
    query AssistantTickets { ticketPage { total results { id ticketNumber subject status } } }
  `);
  expect(selectionIncludes(selected, ["results", "sla"])).toBe(false);
});
