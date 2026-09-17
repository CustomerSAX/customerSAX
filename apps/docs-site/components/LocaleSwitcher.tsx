"use client";

import {
  isSupportedLocale,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  SUPPORTED_LOCALES
} from "@csa/i18n";
import { useLocale, useTranslations } from "next-intl";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("LocaleSwitcher");

  return (
    <select
      aria-label={t("label")}
      value={locale}
      onChange={(event) => {
        const nextLocale = event.target.value;
        if (!isSupportedLocale(nextLocale)) return;
        document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
        window.location.reload();
      }}
      style={{
        background: "var(--color-fd-background)",
        border: "1px solid var(--color-fd-border)",
        borderRadius: "0.5rem",
        color: "var(--color-fd-foreground)",
        cursor: "pointer",
        fontSize: "0.875rem",
        padding: "0.4rem 0.6rem"
      }}
    >
      {SUPPORTED_LOCALES.map((supportedLocale) => (
        <option key={supportedLocale} value={supportedLocale}>
          {t(supportedLocale)}
        </option>
      ))}
    </select>
  );
}
