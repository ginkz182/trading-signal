const axios = require('axios');

/**
 * Polygon.io Data Service using bulk API
 * Gets all stocks AND crypto in bulk calls to stay within rate limits
 */
class PolygonDataService {
  constructor(timeframe) {
    this.timeframe = timeframe;
    this.apiKey = process.env.POLYGON_API_KEY;
    this.baseUrl = 'https://api.polygon.io';
    this.stockCache = new Map(); // Cache bulk stock data
    this.cryptoCache = new Map(); // Cache bulk crypto data
    this.lastFetchDate = null;
    
    if (!this.apiKey) {
      console.warn('[POLYGON] API key not found. Set POLYGON_API_KEY environment variable');
    }
    
    console.log(`[MEMORY] Created persistent PolygonService instance`);
  }

  async fetchBulkData() {
    if (!this.apiKey) {
      console.error('[POLYGON] API key required');
      return false;
    }

    try {
      // Get yesterday's date (market data is usually available next day)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      // Check if we already have stock data for this date
      if (this.lastFetchDate === dateStr && this.stockCache.size > 0) {
        console.log(`[POLYGON] Using cached stock data from ${dateStr}`);
        return true;
      }

      console.log(`[POLYGON] Fetching bulk market data for ${dateStr}...`);
      
      const url = `${this.baseUrl}/v2/aggs/grouped/locale/us/market/stocks/${dateStr}`;
      
      const response = await axios.get(url, {
        params: {
          apikey: this.apiKey,
          adjusted: 'true'
        }
      });

      if (response.data.status !== 'OK') {
        console.error(`[POLYGON] Bulk API error: ${response.data.status}`);
        return false;
      }

      const results = response.data.results;
      if (!results || results.length === 0) {
        console.error(`[POLYGON] No bulk data for ${dateStr}`);
        return false;
      }

      // Cache the stock data by symbol
      this.stockCache.clear();
      results.forEach(stock => {
        this.stockCache.set(stock.T, stock); // T = ticker symbol
      });

      this.lastFetchDate = dateStr;
      console.log(`[POLYGON] Cached ${results.length} stocks from bulk API`);
      return true;

    } catch (error) {
      if (error.response?.status === 429) {
        console.error(`[POLYGON] Rate limited on bulk API`);
      } else {
        console.error(`[POLYGON] Bulk API error:`, error.message);
      }
      return false;
    }
  }

  async getPrices(symbol) {
    // Convert crypto symbols to Polygon format if needed
    const polygonSymbol = this.convertToPolygonSymbol(symbol);
    
    // Get historical data for EMA calculation
    return await this.getHistoricalPrices(polygonSymbol);
  }

  // NEW: Bulk fetch all symbols at once
  async getBulkPrices(symbols) {
    if (!this.apiKey) {
      console.error('[POLYGON] API key required for bulk fetch');
      return {};
    }

    const results = {};
    const stockSymbols = [];
    const cryptoSymbols = [];

    // Separate stocks from crypto
    symbols.forEach(symbol => {
      if (symbol.includes('/')) {
        cryptoSymbols.push(symbol);
      } else {
        stockSymbols.push(symbol);
      }
    });

    console.log(`[POLYGON] Bulk fetch: ${stockSymbols.length} stocks, ${cryptoSymbols.length} crypto`);

    // Process all stocks with minimal API calls
    if (stockSymbols.length > 0) {
      const stockResults = await this.getBulkStockPrices(stockSymbols);
      Object.assign(results, stockResults);
    }

    // Process all crypto with minimal API calls  
    if (cryptoSymbols.length > 0) {
      const cryptoResults = await this.getBulkCryptoPrices(cryptoSymbols);
      Object.assign(results, cryptoResults);
    }

    return results;
  }

  async getBulkStockPrices(symbols) {
    const results = {};
    
    console.log(`[POLYGON] Using optimized batch processing for ${symbols.length} stocks...`);
    
    // Create batches to respect rate limits (5 calls/minute = ~12s apart)
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      batches.push(symbols.slice(i, i + BATCH_SIZE));
    }
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`[POLYGON] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} symbols)`);
      
      // Process batch in parallel (within rate limits)
      const batchPromises = batch.map(async (symbol) => {
        try {
          const prices = await this.getHistoricalPrices(symbol);
          if (prices) {
            console.log(`[POLYGON] ✓ ${symbol}: ${prices.length} points`);
            return { symbol, prices };
          } else {
            console.log(`[POLYGON] ✗ ${symbol}: No data`);
            return { symbol, prices: null };
          }
        } catch (error) {
          console.error(`[POLYGON] Error fetching ${symbol}:`, error.message);
          return { symbol, prices: null };
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Add to results
      batchResults.forEach(({ symbol, prices }) => {
        results[symbol] = prices;
      });
      
      // Rate limit between batches (if not last batch)
      if (batchIndex < batches.length - 1) {
        console.log(`[POLYGON] Waiting 12s before next batch...`);
        await this.sleep(12000);
      }
    }

    return results;
  }

  async getBulkCryptoPrices(symbols) {
    const results = {};
    
    console.log(`[POLYGON] Fetching historical data for ${symbols.length} crypto pairs...`);
    
    for (const symbol of symbols) {
      try {
        const polygonSymbol = this.convertToPolygonSymbol(symbol);
        const prices = await this.getHistoricalPrices(polygonSymbol);
        if (prices) {
          results[symbol] = prices;
          console.log(`[POLYGON] ✓ ${symbol}: ${prices.length} points`);
        } else {
          console.log(`[POLYGON] ✗ ${symbol}: No data`);
          results[symbol] = null;
        }
      } catch (error) {
        console.error(`[POLYGON] Error fetching ${symbol}:`, error.message);
        results[symbol] = null;
      }
    }

    return results;
  }

  convertToPolygonSymbol(symbol) {
    // Convert crypto pairs like "BTC/USDT" to Polygon format "X:BTCUSD"
    if (symbol.includes('/')) {
      const [base, quote] = symbol.split('/');
      // Convert USDT to USD for Polygon
      const polygonQuote = quote === 'USDT' ? 'USD' : quote;
      return `X:${base}${polygonQuote}`;
    }
    
    // Already a stock symbol, return as-is
    return symbol;
  }

  async fetchBulkCrypto() {
    if (!this.apiKey) {
      console.error('[POLYGON] API key required');
      return false;
    }

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      // Check if we already have crypto data for this date
      if (this.lastFetchDate === dateStr && this.cryptoCache.size > 0) {
        console.log(`[POLYGON] Using cached crypto data from ${dateStr}`);
        return true;
      }

      console.log(`[POLYGON] Fetching bulk crypto data for ${dateStr}...`);
      
      const url = `${this.baseUrl}/v2/aggs/grouped/locale/global/market/crypto/${dateStr}`;
      
      const response = await axios.get(url, {
        params: {
          apikey: this.apiKey,
          adjusted: 'true'
        }
      });

      if (response.data.status !== 'OK' && response.data.status !== 'DELAYED') {
        console.error(`[POLYGON] Bulk crypto API error: ${response.data.status}`);
        return false;
      }

      const results = response.data.results;
      if (!results || results.length === 0) {
        console.error(`[POLYGON] No bulk crypto data for ${dateStr}`);
        return false;
      }

      // Cache the crypto data by symbol
      this.cryptoCache.clear();
      results.forEach(crypto => {
        this.cryptoCache.set(crypto.T, crypto); // T = ticker symbol
      });

      console.log(`[POLYGON] Cached ${results.length} crypto pairs from bulk API`);
      return true;

    } catch (error) {
      if (error.response?.status === 429) {
        console.error(`[POLYGON] Rate limited on bulk crypto API`);
      } else {
        console.error(`[POLYGON] Bulk crypto API error:`, error.message);
      }
      return false;
    }
  }

  async getHistoricalPrices(symbol) {
    if (!this.apiKey) {
      console.error('[POLYGON] API key required');
      return null;
    }

    try {
      // For historical data, we still need individual calls
      // But we'll add delays to respect rate limits
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const url = `${this.baseUrl}/v2/aggs/ticker/${symbol}/range/1/day/${startDate}/${endDate}`;
      
      const response = await axios.get(url, {
        params: {
          apikey: this.apiKey,
          adjusted: 'true',
          sort: 'asc',
          limit: 300
        }
      });

      if (response.data.status !== 'OK' && response.data.status !== 'DELAYED') {
        console.error(`[POLYGON] Error for ${symbol}: ${response.data.status}`);
        return null;
      }
      
      if (response.data.status === 'DELAYED') {
        console.log(`[POLYGON] ${symbol}: Using delayed data (free tier)`);
      }

      const results = response.data.results;
      if (!results || results.length === 0) {
        console.error(`[POLYGON] No historical data for ${symbol}`);
        return null;
      }

      // Extract closing prices
      const prices = results.map(bar => bar.c);
      
      console.log(`[POLYGON] ${symbol}: Retrieved ${prices.length} historical points`);
      return prices;

    } catch (error) {
      if (error.response?.status === 429) {
        console.error(`[POLYGON] Rate limited for ${symbol} - waiting...`);
        await this.sleep(15000); // Wait 15 seconds
        return await this.getHistoricalPrices(symbol); // Retry once
      } else {
        console.error(`[POLYGON] Failed to fetch ${symbol}:`, error.message);
      }
      return null;
    }
  }

  async rateLimitDelay() {
    // Wait 12 seconds between calls (5 calls/min = 12s apart)
    await this.sleep(12000);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearCache() {
    this.stockCache.clear();
    this.cryptoCache.clear();
    this.lastFetchDate = null;
    console.log(`[MEMORY] Polygon cache cleared`);
  }

  cleanup() {
    this.clearCache();
    console.log(`[MEMORY] Polygon cleanup`);
    this.apiKey = null;
  }
}

module.exports = PolygonDataService;