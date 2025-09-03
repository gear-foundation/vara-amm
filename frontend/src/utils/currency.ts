/**
 * Currency and volume formatting utilities
 */

export function formatCurrency(value?: number | null): string {
  if (!value) return '$0';

  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

type VolumeData = {
  volume1h: number;
  volume1d: number;
  volume1w: number;
  volume1m: number;
  volume1y: number;
};

export function getVolumeByTimeframe<T extends VolumeData>(data: T, timeframe: string): string {
  switch (timeframe) {
    case '1h':
      return formatCurrency(data.volume1h);
    case '1d':
      return formatCurrency(data.volume1d);
    case '1w':
      return formatCurrency(data.volume1w);
    case '1m':
      return formatCurrency(data.volume1m);
    case '1y':
      return formatCurrency(data.volume1y);
    default:
      return formatCurrency(data.volume1d);
  }
}
