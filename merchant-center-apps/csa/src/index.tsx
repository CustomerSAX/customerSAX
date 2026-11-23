/// <reference types="@commercetools-frontend/application-config/client" />

import { createRoot } from 'react-dom/client';
import EntryPoint from './entry-point';

const container = document.getElementById('app');
createRoot(container as Element).render(<EntryPoint />);
