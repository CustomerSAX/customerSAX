import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function Navigation() {
  const t = useTranslations("Navigation");

  return (
    <nav className="nav">
      <div className="shell nav-inner">
        <a className="brand" href="#top">
          <img
            className="brand-logo"
            src="brand/customerSAX-logo.svg"
            alt="customerSAX"
          />
        </a>
        <div className="nav-links">
          <a href="#platform">{t("platform")}</a>
          <a href="#service">{t("customerService")}</a>
          <a href="#workforce">{t("workforce")}</a>
          <a href="#usecases">{t("useCases")}</a>
          <a href="#integrations">{t("integrations")}</a>
          <a href="#enterprise">{t("enterprise")}</a>
        </div>
        <div className="nav-actions">
          <LocaleSwitcher />
          <a className="btn" href="#platform">
            {t("explorePlatform")}
          </a>
          <a className="btn primary" href="#demo">
            {t("bookDemo")}
          </a>
          <button className="menu" aria-label={t("openMenu")}>
            ☰
          </button>
        </div>
      </div>
    </nav>
  );
}
