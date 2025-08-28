import { MoreThanOrEqual } from "typeorm";
import { ProcessorContext } from "../processor";
import { PairVolumeSnapshot, VolumeInterval } from "../model";
import { TimeUtils } from "./utils";
import { VolumePeriods } from "../types";

export class VolumeCalculator {
  private ctx: ProcessorContext;
  private snapshots: Map<string, PairVolumeSnapshot> = new Map();

  constructor(ctx: ProcessorContext) {
    this.ctx = ctx;
  }

  async updatePairVolumes(
    pairId: string,
    newTransactionValue: number,
    timestamp: Date
  ): Promise<VolumePeriods> {
    await this._updateHourlySnapshot(pairId, newTransactionValue, timestamp);
    return this._calculateVolumesFromSnapshots(pairId, timestamp);
  }

  /**
   * Update hourly snapshot for the pair
   */
  private async _updateHourlySnapshot(
    pairId: string,
    value: number,
    timestamp: Date
  ): Promise<void> {
    const currentHour = TimeUtils.roundToHour(timestamp);
    const snapshotId = `${pairId}:HOURLY:${currentHour.getTime()}`;

    // Try to get existing snapshot
    let snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      snapshot = await this.ctx.store.get(PairVolumeSnapshot, snapshotId);
    }

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

    // Store for batch saving
    this.snapshots.set(snapshotId, snapshot);
  }

  /**
   * Calculate volumes from hourly snapshots
   */
  private async _calculateVolumesFromSnapshots(
    pairId: string,
    currentTime: Date
  ): Promise<VolumePeriods> {
    const periods = TimeUtils.getVolumePeriods();
    const oneYearAgo = TimeUtils.getTimePeriods(currentTime).oneYearAgo;

    // Get all snapshots for the last year
    const allSnapshots = await this.ctx.store.find(PairVolumeSnapshot, {
      where: {
        pair: { id: pairId },
        interval: VolumeInterval.HOURLY,
        timestamp: MoreThanOrEqual(oneYearAgo),
      },
      order: { timestamp: "DESC" },
    });

    // Include pending snapshots from current processing
    const pendingSnapshots = Array.from(this.snapshots.values()).filter(
      (s) => s.pair.id === pairId
    );

    const allSnapshotsIncludingPending = [...allSnapshots, ...pendingSnapshots];

    const results: Partial<VolumePeriods> = {};

    // Calculate volumes for each period
    for (const period of periods) {
      const startTime = new Date(
        currentTime.getTime() - period.hours * 60 * 60 * 1000
      );

      results[period.key] = allSnapshotsIncludingPending
        .filter((s) => s.timestamp >= startTime)
        .reduce((sum, s) => sum + s.volumeUsd, 0);
    }

    return results as VolumePeriods;
  }

  /**
   * Save all accumulated snapshots
   */
  async saveSnapshots(): Promise<void> {
    const snapshots = Array.from(this.snapshots.values());
    if (snapshots.length > 0) {
      await this.ctx.store.save(snapshots);
      this.ctx.log.info({ count: snapshots.length }, "Saved volume snapshots");
    }
    this.snapshots.clear();
  }

  /**
   * Clear snapshots (call after saving)
   */
  clearBuffers(): void {
    this.snapshots.clear();
  }
}
