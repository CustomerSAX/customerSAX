import { CSAUIComponentMap } from '../../contracts';
import { csaCustomComponents } from '../csa-custom/components';

/**
 * ZCM Adapter Scaffold
 *
 * NOTE: As identified during architecture verification, 'zcm' is not currently
 * a published or verified public npm package. This scaffold adapter implements
 * the CSAUIComponentMap contract and applies the customer-specified GREEN
 * secondary theme color (#16A34A).
 *
 * In accordance with the multi-UI architecture specification:
 * 1. It logs explicit diagnostic information about ZCM status.
 * 2. It safely falls back to standard CSA components to guarantee zero runtime crashes.
 * 3. When the official ZCM package details are confirmed by the product team,
 *    its components will directly replace this scaffold.
 */

const logZCMDiagnostic = (() => {
  let hasLogged = false;
  return () => {
    if (!hasLogged && typeof window !== 'undefined') {
      console.info(
        '%c[CSA UI Architecture] ZCM Adapter active',
        'color: #16A34A; font-weight: bold;',
        '— Operating in scaffold mode with Green secondary color. Standard fallback primitives active.',
      );
      hasLogged = true;
    }
  };
})();

const BaseButton = csaCustomComponents.Button;
const BaseBadge = csaCustomComponents.Badge;
const BaseCard = csaCustomComponents.Card;

export const zcmComponents: CSAUIComponentMap = {
  ...csaCustomComponents,
  Button: (props) => {
    logZCMDiagnostic();
    return <BaseButton {...props} />;
  },
  Badge: ({ variant = 'secondary', className, ...props }) => {
    // In ZCM, secondary badge renders with green accent
    const customClass = variant === 'secondary'
      ? `bg-emerald-50 text-emerald-700 border border-emerald-200 ${className || ''}`
      : className;
    return <BaseBadge variant={variant} className={customClass} {...props} />;
  },
  Card: ({ className, ...props }) => {
    return (
      <BaseCard
        className={`border-emerald-100/60 ${className || ''}`}
        {...props}
      />
    );
  },
};
