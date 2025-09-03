import { PairVolumeSnapshot, VolumeInterval } from "../model";
import { TimeUtils } from "./utils";
import { VolumePeriods } from "../types";

export class VolumeCalculator {
  /**
   * Create or update hourly snapshot for the pair
   */
  static createOrUpdateHourlySnapshot(
    existingSnapshots: Map<string, PairVolumeSnapshot>,
    pairId: string,
    value: number,
    timestamp: Date
  ): PairVolumeSnapshot {
    const currentHour = TimeUtils.roundToHour(timestamp);
    const snapshotId = `${pairId}:HOURLY:${currentHour.getTime()}`;

    // Try to get existing snapshot
    let snapshot = existingSnapshots.get(snapshotId);

    if (snapshot) {
      // Update existing
      snapshot.volumeUsd += value;
      snapshot.transactionCount += 1;
    } else {
      // Create new
      snapshot = new PairVolumeSnapshot({
        id: snapshotId,
        pair: { id: pairId } as any,
        interval: VolumeInterval.HOURLY,
        volumeUsd: value,
        transactionCount: 1,
        timestamp: currentHour,
        createdAt: new Date(),
      });
    }

    return snapshot;
  }

  /**
   * Calculate volumes from existing snapshots
   */
  static calculateVolumesFromSnapshots(
    allSnapshots: PairVolumeSnapshot[],
    currentTime: Date
  ): VolumePeriods {
    const periods = TimeUtils.getVolumePeriods();
    const results: Partial<VolumePeriods> = {};

    // Calculate volumes for each period
    for (const period of periods) {
      const startTime = new Date(
        currentTime.getTime() - period.hours * 60 * 60 * 1000
      );

      results[period.key] = allSnapshots
        .filter((s) => s.timestamp >= startTime)
        .reduce((sum, s) => sum + s.volumeUsd, 0);
    }

    return results as VolumePeriods;
  }
}
