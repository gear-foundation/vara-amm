import {
  ApiProvider as GearApiProvider,
  AlertProvider as GearAlertProvider,
  AccountProvider as GearAccountProvider,
  type ProviderProps,
} from '@gear-js/react-hooks';
import type { ComponentType } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { ThemeProvider } from '@/components/theme-provider';
import { Alert, alertStyles } from '@/components/ui/alert';
import { SimWsProvider } from '@/features/sim';

import { ENV } from '../../consts';

import { QueryProvider } from './query-provider';

// eslint-disable-next-line react-refresh/only-export-components
function ApiProvider({ children }: ProviderProps) {
  return <GearApiProvider initialArgs={{ endpoint: ENV.NODE_ADDRESS }}>{children}</GearApiProvider>;
}

// eslint-disable-next-line react-refresh/only-export-components
function AccountProvider({ children }: ProviderProps) {
  return <GearAccountProvider appName="Vara DEX">{children}</GearAccountProvider>;
}

// eslint-disable-next-line react-refresh/only-export-components
function AlertProvider({ children }: ProviderProps) {
  return (
    <GearAlertProvider template={Alert} containerClassName={alertStyles.root}>
      {children}
    </GearAlertProvider>
  );
}

const providers = [
  BrowserRouter,
  ApiProvider,
  QueryProvider,
  AccountProvider,
  ThemeProvider,
  AlertProvider,
  SimWsProvider,
];

function withProviders(Component: ComponentType) {
  return () => providers.reduceRight((children, Provider) => <Provider>{children}</Provider>, <Component />);
}

export { withProviders };
