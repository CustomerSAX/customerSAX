import { DEFAULT_LOCALE, isSupportedLocale, LOCALE_COOKIE_NAME } from "@csa/i18n";
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import enUS from "../../messages/en-US.json";
import frFR from "../../messages/fr-FR.json";
import deDE from "../../messages/de-DE.json";
import esES from "../../messages/es-ES.json";

const messagesByLocale = {
  "en-US": enUS,
  "fr-FR": frFR,
  "de-DE": deDE,
  "es-ES": esES
};

export default getRequestConfig(async () => {
  const requestedLocale = (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
  const locale =
    requestedLocale && isSupportedLocale(requestedLocale)
      ? requestedLocale
      : DEFAULT_LOCALE;

  return {
    locale,
    messages: messagesByLocale[locale]
  };
});
