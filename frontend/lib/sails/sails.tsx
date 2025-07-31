import { HexString } from '@gear-js/api';
import { useProgram as useGearJsProgram } from '@gear-js/react-hooks';

import { ENV } from '@/consts';

import { Program as VftProgram } from './extended-vft';
import { Program as FactoryProgram } from './factory';
import { Program as PairProgram } from './pair';

const useFactoryProgram = () => {
  const { data: program } = useGearJsProgram({
    library: FactoryProgram,
    id: ENV.FACTORY_PROGRAM_ID,
  });

  return program;
};

const usePairProgram = (pairAddress?: HexString) => {
  const { data: program } = useGearJsProgram({
    library: PairProgram,
    id: pairAddress,
  });

  return program;
};

const useVftProgram = (vftAddress?: HexString) => {
  const { data: program } = useGearJsProgram({
    library: VftProgram,
    id: vftAddress,
  });

  return program;
};

export { useFactoryProgram, usePairProgram, useVftProgram };
