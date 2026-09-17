import { useTranslations } from "next-intl";

export function Footer() {
  const footer = useTranslations("Footer");
  const navigation = useTranslations("Navigation");

  return (
    <footer>
      <div className="shell footer-grid">
        <div>
          <a className="brand" href="#top">
            <img
              className="brand-logo"
              src="brand/customerSAX-logo.svg"
              alt="customerSAX"
            />
          </a>
          <p className="footer-copy">{footer("description")}</p>
        </div>
        <div className="footer-links">
          <a href="#service">{navigation("customerService")}</a>
          <a href="#workforce">{navigation("workforce")}</a>
          <a href="#integrations">{navigation("integrations")}</a>
          <a href="#brand">{footer("brand")}</a>
          <a href="#enterprise">{navigation("enterprise")}</a>
        </div>
      </div>
    </footer>
  );
}
