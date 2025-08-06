import {
  ApiProvider as GearApiProvider,
  AlertProvider as GearAlertProvider,
  AccountProvider as GearAccountProvider,
  type ProviderProps,
} from '@gear-js/react-hooks';
import type { ComponentType } from 'react';

import { ThemeProvider } from '@/components/theme-provider';
import { Alert, alertStyles } from '@/components/ui/alert';

import { ENV } from '../../consts';

import { QueryProvider } from './query-provider';

function ApiProvider({ children }: ProviderProps) {
  return <GearApiProvider initialArgs={{ endpoint: ENV.NODE_ADDRESS }}>{children}</GearApiProvider>;
}

function AccountProvider({ children }: ProviderProps) {
  return <GearAccountProvider appName="Vara DEX">{children}</GearAccountProvider>;
}

function AlertProvider({ children }: ProviderProps) {
  return (
    <GearAlertProvider template={Alert} containerClassName={alertStyles.root}>
      {children}
    </GearAlertProvider>
  );
}

const providers = [ThemeProvider, ApiProvider, QueryProvider, AccountProvider, AlertProvider];

function withProviders(Component: ComponentType) {
  return () => providers.reduceRight((children, Provider) => <Provider>{children}</Provider>, <Component />);
}

export { withProviders };
