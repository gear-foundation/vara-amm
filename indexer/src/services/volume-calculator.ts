import { PairVolumeSnapshot, VolumeInterval } from "../model";
import { TimeUtils } from "./utils";
import { VolumePeriods } from "../types";

export class VolumeCalculator {
  static createEmptyHourlySnapshot(
    pairId: string,
    timestamp: Date
  ): PairVolumeSnapshot {
    const currentHour = TimeUtils.roundToHour(timestamp);
    const snapshotId = `${pairId}:HOURLY:${currentHour.getTime()}`;

    return new PairVolumeSnapshot({
      id: snapshotId,
      pair: { id: pairId } as any,
      interval: VolumeInterval.HOURLY,
      volumeUsd: 0,
      transactionCount: 0,
      timestamp: currentHour,
      createdAt: new Date(),
    });
  }

  static updateSnapshot(
    snapshot: PairVolumeSnapshot,
    value: number
  ): PairVolumeSnapshot {
    snapshot.volumeUsd += value;
    snapshot.transactionCount += 1;
    return snapshot;
  }

  static createOrUpdateHourlySnapshot(
    existingSnapshots: Map<string, PairVolumeSnapshot>,
    pairId: string,
    value: number,
    timestamp: Date
  ): PairVolumeSnapshot {
    const currentHour = TimeUtils.roundToHour(timestamp);
    const snapshotId = `${pairId}:HOURLY:${currentHour.getTime()}`;

    const existing = existingSnapshots.get(snapshotId);
    if (existing) {
      return this.updateSnapshot(existing, value);
    }

    const newSnapshot = this.createEmptyHourlySnapshot(pairId, timestamp);
    return this.updateSnapshot(newSnapshot, value);
  }

  static clearOldSnapshots(
    existingSnapshots: Map<string, PairVolumeSnapshot>,
    timestamp: Date
  ): void {
    const oneDayAgo = TimeUtils.getTimePeriods(timestamp).oneDayAgo;
    existingSnapshots.forEach((snapshot) => {
      if (snapshot.timestamp < oneDayAgo) {
        existingSnapshots.delete(snapshot.id);
      }
    });
  }

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
