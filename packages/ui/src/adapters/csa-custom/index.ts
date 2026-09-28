import { UIAdapter } from '../types';
import { csaCustomComponents } from './components';
import { CSACustomAdapterProvider } from './provider';
import { ADAPTER_SECONDARY_COLORS } from '../../theme/tokens';

export const csaCustomAdapter: UIAdapter = {
  id: 'csa-custom',
  name: 'CSA Custom (Tailwind)',
  secondaryColorName: ADAPTER_SECONDARY_COLORS['csa-custom'].name,
  secondaryColorHex: ADAPTER_SECONDARY_COLORS['csa-custom'].base,
  components: csaCustomComponents,
  Provider: CSACustomAdapterProvider,
};
