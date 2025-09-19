import { HexString } from '@gear-js/api';
import { useAlert } from '@gear-js/react-hooks';
import { useState } from 'react';

import { Token } from '@/features/pair/types';

type UseTokenImportParams = {
  onFindNewToken: () => void;
  onSelectToken: (token: Token) => void;
};

export const useTokenImport = ({ onSelectToken, onFindNewToken }: UseTokenImportParams) => {
  const [customToken, setCustomToken] = useState<Token | null>(null);
  const [customTokensMap, setCustomTokensMap] = useState<Map<HexString, Token>>(new Map());
  const [showImportModal, setShowImportModal] = useState(false);
  const alert = useAlert();

  const validateTokenContract = async (address: string): Promise<Token | null> => {
    try {
      // Simulate API call to validate VFT contract
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock validation - in real app this would call Vara network
      if (address.length === 66 && address.startsWith('0x')) {
        const mockToken: Token = {
          symbol: 'CUSTOM',
          displaySymbol: 'CUSTOM',
          name: 'Custom Token',
          address: address as HexString,
          decimals: 18,
          logoURI: '', // No logo for custom tokens
          balance: 1000000000000000000n, // Add test balance for custom tokens
          isVerified: false,
        };

        return mockToken;
      }
      return null;
    } catch (_error) {
      return null;
    }
  };

  const handleAddressSearch = async (address: string) => {
    if (address.length === 66 && address.startsWith('0x')) {
      const token = await validateTokenContract(address);
      if (token) {
        onFindNewToken();
        setCustomToken(token);
        setShowImportModal(true);
      } else {
        const errorMessage = 'This address does not point to a recognized fungible token contract.';
        alert.error(errorMessage);
      }
    }
  };

  return {
    validateTokenContract,
    handleAddressSearch,
    customTokensMap,
    tokenImportModalProps: {
      customToken,
      isOpen: showImportModal,
      onClose: () => setShowImportModal(false),
      onAddNewToken: (token: Token) => {
        setCustomToken(token);
        setShowImportModal(false);
        onSelectToken(token);
        setCustomTokensMap((prev) => prev.set(token.address, token));
      },
    },
  };
};
