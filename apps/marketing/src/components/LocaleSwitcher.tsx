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
        background: "transparent",
        border: "1px solid currentColor",
        borderRadius: "999px",
        color: "inherit",
        cursor: "pointer",
        font: "inherit",
        padding: "0.45rem 0.7rem"
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
