export const SUPPORTED_LOCALES = ["en-US", "fr-FR", "de-DE", "es-ES"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en-US";

export const LOCALE_COOKIE_NAME = "csa_locale";

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const COMMERCE_LOCALES: Record<AppLocale, string> = {
  "en-US": "en",
  "fr-FR": "fr",
  "de-DE": "de",
  "es-ES": "es"
};

export function isSupportedLocale(value: string): value is AppLocale {
  return SUPPORTED_LOCALES.includes(value as AppLocale);
}

export function toCommerceLocale(locale: AppLocale): string {
  return COMMERCE_LOCALES[locale];
}
