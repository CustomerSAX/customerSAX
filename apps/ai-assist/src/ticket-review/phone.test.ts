import { describe, expect, it } from "vitest";
import { groundedPhone } from "./phone.js";

describe("ticket phone grounding", () => {
  const source = "Update contact details to +91 7699496625";
  it("accepts the reported ticket even if AI adds punctuation or paraphrases its evidence", () => {
    expect(groundedPhone(source, "+917699496625", `${source}.`)).toBe("+91 7699496625");
    expect(
      groundedPhone(source, "+91 7699496625", "Customer requests a new contact number.")
    ).toBe("+91 7699496625");
  });
  it("handles non-breaking spaces and typographic dashes", () => {
    expect(groundedPhone(source, "+91\u00a07699496625", null)).toBe("+91 7699496625");
    expect(groundedPhone("Change phone to +1 (469) 246–6072", "+14692466072", null)).toBe(
      "+1 (469) 246-6072"
    );
  });
  it("does not invent digits, drop country codes, or match a substring", () => {
    for (const phone of [
      "7699496625",
      "+91 7699496626",
      "917699496625",
      "+44 7699496625"
    ])
      expect(groundedPhone(source, phone, source)).toBeNull();
    expect(groundedPhone("Number: 999917699496625999", "+917699496625", null)).toBeNull();
  });
  it("requires grounded evidence when old and new numbers are present", () => {
    const multiple = "Old: +1 212 555 0100. New: +91 7699496625";
    expect(groundedPhone(multiple, "+917699496625", null)).toBeNull();
    expect(groundedPhone(multiple, "+917699496625", "New: +91 7699496625")).toBe(
      "+91 7699496625"
    );
  });
});
