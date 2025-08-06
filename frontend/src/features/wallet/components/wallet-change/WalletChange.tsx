import { useAccount } from '@gear-js/react-hooks';
import Identicon from '@polkadot/react-identicon';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';

import { useWallet } from '../../hooks';

import styles from './WalletChange.module.scss';

type Props = {
  onClose: () => void;
  openConnectWallet: () => void;
};

export function WalletChange({ onClose, openConnectWallet }: Props) {
  const { account, logout } = useAccount();
  const { walletAccounts } = useWallet();

  const getAccounts = () =>
    walletAccounts?.map((_account) => {
      const { address, meta } = _account;
      const isActive = address === account?.address;
      if (!isActive) return null;

      return (
        <li key={address}>
          <div className={styles.account}>
            <Suspense>
              <Identicon value={address} size={34} theme="polkadot" className={styles.accountIcon} />
            </Suspense>
            <span className="font-semibold">{meta.name}</span>
          </div>
        </li>
      );
    });

  const handleChangeButtonClick = () => {
    openConnectWallet();
    onClose();
  };

  const handleLogoutButtonClick = () => {
    logout();
    onClose();
  };

  return (
    <div className={styles.changeAccount}>
      <div>
        <ul className={styles.list}>{getAccounts()}</ul>
      </div>

      <div className={styles.buttons}>
        <Button onClick={handleChangeButtonClick}>Change account</Button>
        <Button variant="secondary" onClick={handleLogoutButtonClick}>
          Disconnect
        </Button>
      </div>
    </div>
  );
}
