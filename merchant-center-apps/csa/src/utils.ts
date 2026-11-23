import type { Address, Money, RawCustomField } from './types';

export const getErrorMessage = (error: unknown) => {
  if (error && typeof error === 'object' && 'graphQLErrors' in error) {
    const graphQLErrors = (
      error as { graphQLErrors?: Array<{ message?: string }> }
    ).graphQLErrors;
    const message = graphQLErrors
      ?.map((item) => item.message)
      .filter(Boolean)
      .join('\n');
    if (message) return message;
  }
  return error instanceof Error
    ? error.message
    : 'The request could not be completed.';
};

export const formatMoney = (money?: Money | null) => {
  if (!money) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: money.currencyCode,
    currencyDisplay: 'code',
  }).format(money.centAmount / 10 ** money.fractionDigits);
};

export const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—';

export const displayName = (first?: string | null, last?: string | null) =>
  [first, last].filter(Boolean).join(' ') || '—';

export const escapePredicateValue = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuidField = (field: string) =>
  field === 'id' || field === 'customerId' || field.endsWith('.id');

export const exactSearchPredicate = (value: string, fields: string[]) => {
  const text = value.trim();
  if (!text) return undefined;
  const searchableFields = fields.filter(
    (field) => !isUuidField(field) || UUID_PATTERN.test(text)
  );
  if (searchableFields.length === 0) return undefined;
  const escaped = escapePredicateValue(text);
  return `(${searchableFields
    .map((field) => `${field}="${escaped}"`)
    .join(' or ')})`;
};

export const idInPredicate = (ids: string[]) => {
  if (ids.length === 0) return undefined;
  return `id in (${ids
    .map((id) => `"${escapePredicateValue(id)}"`)
    .join(', ')})`;
};

export const formatAddress = (address?: Address | null) => {
  if (!address) return '—';
  return [
    [address.firstName, address.lastName].filter(Boolean).join(' '),
    address.company,
    [address.streetNumber, address.streetName].filter(Boolean).join(' '),
    [address.city, address.state, address.postalCode]
      .filter(Boolean)
      .join(', '),
    address.country,
  ]
    .filter(Boolean)
    .join('\n');
};

export const formatCustomValue = (value: unknown): string => {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value)) return value.map(formatCustomValue).join(', ');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('centAmount' in record && 'currencyCode' in record) {
      return formatMoney({
        centAmount: Number(record.centAmount),
        currencyCode: String(record.currencyCode),
        fractionDigits: Number(record.fractionDigits ?? 2),
      });
    }
    if ('label' in record) return formatCustomValue(record.label);
    if ('id' in record) return String(record.id);
    return Object.entries(record)
      .map(([key, item]) => `${key}: ${formatCustomValue(item)}`)
      .join(', ');
  }
  return String(value);
};

export const customFieldsToRows = (fields?: RawCustomField[] | null) =>
  fields ?? [];

const csvEscape = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const rowsToCsv = (
  headers: string[],
  rows: Array<Record<string, unknown>>
) =>
  [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(',')
    ),
  ].join('\r\n');

export const downloadCsv = (filename: string, csv: string) => {
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export type CsvPreview = {
  headers: string[];
  rows: string[][];
  errors: string[];
};

export const parseCsvPreview = (content: string): CsvPreview => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let quoted = false;
  const source = content.replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '"' && quoted && next === '"') {
      currentValue += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      currentRow.push(currentValue);
      currentValue = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      currentRow.push(currentValue);
      if (currentRow.some((value) => value.trim())) rows.push(currentRow);
      currentRow = [];
      currentValue = '';
    } else {
      currentValue += character;
    }
  }

  currentRow.push(currentValue);
  if (currentRow.some((value) => value.trim())) rows.push(currentRow);
  const headers = (rows.shift() ?? []).map((value) => value.trim());
  const errors: string[] = [];
  if (quoted) errors.push('The CSV contains an unterminated quoted field.');
  if (headers.length === 0) errors.push('The CSV header row is missing.');
  rows.forEach((row, index) => {
    if (row.length !== headers.length)
      errors.push(
        `Row ${index + 2} has ${row.length} columns; expected ${
          headers.length
        }.`
      );
  });
  return { headers, rows, errors };
};
