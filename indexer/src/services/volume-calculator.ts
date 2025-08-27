import { MoreThanOrEqual } from "typeorm";
import { ProcessorContext } from "../processor";
import { PairVolumeSnapshot, VolumeInterval } from "../model";

interface VolumeBuffer {
  currentHour: Date;
  hourlyVolume: number;
  totalSessionVolume: number;
  transactionCount: number;
}

interface VolumeCache {
  volume1h: number;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  volume1y: number;
  lastCacheUpdate: Date;
  cacheValidUntil: Date;
}

export class VolumeCalculator {
  private ctx: ProcessorContext;
  private snapshots: Map<string, PairVolumeSnapshot> = new Map();
  private volumeBuffers: Map<string, VolumeBuffer> = new Map();
  private volumeCaches: Map<string, VolumeCache> = new Map();

  constructor(ctx: ProcessorContext) {
    this.ctx = ctx;
  }

  /**
   * Updates pair volumes with minimal DB queries
   * Only queries DB on hour change or first run
   * TODO: if app crashes, we need to recalculate volumes from snapshots
   */
  async updatePairVolumes(
    pairId: string,
    newTransactionValue: number,
    timestamp: Date
  ): Promise<{
    volume1h: number;
    volume24h: number;
    volume7d: number;
    volume30d: number;
    volume1y: number;
  }> {
    const currentHour = this._roundToHour(timestamp);

    // Get or create buffer for this pair
    let buffer = this.volumeBuffers.get(pairId);
    if (!buffer) {
      buffer = {
        currentHour,
        hourlyVolume: 0,
        totalSessionVolume: 0,
        transactionCount: 0,
      };
      this.volumeBuffers.set(pairId, buffer);
    }

    // Check if hour has changed
    const isNewHour = currentHour.getTime() !== buffer.currentHour.getTime();

    if (isNewHour) {
      // Save accumulated volume for the previous hour
      await this._flushHourlyVolume(pairId, buffer);

      // Move to new hour
      buffer.currentHour = currentHour;
      buffer.hourlyVolume = newTransactionValue;

      // Invalidate cache - recalculation needed
      this.volumeCaches.delete(pairId);
    } else {
      // Simply add to current hour
      buffer.hourlyVolume += newTransactionValue;
    }

    // Update general counters
    buffer.totalSessionVolume += newTransactionValue;
    buffer.transactionCount += 1;

    // Get updated volumes
    const volumes = await this._calculateVolumesFromCache(pairId, timestamp);

    return volumes;
  }

  /**
   * Gets volumes using cache + incremental updates
   */
  private async _calculateVolumesFromCache(
    pairId: string,
    currentTime: Date
  ): Promise<{
    volume1h: number;
    volume24h: number;
    volume7d: number;
    volume30d: number;
    volume1y: number;
  }> {
    // If cache is stale or doesn't exist, refresh it
    const cache = this.volumeCaches.get(pairId);
    if (!cache || new Date() > cache.cacheValidUntil) {
      await this._refreshVolumeCache(pairId, currentTime);
    }

    const updatedCache = this.volumeCaches.get(pairId);
    const buffer = this.volumeBuffers.get(pairId);

    if (updatedCache && buffer) {
      // Return cached values + current session buffer
      return {
        volume1h: updatedCache.volume1h + buffer.totalSessionVolume,
        volume24h: updatedCache.volume24h + buffer.totalSessionVolume,
        volume7d: updatedCache.volume7d + buffer.totalSessionVolume,
        volume30d: updatedCache.volume30d + buffer.totalSessionVolume,
        volume1y: updatedCache.volume1y + buffer.totalSessionVolume,
      };
    }

    // Fallback: if cache creation failed
    return {
      volume1h: buffer?.totalSessionVolume || 0,
      volume24h: buffer?.totalSessionVolume || 0,
      volume7d: buffer?.totalSessionVolume || 0,
      volume30d: buffer?.totalSessionVolume || 0,
      volume1y: buffer?.totalSessionVolume || 0,
    };
  }

  /**
   * Refreshes volume cache (called rarely!)
   */
  private async _refreshVolumeCache(
    pairId: string,
    currentTime: Date
  ): Promise<void> {
    const volumes = await this._calculateVolumesFromSnapshots(
      pairId,
      currentTime
    );

    const cache: VolumeCache = {
      ...volumes,
      lastCacheUpdate: currentTime,
      cacheValidUntil: new Date(currentTime.getTime() + 15 * 60 * 1000), // Cache for 15 minutes
    };

    this.volumeCaches.set(pairId, cache);
  }

  /**
   * Fast volume calculation from hourly snapshots
   * ONE query for all periods!
   */
  private async _calculateVolumesFromSnapshots(
    pairId: string,
    currentTime: Date
  ): Promise<{
    volume1h: number;
    volume24h: number;
    volume7d: number;
    volume30d: number;
    volume1y: number;
  }> {
    const periods = [
      { key: "volume1h", hours: 1 },
      { key: "volume24h", hours: 24 },
      { key: "volume7d", hours: 24 * 7 },
      { key: "volume30d", hours: 24 * 30 },
      { key: "volume1y", hours: 24 * 365 },
    ];

    // ONE query for all periods (last year)
    const oneYearAgo = new Date(
      currentTime.getTime() - 365 * 24 * 60 * 60 * 1000
    );
    const allSnapshots = await this.ctx.store.find(PairVolumeSnapshot, {
      where: {
        pair: { id: pairId },
        interval: VolumeInterval.HOURLY,
        timestamp: MoreThanOrEqual(oneYearAgo),
      },
      order: { timestamp: "DESC" },
    });

    const results: any = {};

    // Group by periods in memory
    for (const period of periods) {
      const startTime = new Date(
        currentTime.getTime() - period.hours * 60 * 60 * 1000
      );

      results[period.key] = allSnapshots
        .filter((s) => s.timestamp >= startTime)
        .reduce((sum, s) => sum + s.volumeUsd, 0);
    }

    return results;
  }

  /**
   * Flushes accumulated hourly volume to DB
   */
  private async _flushHourlyVolume(
    pairId: string,
    buffer: VolumeBuffer
  ): Promise<void> {
    if (buffer.hourlyVolume <= 0) return;

    const snapshotId = `${pairId}:HOURLY:${buffer.currentHour.getTime()}`;

    // Try to get existing snapshot from cache or DB
    let snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      snapshot = await this.ctx.store.get(PairVolumeSnapshot, snapshotId);
    }

    if (snapshot) {
      // Update existing
      snapshot.volumeUsd += buffer.hourlyVolume;
      snapshot.transactionCount += buffer.transactionCount;
    } else {
      // Create new
      snapshot = new PairVolumeSnapshot({
        id: snapshotId,
        pair: { id: pairId } as any,
        interval: VolumeInterval.HOURLY,
        volumeUsd: buffer.hourlyVolume,
        transactionCount: buffer.transactionCount,
        timestamp: buffer.currentHour,
        createdAt: new Date(),
      });
    }

    // Add to cache for saving
    this.snapshots.set(snapshotId, snapshot);

    this.ctx.log.info(
      {
        snapshotId,
        volume: buffer.hourlyVolume,
        transactions: buffer.transactionCount,
      },
      "Prepared hourly volume snapshot for saving"
    );

    // Reset buffer counters
    buffer.hourlyVolume = 0;
    buffer.transactionCount = 0;
  }

  /**
   * Flushes current hourly buffer for all pairs
   */
  async flushAllBuffers(): Promise<void> {
    for (const [pairId, buffer] of this.volumeBuffers.entries()) {
      if (buffer.hourlyVolume > 0) {
        await this._flushHourlyVolume(pairId, buffer);
      }
    }
  }

  /**
   * Saves all accumulated snapshots
   */
  async saveSnapshots(): Promise<void> {
    const snapshots = Array.from(this.snapshots.values());
    if (snapshots.length > 0) {
      await this.ctx.store.save(snapshots);
    }
    this.snapshots.clear();
  }

  /**
   * Clears buffers (call after block processing)
   */
  clearBuffers(): void {
    // DON'T clear volumeBuffers and volumeCaches - they should persist between blocks
    // Only clear snapshots after saving
    this.snapshots.clear();
  }

  /**
   * Cleanup old snapshots (run periodically)
   */
  async cleanupOldSnapshots(): Promise<void> {
    // TODO: implement (delete old snapshots)
    //     const oneYearAgo = new Date();
    //     oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    //     const deletedCount = await this.ctx.store.delete(PairVolumeSnapshot, {
    //       timestamp: MoreThanOrEqual(oneYearAgo),
    //     });
    //     this.ctx.log.info({ deletedCount }, "Cleaned up old volume snapshots");
  }

  private _roundToHour(date: Date): Date {
    const rounded = new Date(date);
    rounded.setMinutes(0, 0, 0);
    return rounded;
  }
}
