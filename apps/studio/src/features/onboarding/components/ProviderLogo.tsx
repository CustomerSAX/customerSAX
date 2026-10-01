"use client";

import type { ReactNode } from "react";

interface LogoProps {
  className?: string;
  size?: number;
}

/**
 * Official commercetools isometric 3D cube monogram
 * Source: @commercetools-frontend/assets (official brand package)
 */
export function CommercetoolsLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 25 29"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="commercetools"
    >
      <path
        d="M0.338 21.683V8.783c0-.357.387-.58.696-.402l11.172 6.449c.287.166.464.473.464.803v12.9c0 .358-.386.58-.696.402L0.802 22.486a.936.936 0 0 1-.464-.803Z"
        fill="#6359FF"
      />
      <path
        d="M1.788 6.474 12.785.124a1.082 1.082 0 0 1 .928 0l10.997 6.35c.386.223.386.78 0 1.004l-10.997 6.35a1.082 1.082 0 0 1-.928 0L1.788 7.478c-.386-.223-.386-.78 0-1.004Z"
        fill="#FFC806"
      />
      <path
        d="M13.829 28.535V16.572c0-.357.386-.58.696-.402l10.186 5.881c.386.224.386.781 0 1.005l-10.186 5.881c-.31.179-.696-.044-.696-.402Z"
        fill="#0BBFBF"
      />
    </svg>
  );
}

/**
 * Official Shopify bag logo
 * Source: Simple Icons (official brand assets)
 */
export function ShopifyLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="#7AB55C"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Shopify"
    >
      <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z" />
    </svg>
  );
}

/**
 * Official BigCommerce logo
 * Source: Simple Icons (official brand assets)
 */
export function BigCommerceLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="#121118"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="BigCommerce"
    >
      <path d="M12.645 13.663h3.027c.861 0 1.406-.474 1.406-1.235 0-.717-.545-1.234-1.406-1.234h-3.027c-.1 0-.187.086-.187.172v2.125c.015.1.086.172.187.172zm0 4.896h3.128c.961 0 1.535-.488 1.535-1.35 0-.746-.545-1.35-1.535-1.35h-3.128c-.1 0-.187.087-.187.173v2.34c.015.115.086.187.187.187zM23.72.053l-8.953 8.93h1.464c2.281 0 3.63 1.435 3.63 3 0 1.235-.832 2.14-1.722 2.541-.143.058-.143.259.014.316 1.033.402 1.765 1.48 1.765 2.742 0 1.78-1.19 3.202-3.5 3.202h-6.342c-.1 0-.187-.086-.187-.172V13.85L.062 23.64c-.13.13-.043.359.143.359h23.631a.16.16 0 0 0 .158-.158V.182c.043-.158-.158-.244-.273-.13z" />
    </svg>
  );
}

/**
 * Official Algolia logo
 * Source: Simple Icons (official brand assets)
 */
export function AlgoliaLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="#003DFF"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Algolia"
    >
      <path d="M12 0C5.445 0 .103 5.285.01 11.817c-.097 6.634 5.285 12.131 11.92 12.17a11.91 11.91 0 0 0 5.775-1.443.281.281 0 0 0 .052-.457l-1.122-.994a.79.79 0 0 0-.833-.14 9.693 9.693 0 0 1-3.923.77c-5.36-.067-9.692-4.527-9.607-9.888.084-5.293 4.417-9.573 9.73-9.573h9.73v17.296l-5.522-4.907a.407.407 0 0 0-.596.063 4.52 4.52 0 0 1-3.934 1.793 4.538 4.538 0 0 1-4.192-4.168 4.53 4.53 0 0 1 4.512-4.872 4.532 4.532 0 0 1 4.509 4.126c.018.205.11.397.265.533l1.438 1.275a.28.28 0 0 0 .462-.158 6.82 6.82 0 0 0 .099-1.725c-.232-3.376-2.966-6.092-6.345-6.3-3.873-.24-7.11 2.79-7.214 6.588-.1 3.7 2.933 6.892 6.634 6.974a6.75 6.75 0 0 0 4.136-1.294l7.212 6.394a.48.48 0 0 0 .797-.36V.456A.456.456 0 0 0 23.54 0Z" />
    </svg>
  );
}

/**
 * Official Zendesk logo
 * Source: Simple Icons (official brand assets)
 */
export function ZendeskLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="#03363D"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Zendesk"
    >
      <path d="M12.914 2.904V16.29L24 2.905H12.914zM0 2.906C0 5.966 2.483 8.45 5.543 8.45s5.542-2.484 5.543-5.544H0zm11.086 4.807L0 21.096h11.086V7.713zm7.37 7.84c-3.063 0-5.542 2.48-5.542 5.543H24c0-3.06-2.48-5.543-5.543-5.543z" />
    </svg>
  );
}

/**
 * Official Freshdesk logo
 * Source: Freshworks official vector assets / brand kit
 */
export function FreshdeskLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Freshdesk"
    >
      <path
        d="M19 1.77h12.192a4.06 4.06 0 0 1 4.095 4.095v12.192a16.18 16.18 0 0 1-16.176 16.176h-.092A16.18 16.18 0 0 1 7.57 29.5a16.17 16.17 0 0 1-4.744-11.444C2.826 9.092 10.056 1.862 19 1.77Z"
        fill="#25C16F"
      />
      <path
        d="M19 9a7.433 7.433 0 0 0-7.433 7.433v5.054a2.53 2.53 0 0 0 2.472 2.472h2.103v-5.8h-2.84v-1.623c.173-3.057 2.702-5.447 5.764-5.447s5.6 2.4 5.764 5.447v1.623h-2.877v5.8h1.9v.092a2.324 2.324 0 0 1-2.287 2.287h-2.27c-.184 0-.387.092-.387.277.01.2.177.378.387.387h2.287a2.97 2.97 0 0 0 2.951-2.951v-.184a2.444 2.444 0 0 0 1.9-2.398v-4.943C26.537 12.338 23.217 9 19 9Z"
        fill="#ffffff"
      />
    </svg>
  );
}

/**
 * Official OpenAI logo
 * Source: Simple Icons (official brand assets)
 */
export function OpenAiLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="#10A37F"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="OpenAI"
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

/**
 * Official Anthropic logo
 * Source: Simple Icons (official brand assets)
 */
export function AnthropicLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="#CC785C"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Anthropic"
    >
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  );
}

/**
 * Official Mantine UI logo
 * Source: Simple Icons (official brand assets)
 */
export function MantineLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="#339AF0"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Mantine UI"
    >
      <path d="M12 0C5.377 0 0 5.377 0 12s5.377 12 12 12 12-5.377 12-12S18.623 0 12 0zm-1.613 6.15a.91.91 0 0 1 .59.176c.43.317.825.68 1.177 1.082h2.588a.91.91 0 0 1 .912.906.909.909 0 0 1-.912.907h-1.43c.4.908.604 1.889.602 2.88a7.133 7.133 0 0 1-.601 2.883h1.427a.91.91 0 0 1 .914.907.91.91 0 0 1-.914.906h-2.588a7.399 7.399 0 0 1-1.175 1.082.919.919 0 0 1-1.28-.19.904.904 0 0 1 .191-1.268 5.322 5.322 0 0 0 2.2-4.32c0-1.715-.801-3.29-2.2-4.32a.906.906 0 0 1-.191-1.268H9.7a.916.916 0 0 1 .688-.363zm-.778 4.295a1.36 1.36 0 0 1 1.354 1.354v.033a1.36 1.36 0 0 1-1.354 1.32 1.36 1.36 0 0 1-1.353-1.32v-.033a1.36 1.36 0 0 1 1.353-1.354z" />
    </svg>
  );
}

/**
 * Official Material UI (MUI) logo
 * Source: Simple Icons (official brand assets)
 */
export function MuiLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="#007FFF"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Material UI"
    >
      <path d="M20.229 15.793a.666.666 0 0 0 .244-.243.666.666 0 0 0 .09-.333l.012-3.858a.666.666 0 0 1 .09-.333.666.666 0 0 1 .245-.243L23 9.58a.667.667 0 0 1 .333-.088.667.667 0 0 1 .333.09.667.667 0 0 1 .244.243.666.666 0 0 1 .089.333v7.014a.667.667 0 0 1-.335.578l-7.893 4.534a.666.666 0 0 1-.662 0l-6.194-3.542a.667.667 0 0 1-.246-.244.667.667 0 0 1-.09-.335v-3.537c0-.004.004-.006.008-.004s.008 0 .008-.005v-.004c0-.003.002-.005.004-.007l5.102-2.93c.004-.003.002-.01-.003-.01a.005.005 0 0 1-.004-.002.005.005 0 0 1-.001-.004l.01-3.467a.667.667 0 0 0-.333-.58.667.667 0 0 0-.667 0L8.912 9.799a.667.667 0 0 1-.665 0l-3.804-2.19a.667.667 0 0 0-.999.577v6.267a.667.667 0 0 1-.332.577.666.666 0 0 1-.332.09.667.667 0 0 1-.333-.088L.336 13.825a.667.667 0 0 1-.246-.244.667.667 0 0 1-.09-.336L.019 2.292a.667.667 0 0 1 .998-.577l7.23 4.153a.667.667 0 0 0 .665 0l7.228-4.153a.666.666 0 0 1 .333-.088.666.666 0 0 1 .333.09.667.667 0 0 1 .244.244.667.667 0 0 1 .088.333V13.25c0 .117-.03.232-.089.334a.667.667 0 0 1-.245.244l-3.785 2.18a.667.667 0 0 0-.245.245.666.666 0 0 0-.089.334.667.667 0 0 0 .09.334.666.666 0 0 0 .247.244l2.088 1.189a.67.67 0 0 0 .33.087.667.667 0 0 0 .332-.089l4.457-2.56Zm.438-9.828a.666.666 0 0 0 .09.335.666.666 0 0 0 .248.244.667.667 0 0 0 .67-.008l2.001-1.2a.666.666 0 0 0 .237-.243.666.666 0 0 0 .087-.329V2.32a.667.667 0 0 0-.091-.335.667.667 0 0 0-.584-.33.667.667 0 0 0-.334.094l-2 1.2a.666.666 0 0 0-.238.243.668.668 0 0 0-.086.329v2.445Z" />
    </svg>
  );
}

/**
 * Official Stripe logo
 * Source: Simple Icons (official brand assets)
 */
export function StripeLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="#635BFF"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Stripe"
    >
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.839 2.94 6.804 7.68 8.528 2.378.868 3.256 1.487 3.256 2.457 0 .973-.836 1.488-2.228 1.488-2.613 0-5.385-1.12-7.23-2.115l-.902 5.558c1.986.992 5.093 1.866 8.358 1.866 2.656 0 4.846-.653 6.36-1.897 1.574-1.288 2.445-3.15 2.445-5.464 0-4.99-3.04-6.852-7.69-8.497z" />
    </svg>
  );
}

/**
 * Official Adyen logo
 * Source: Simple Icons (official brand assets)
 */
export function AdyenLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="#0ABF53"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Adyen"
    >
      <path d="M11.996 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.996 0zm3.328 4.707h2.246l3.723 11.23h-2.316l-.82-2.585h-3.418l-.82 2.585H12.6zm-6.223 2.184h2.246v9.046H9.101zm5.95 2.671-.977 3.11h1.933z" />
    </svg>
  );
}

/**
 * Official Salesforce logo
 * Source: Simple Icons (official brand assets)
 */
export function SalesforceLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="#00A1E0"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Salesforce"
    >
      <path d="M10.024 4.502a5.71 5.71 0 0 1 4.414 2.083 4.876 4.876 0 0 1 3.524 1.503 4.87 4.87 0 0 1 1.428 3.447c0 .324-.035.642-.099.95a4.707 4.707 0 0 1 2.373 1.57 4.675 4.675 0 0 1 .936 2.845 4.697 4.697 0 0 1-1.376 3.322 4.7 4.7 0 0 1-3.324 1.378H4.7c-1.246 0-2.441-.495-3.323-1.376A4.697 4.697 0 0 1 0 16.9a4.675 4.675 0 0 1 .936-2.845 4.707 4.707 0 0 1 2.373-1.57c-.064-.308-.099-.626-.099-.95 0-1.293.513-2.533 1.428-3.447a4.876 4.876 0 0 1 3.524-1.503 5.674 5.674 0 0 1 1.862.317 5.71 5.71 0 0 1 4.414-2.083z" />
    </svg>
  );
}

/**
 * Official HubSpot logo
 * Source: Simple Icons (official brand assets)
 */
export function HubSpotLogo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="#FF7A59"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="HubSpot"
    >
      <path d="M18.163 7.037V4.772a2.378 2.378 0 1 0-1.748 0v2.265a7.352 7.352 0 0 0-4.048 2.457L6.47 5.253a2.38 2.38 0 1 0-1.236 1.236l5.897 4.246a7.375 7.375 0 0 0-1.488 4.47 7.42 7.42 0 1 0 8.52-8.168zm-.874 12.784a5.04 5.04 0 1 1 5.04-5.04 5.045 5.045 0 0 1-5.04 5.04z" />
    </svg>
  );
}

/**
 * Returns the official third-party brand logo component if available,
 * or null if it is a native CSA provider or unknown.
 */
export function getProviderLogo(providerId: string, className?: string): ReactNode | null {
  switch (providerId?.toLowerCase()) {
    case "commercetools":
      return <CommercetoolsLogo className={className} />;
    case "shopify":
      return <ShopifyLogo className={className} />;
    case "bigcommerce":
      return <BigCommerceLogo className={className} />;
    case "algolia":
      return <AlgoliaLogo className={className} />;
    case "zendesk":
      return <ZendeskLogo className={className} />;
    case "freshdesk":
      return <FreshdeskLogo className={className} />;
    case "stripe":
      return <StripeLogo className={className} />;
    case "adyen":
      return <AdyenLogo className={className} />;
    case "salesforce":
      return <SalesforceLogo className={className} />;
    case "hubspot":
      return <HubSpotLogo className={className} />;
    case "openai":
      return <OpenAiLogo className={className} />;
    case "anthropic":
      return <AnthropicLogo className={className} />;
    case "mantine":
      return <MantineLogo className={className} />;
    case "mui":
      return <MuiLogo className={className} />;
    default:
      return null;
  }
}

/**
 * Generic provider logo wrapper component
 */
export function ProviderLogo({
  id,
  className = "h-5 w-5",
  fallback = null
}: {
  id: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const logo = getProviderLogo(id, className);
  return <>{logo || fallback}</>;
}
