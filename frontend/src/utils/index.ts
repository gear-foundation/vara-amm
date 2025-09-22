export { formatCurrency, getVolumeByTimeframe } from './currency';

export const toNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  return typeof value === 'string' ? parseFloat(value) || 0 : Number(value) || 0;
};
