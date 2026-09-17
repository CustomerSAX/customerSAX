import type { AppLocale } from "@csa/i18n";

export const LOCALE_PATH_SEGMENTS: Record<AppLocale, string> = {
  "en-US": "en-us",
  "fr-FR": "fr-fr",
  "de-DE": "de-de",
  "es-ES": "es-es"
};

const LOCALE_BY_PATH_SEGMENT = Object.fromEntries(
  Object.entries(LOCALE_PATH_SEGMENTS).map(([locale, segment]) => [segment, locale])
) as Record<string, AppLocale>;

export function localeToPathSegment(locale: AppLocale): string {
  return LOCALE_PATH_SEGMENTS[locale];
}

export function localeFromPathname(pathname: string): AppLocale | null {
  const segment = pathname.split("/")[1]?.toLowerCase();
  return segment ? LOCALE_BY_PATH_SEGMENT[segment] ?? null : null;
}

export function stripLocalePrefix(pathname: string): string {
  if (!localeFromPathname(pathname)) return pathname || "/";
  const stripped = pathname.replace(/^\/[^/]+(?=\/|$)/, "");
  return stripped || "/";
}

export function localizePathname(pathname: string, locale: AppLocale): string {
  const unprefixed = stripLocalePrefix(pathname);
  return `/${localeToPathSegment(locale)}${unprefixed === "/" ? "" : unprefixed}`;
}

export function localizeHref(href: string, locale: AppLocale): string {
  const match = href.match(/^([^?#]*)(.*)$/);
  const pathname = match?.[1] || "/";
  const suffix = match?.[2] || "";
  return `${localizePathname(pathname, locale)}${suffix}`;
}
