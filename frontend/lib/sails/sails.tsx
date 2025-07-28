import { useProgram as useGearJsProgram } from "@gear-js/react-hooks";

import { Program as FactoryProgram } from "./factory";
import { Program as PairProgram } from "./pair";
import { ENV } from "@/consts";

const useFactoryProgram = () => {
  const { data: program } = useGearJsProgram({
    library: FactoryProgram,
    id: ENV.FACTORY_PROGRAM_ID,
  });

  return program;
};

const usePairProgram = () => {
  const { data: program } = useGearJsProgram({
    library: PairProgram,
    id: ENV.PAIR_PROGRAM_ID,
  });

  return program;
};

export { useFactoryProgram, usePairProgram };
