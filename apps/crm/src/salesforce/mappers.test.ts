import { describe, expect, it } from "vitest";
import { mapAccount, mapContact, mapTask } from "./mappers.js";
import { isSalesforceId, soqlString, soslTerm } from "./soql.js";

describe("salesforce soql escaping", () => {
  it("escapes quotes and backslashes so input cannot break out of a SOQL literal", () => {
    expect(soqlString("o'brien@x.com")).toBe("'o\\'brien@x.com'");
    expect(soqlString("a\\' OR Id != '")).toBe("'a\\\\\\' OR Id != \\''");
  });

  it("escapes every SOSL reserved character", () => {
    expect(soslTerm("a+b-c{d}")).toBe("a\\+b\\-c\\{d\\}");
    expect(soslTerm("x} RETURNING User(Id")).toBe("x\\} RETURNING User\\(Id");
  });

  it("accepts only 15/18-char alphanumeric ids", () => {
    expect(isSalesforceId("003XXXXXXXXXXXX")).toBe(true);
    expect(isSalesforceId("003XXXXXXXXXXXXAAA")).toBe(true);
    expect(isSalesforceId("003' OR Id != '")).toBe(false);
    expect(isSalesforceId("0031234")).toBe(false);
  });
});

describe("salesforce mappers", () => {
  it("maps absent fields to null, never placeholders", () => {
    const contact = mapContact({ Id: "003XXXXXXXXXXXX", LastName: "Rogers", Account: null }, "https://acme.my.salesforce.com");
    expect(contact).toMatchObject({
      id: "003XXXXXXXXXXXX",
      provider: "salesforce",
      lastName: "Rogers",
      firstName: null,
      email: null,
      accountName: null,
      mailingAddress: null,
      externalUrl: "https://acme.my.salesforce.com/lightning/r/Contact/003XXXXXXXXXXXX/view",
    });
  });

  it("keeps a partial address rather than dropping it", () => {
    const account = mapAccount({ Id: "001XXXXXXXXXXXX", Name: "Edge", BillingCity: "Austin" }, "https://x");
    expect(account.billingAddress).toEqual({ street: null, city: "Austin", state: null, postalCode: null, country: null });
  });

  it("maps Task subtypes to activity types", () => {
    expect(mapTask({ Id: "00T1", TaskSubtype: "Call" }).type).toBe("CALL");
    expect(mapTask({ Id: "00T2", TaskSubtype: "ListEmail" }).type).toBe("EMAIL");
    expect(mapTask({ Id: "00T3", TaskSubtype: null }).type).toBe("TASK");
    expect(mapTask({ Id: "00T4", TaskSubtype: "LinkedIn" }).type).toBe("OTHER");
  });
});
