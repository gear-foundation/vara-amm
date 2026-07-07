import { ENV } from '@/consts';

type VoucherState = {
  voucherId: string | null;
  programs: string[];
  varaBalance: string | null;
  balanceKnown: boolean;
  oneTimeUsed?: boolean;
};

type VoucherPostResponse =
  | { voucherId: string }
  | {
      statusCode?: number;
      message?: string;
      retryAfterSec?: number;
      error?: string;
    };

const normalizeProgramId = (programId: string): string => programId.toLowerCase();

const readVoucherState = async (account: string): Promise<VoucherState> => {
  if (!ENV.VOUCHER_API_URL) {
    throw new Error('Voucher backend is not configured.');
  }

  const response = await fetch(`${ENV.VOUCHER_API_URL}/${encodeURIComponent(account)}`);
  if (!response.ok) {
    throw new Error(`Voucher state request failed (${response.status}).`);
  }

  return (await response.json()) as VoucherState;
};

const parseVoucherResponse = async (response: Response): Promise<VoucherPostResponse> => {
  const text = await response.text();
  if (!text) {
    return {
      statusCode: response.status,
      message: response.statusText || `HTTP ${response.status}`,
    };
  }

  try {
    return JSON.parse(text) as VoucherPostResponse;
  } catch {
    return {
      statusCode: response.status,
      message: text,
    };
  }
};

const requestVoucher = async (
  account: string,
  programs: string[],
): Promise<{ status: number; body: VoucherPostResponse }> => {
  if (!ENV.VOUCHER_API_URL) {
    throw new Error('Voucher backend is not configured.');
  }

  const response = await fetch(ENV.VOUCHER_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account, programs }),
  });

  return {
    status: response.status,
    body: await parseVoucherResponse(response),
  };
};

export const ensureGasVoucher = async (account: string, programIds: string[]): Promise<string> => {
  const programs = Array.from(new Set(programIds.filter(Boolean).map(normalizeProgramId)));

  if (!ENV.VOUCHER_API_URL) {
    throw new Error('Voucher backend is not configured.');
  }
  if (programs.length === 0) {
    throw new Error('No programs requested for gas voucher.');
  }

  const state = await readVoucherState(account);
  const statePrograms = new Set((state.programs ?? []).map(normalizeProgramId));
  const missingProgram = programs.some((program) => !statePrograms.has(program));

  if (state.voucherId && !missingProgram) {
    return state.voucherId;
  }

  const { status, body } = await requestVoucher(account, programs);
  if (status >= 200 && status < 300 && 'voucherId' in body && body.voucherId) {
    return body.voucherId;
  }

  throw new Error(
    'message' in body && body.message
      ? `Gas voucher request failed (${status}): ${body.message}`
      : 'error' in body && body.error
        ? `Gas voucher request failed (${status}): ${body.error}`
        : `Gas voucher request failed (${status}).`,
  );
};
