/**
 * MemoryMonitor - Tracks memory usage patterns
 */
class MemoryMonitor {
  constructor() {
    this.snapshots = [];
    this.maxSnapshots = 50;
    this.gcCount = 0;
  }

  takeSnapshot(context = "") {
    const mem = process.memoryUsage();
    const snapshot = {
      context,
      timestamp: Date.now(),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
    };

    this.snapshots.push(snapshot);

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    console.log(`[MEMORY] ${context}: ${snapshot.heapUsed}MB heap`);
    return snapshot;
  }

  getAnalysis() {
    if (this.snapshots.length === 0) return null;

    const heapValues = this.snapshots.map((s) => s.heapUsed);
    return {
      current: this.snapshots[this.snapshots.length - 1],
      average: Math.round(
        heapValues.reduce((a, b) => a + b, 0) / heapValues.length
      ),
      min: Math.min(...heapValues),
      max: Math.max(...heapValues),
      trend: this.snapshots.slice(-5),
      totalSnapshots: this.snapshots.length,
      gcCount: this.gcCount,
    };
  }

  forceGarbageCollection() {
    if (global.gc) {
      const before = process.memoryUsage().heapUsed;
      global.gc();
      const after = process.memoryUsage().heapUsed;
      const freed = Math.round((before - after) / 1024 / 1024);
      this.gcCount++;
      console.log(`[MEMORY] GC #${this.gcCount} freed ${freed}MB`);
      return freed;
    }
    console.log(`[MEMORY] GC not available - add --expose-gc to NODE_OPTIONS`);
    return 0;
  }

  shouldTriggerGC(thresholdMB = 100) {
    if (this.snapshots.length === 0) return false;
    const current = this.snapshots[this.snapshots.length - 1];
    return current.heapUsed > thresholdMB;
  }
}

module.exports = MemoryMonitor;
