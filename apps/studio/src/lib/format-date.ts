import { DEFAULT_LOCALE } from "@csa/i18n";

type DateInput = Date | number | string | null | undefined;

const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

const toDate = (value: DateInput) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isValidDate(date) ? date : null;
};

export function formatDate(value: DateInput, locale: string = DEFAULT_LOCALE) {
  const date = toDate(value);
  if (!date) return "--";

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: DateInput, locale: string = DEFAULT_LOCALE) {
  const date = toDate(value);
  if (!date) return "--";

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(value: DateInput, locale: string = DEFAULT_LOCALE) {
  const date = toDate(value);
  if (!date) return "--";

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
