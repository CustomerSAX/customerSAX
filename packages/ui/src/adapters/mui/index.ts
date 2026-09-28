import { UIAdapter } from '../types';
import { muiComponents } from './components';
import { MUIAdapterProvider } from './provider';
import { ADAPTER_SECONDARY_COLORS } from '../../theme/tokens';

export const muiAdapter: UIAdapter = {
  id: 'mui',
  name: 'Material UI (MUI)',
  secondaryColorName: ADAPTER_SECONDARY_COLORS.mui.name,
  secondaryColorHex: ADAPTER_SECONDARY_COLORS.mui.base,
  components: muiComponents,
  Provider: MUIAdapterProvider,
};
