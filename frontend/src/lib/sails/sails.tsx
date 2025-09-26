import type { HexString } from '@gear-js/api';
import { useProgram as useGearJsProgram } from '@gear-js/react-hooks';

import { ENV } from '@/consts';

import { SailsProgram as VftProgram } from './extended-vft';
import { SailsProgram as FactoryProgram } from './factory';
import { SailsProgram as PairProgram } from './pair';
import { SailsProgram as VftVaraProgram } from './vft-vara';

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

const useVftVaraProgram = (vftAddress?: HexString) => {
  const { data: program } = useGearJsProgram({
    library: VftVaraProgram,
    id: vftAddress,
  });

  return program;
};

export { useFactoryProgram, usePairProgram, useVftProgram, useVftVaraProgram };
