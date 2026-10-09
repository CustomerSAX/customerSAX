import { expect, it, vi } from "vitest";
import { createEmailProvider, type EmailMessage } from "./index.js";

const message: EmailMessage = { from: { email: "support@example.com" }, to: { email: "customer@example.com" }, subject: "Test", text: "Test message" };

it("fails closed for unsupported providers or empty credentials", () => {
  expect(() => createEmailProvider({ provider: "other", apiKey: "test-key" })).toThrow("Unsupported email provider");
  expect(() => createEmailProvider({ provider: "sendgrid", apiKey: " " })).toThrow("API key is required");
});

it("normalizes SendGrid acceptance and captures its message ID", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202, headers: { "x-message-id": "sg-id" } }));
  expect(await createEmailProvider({ provider: "sendgrid", apiKey: "test-key" }, request).send(message)).toEqual({ status: "accepted", messageId: "sg-id" });
  const payload = JSON.parse(request.mock.calls[0][1]!.body as string);
  expect(payload).not.toHaveProperty("reply_to");
  expect(payload.content).toEqual([{ type: "text/plain", value: message.text }]);
});

it("returns sanitized rejection and uncertain outcomes without retrying", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("sensitive provider body", { status: 429 }))
    .mockRejectedValueOnce(new Error("sensitive network details"));
  const provider = createEmailProvider({ provider: "sendgrid", apiKey: "test-key" }, request);
  expect(await provider.send(message)).toEqual({ status: "rejected", statusCode: 429 });
  expect(await provider.send(message)).toEqual({ status: "unknown" });
  expect(request).toHaveBeenCalledTimes(2);
});
