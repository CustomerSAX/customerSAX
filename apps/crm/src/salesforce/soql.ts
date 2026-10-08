/**
 * SOQL/SOSL building blocks. Every user-supplied value goes through one of the
 * escapers here — never interpolate raw input into a query string.
 */

/** Salesforce record ids are 15 (case-sensitive) or 18 alphanumeric chars. */
export function isSalesforceId(value: string) {
  return /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(value);
}

/** Escapes a value for use inside a single-quoted SOQL string literal. */
export function soqlString(value: string) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** Escapes SOSL reserved characters for use inside a FIND {...} clause. */
export function soslTerm(value: string) {
  return value.replace(/[?&|!{}[\]()^~*:\\"'+-]/g, (char) => `\\${char}`);
}

export const CONTACT_FIELDS = [
  "Id",
  "FirstName",
  "LastName",
  "Name",
  "Email",
  "Phone",
  "MobilePhone",
  "Title",
  "AccountId",
  "Account.Name",
  "MailingStreet",
  "MailingCity",
  "MailingState",
  "MailingPostalCode",
  "MailingCountry",
  "Owner.Name",
  "CreatedDate",
  "LastModifiedDate",
].join(", ");

export const ACCOUNT_FIELDS = [
  "Id",
  "Name",
  "Industry",
  "Type",
  "Website",
  "Phone",
  "BillingStreet",
  "BillingCity",
  "BillingState",
  "BillingPostalCode",
  "BillingCountry",
  "Owner.Name",
  "CreatedDate",
  "LastModifiedDate",
].join(", ");

export const TASK_FIELDS = [
  "Id",
  "Subject",
  "Description",
  "Status",
  "IsClosed",
  "ActivityDate",
  "TaskSubtype",
  "WhoId",
  "AccountId",
  "Owner.Name",
  "CreatedDate",
].join(", ");

export const EVENT_FIELDS = ["Id", "Subject", "Description", "ActivityDate", "WhoId", "AccountId", "Owner.Name", "CreatedDate"].join(", ");
