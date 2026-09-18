import { UIAdapter } from '../types';
import { mantineComponents } from './components';
import { MantineAdapterProvider } from './provider';
import { ADAPTER_SECONDARY_COLORS } from '../../theme/tokens';

export const mantineAdapter: UIAdapter = {
  id: 'mantine',
  name: 'Mantine UI',
  secondaryColorName: ADAPTER_SECONDARY_COLORS.mantine.name,
  secondaryColorHex: ADAPTER_SECONDARY_COLORS.mantine.base,
  components: mantineComponents,
  Provider: MantineAdapterProvider,
};
