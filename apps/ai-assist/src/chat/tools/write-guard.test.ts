import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../system-prompt.js", () => ({ getSystemPromptContext: vi.fn() }));
import { getSystemPromptContext } from "../system-prompt.js";
import { guardWriteTools } from "./write-guard.js";

const execute = vi.fn(async () => ({ ok: true }));
const tools = guardWriteTools({ update_cart_address: { execute } });
const run = () => (tools.update_cart_address.execute as (a: unknown) => Promise<unknown>)({ cartId: "c1" });
const withApproval = (approval: unknown) =>
  vi.mocked(getSystemPromptContext).mockReturnValue({ canUpdateCarts: true, approval } as never);

beforeEach(() => execute.mockClear());

it("refuses a cart address the rep never chose (e.g. a plain 'yes')", async () => {
  withApproval(null);
  expect(await run()).toMatchObject({ error: expect.stringContaining("ADDRESS_REQUIRED") });
  expect(execute).not.toHaveBeenCalled();
});

it("sets the address from the submitted address form or a picked address", async () => {
  withApproval({ kind: "approval_card" });
  expect(await run()).toEqual({ ok: true });
  withApproval({ kind: "address_choice" });
  expect(await run()).toEqual({ ok: true });
  expect(execute).toHaveBeenCalledTimes(2);
});

it("sets a shipping method only when the rep clicked one", async () => {
  const shipExecute = vi.fn(async () => ({ ok: true }));
  const shipTools = guardWriteTools({ update_cart_shipping_method: { execute: shipExecute } });
  const ship = () => (shipTools.update_cart_shipping_method.execute as (a: unknown) => Promise<unknown>)({ cartId: "c1", shippingMethodId: "m1" });
  withApproval(null);
  expect(await ship()).toMatchObject({ error: expect.stringContaining("SHIPPING_REQUIRED") });
  withApproval({ kind: "address_choice" });
  expect(await ship()).toHaveProperty("error");
  expect(shipExecute).not.toHaveBeenCalled();
  withApproval({ kind: "shipping_choice" });
  expect(await ship()).toEqual({ ok: true });
});

it("does not let a shipping click set an address", async () => {
  withApproval({ kind: "shipping_choice" });
  expect(await run()).toHaveProperty("error");
  expect(execute).not.toHaveBeenCalled();
});

it("does not let a return confirmation set an address", async () => {
  withApproval({ kind: "return_confirm", orderId: "o1" });
  expect(await run()).toHaveProperty("error");
  expect(execute).not.toHaveBeenCalled();
});
