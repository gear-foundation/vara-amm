import {
  ApiProvider as GearApiProvider,
  // AlertProvider as GearAlertProvider,
  AccountProvider as GearAccountProvider,
  ProviderProps,
} from '@gear-js/react-hooks';
import { ComponentType } from 'react';

import { ENV } from '../../consts';

import { QueryProvider } from './query-provider';

// import { ENV } from "@/app/consts";
// import { Alert, alertStyles } from "@/components/ui/alert";

function ApiProvider({ children }: ProviderProps) {
  return <GearApiProvider initialArgs={{ endpoint: ENV.NODE_ADDRESS }}>{children}</GearApiProvider>;
}

function AccountProvider({ children }: ProviderProps) {
  return <GearAccountProvider appName="Vara DEX">{children}</GearAccountProvider>;
}

// function AlertProvider({ children }: ProviderProps) {
//   return (
//     <GearAlertProvider template={Alert} containerClassName={alertStyles.root}>
//       {children}
//     </GearAlertProvider>
//   );
// }

const providers = [ApiProvider, QueryProvider, AccountProvider];

function withProviders(Component: ComponentType) {
  return () => providers.reduceRight((children, Provider) => <Provider>{children}</Provider>, <Component />);
}

export { withProviders };
