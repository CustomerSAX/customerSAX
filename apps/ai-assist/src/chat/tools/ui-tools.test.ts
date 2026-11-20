import { expect, it } from "vitest";
import { buildUiTools } from "./ui-tools.js";

const options = { toolCallId: "t", messages: [], context: {} };
const approvalArgs = { title: "Place order", description: "Place it", executeCommand: "Place the order" };

it("shows only one approval card per reply", async () => {
  const gate = { pending: false };
  const tools = buildUiTools(gate) as unknown as Record<string, { execute: (a: unknown, o: unknown) => Promise<unknown> }>;
  const first = await tools.action_approval.execute(approvalArgs, options);
  expect(first).toMatchObject({ status: "PENDING_APPROVAL" });
  expect(gate.pending).toBe(true);
  const second = await tools.action_approval.execute(approvalArgs, options);
  expect(second).toMatchObject({ error: expect.stringContaining("ONE_APPROVAL_PER_REPLY") });
});

it("start_checkout only signals the studio with the cart id", async () => {
  const tools = buildUiTools({ pending: false }) as unknown as Record<string, { execute: (a: unknown, o: unknown) => Promise<unknown> }>;
  expect(await tools.start_checkout.execute({ cartId: "cart-1" }, options)).toMatchObject({ success: true, cartId: "cart-1" });
});
