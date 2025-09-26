import type { HexString } from '@gear-js/api';

import { LOGO_URI_BY_SYMBOL, VERIFIED_TOKENS } from '@/consts';
import { VftProgram } from '@/lib/sails';
import { Token } from '@/types';

const fetchTokenData = async (
  program: VftProgram,
  address: HexString,
  userAddress?: HexString,
  varaSymbol?: string,
  nativeBalance?: bigint,
): Promise<Token | null> => {
  if (!program) return null;

  try {
    const [symbol, name, decimals, balance] = await Promise.all([
      program.vft.symbol(),
      program.vft.name(),
      program.vft.decimals(),
      userAddress ? program.vft.balanceOf(userAddress) : Promise.resolve(undefined),
    ]);

    const isVerified = VERIFIED_TOKENS.includes(address);
    const isVaraNative = isVerified && symbol.toLowerCase().includes('vara');

    return {
      symbol,
      displaySymbol: isVaraNative && varaSymbol ? varaSymbol : symbol,
      name,
      decimals,
      balance: isVaraNative ? nativeBalance : balance,
      address,
      logoURI: isVerified ? LOGO_URI_BY_SYMBOL[symbol] : '',
      isVaraNative,
      isVerified,
      network: 'Vara Network',
    };
  } catch (error) {
    console.error(`Error fetching token data for ${address}:`, error);
    return null;
  }
};

export { fetchTokenData };
