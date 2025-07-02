/**
 * ExchangeServicePool - Manages service lifecycle
 * This replaces your ExchangeFactory for better memory management
 */
const KuCoinDataService = require("./KuCoinDataService");
const YahooDataService = require("./YahooDataService");
const PolygonDataService = require("./PolygonDataService");

class ExchangeServicePool {
  constructor() {
    this.services = {};
    this.stats = {
      createdServices: 0,
      destroyedServices: 0,
      totalRequests: 0,
      lastCleanup: null,
    };

    console.log("[POOL] Exchange service pool initialized");
  }

  /**
   * Get or create a service instance
   */
  async getService(type, timeframe) {
    const serviceKey = `${type}-${timeframe}`;

    if (!this.services[serviceKey]) {
      console.log(`[POOL] Creating new ${type} service for ${timeframe}`);
      this.services[serviceKey] = this._createService(type, timeframe);
      this.stats.createdServices++;
    }

    this.stats.totalRequests++;
    return this.services[serviceKey];
  }

  _createService(type, timeframe) {
    switch (type.toLowerCase()) {
      case "kucoin":
        return new KuCoinDataService(timeframe);
      case "yahoo":
        return new YahooDataService(timeframe);
      case "polygon":
        return new PolygonDataService(timeframe);
      default:
        throw new Error(`Unsupported service type: ${type}`);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const serviceDetails = {};

    for (const [key, service] of Object.entries(this.services)) {
      if (service && service.getStats) {
        serviceDetails[key] = service.getStats();
      }
    }

    return {
      ...this.stats,
      activeServices: Object.keys(this.services).length,
      serviceKeys: Object.keys(this.services),
      serviceDetails,
    };
  }

  /**
   * Cleanup all services
   */
  async cleanup() {
    const serviceCount = Object.keys(this.services).length;
    console.log(`[POOL] Cleaning up ${serviceCount} services`);

    for (const [key, service] of Object.entries(this.services)) {
      try {
        if (service && service.destroy) {
          await service.destroy();
          this.stats.destroyedServices++;
        }
      } catch (error) {
        console.error(`[POOL] Error destroying service ${key}:`, error.message);
      }
    }

    this.services = {};
    this.stats.lastCleanup = new Date().toISOString();

    console.log(`[POOL] Cleanup complete - Stats:`, this.getStats());
  }

  /**
   * Clear caches on all active services
   */
  async clearAllCaches() {
    const serviceCount = Object.keys(this.services).length;
    console.log(`[POOL] Clearing caches on ${serviceCount} services`);
    
    for (const [key, service] of Object.entries(this.services)) {
      try {
        if (service && service.clearCache) {
          service.clearCache();
        }
      } catch (error) {
        console.error(`[POOL] Error clearing cache for service ${key}:`, error.message);
      }
    }
    
    console.log(`[POOL] Cache clearing complete`);
  }

  /**
   * Restart specific service type
   */
  async restartService(type, timeframe) {
    const serviceKey = `${type}-${timeframe}`;

    if (this.services[serviceKey]) {
      console.log(`[POOL] Restarting ${serviceKey} service`);

      if (this.services[serviceKey].destroy) {
        await this.services[serviceKey].destroy();
      }

      delete this.services[serviceKey];
      this.stats.destroyedServices++;
    }

    // Service will be recreated on next getService call
    console.log(`[POOL] Service ${serviceKey} marked for recreation`);
  }
}

module.exports = ExchangeServicePool;
