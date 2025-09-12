import '@gear-js/vara-ui/dist/style.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';
import './app/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
