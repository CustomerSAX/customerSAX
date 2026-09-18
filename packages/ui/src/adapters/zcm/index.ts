import { UIAdapter } from '../types';
import { zcmComponents } from './components';
import { ZCMAdapterProvider } from './provider';
import { ADAPTER_SECONDARY_COLORS } from '../../theme/tokens';

export const zcmAdapter: UIAdapter = {
  id: 'zcm',
  name: 'ZCM Adapter (Scaffold)',
  secondaryColorName: ADAPTER_SECONDARY_COLORS.zcm.name,
  secondaryColorHex: ADAPTER_SECONDARY_COLORS.zcm.base,
  components: zcmComponents,
  Provider: ZCMAdapterProvider,
};
