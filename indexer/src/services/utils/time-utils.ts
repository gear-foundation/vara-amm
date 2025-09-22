/**
 * Utility functions for time-based calculations
 */
export class TimeUtils {
  /**
   * Round date to the nearest hour
   */
  static roundToHour(date: Date): Date {
    const rounded = new Date(date);
    rounded.setMinutes(0, 0, 0);
    return rounded;
  }

  /**
   * Get time periods for volume/price calculations
   */
  static getTimePeriods(currentTime: Date) {
    return {
      oneHourAgo: new Date(currentTime.getTime() - 60 * 60 * 1000),
      oneDayAgo: new Date(currentTime.getTime() - 24 * 60 * 60 * 1000),
      sevenDaysAgo: new Date(currentTime.getTime() - 7 * 24 * 60 * 60 * 1000),
      thirtyDaysAgo: new Date(currentTime.getTime() - 30 * 24 * 60 * 60 * 1000),
      oneYearAgo: new Date(currentTime.getTime() - 365 * 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Get volume periods configuration
   */
  static getVolumePeriods() {
    return [
      { key: "volume1h" as const, hours: 1 },
      { key: "volume24h" as const, hours: 24 },
      { key: "volume7d" as const, hours: 24 * 7 },
      { key: "volume30d" as const, hours: 24 * 30 },
      { key: "volume1y" as const, hours: 24 * 365 },
    ];
  }

  /**
   * Check if two dates are in the same hour
   */
  static isSameHour(date1: Date, date2: Date): boolean {
    return this.roundToHour(date1).getTime() === this.roundToHour(date2).getTime();
  }
}
