const KuCoinService = require("./data/KuCoinDataService");
const YahooService = require("./data/YahooDataService");

/**
 * ValidationService
 * Validates assets against external exchanges (KuCoin, Yahoo) to determine existence and type.
 */
class ValidationService {
    constructor() {
        // We use 1d timeframe for validation as it's standard
        this.kucoinService = new KuCoinService("1d");
        this.yahooService = new YahooService("1d");
    }

    /**
     * Validates a symbol and determines its type (crypto vs stock)
     * Strategy:
     * 1. Check KuCoin (Exact match) -> 'crypto'
     * 2. Check KuCoin (Append /USDT) -> 'crypto'
     * 3. Check Yahoo (Exact match) -> 'stock'
     * 4. Return { isValid: false }
     * 
     * @param {string} symbol - The symbol to validate (e.g. "BTC", "BTC/USDT", "AAPL")
     * @returns {Promise<{isValid: boolean, type: string, formattedSymbol: string}>}
     */
    async validate(symbol) {
        const rawSymbol = symbol.trim().toUpperCase();

        // 1. Crypto Check (Exact)
        const isCryptoExact = await this.kucoinService.validateSymbol(rawSymbol);
        if (isCryptoExact) {
            return { isValid: true, type: 'crypto', formattedSymbol: rawSymbol };
        }

        // 2. Crypto Check (Smart Suffix)
        // If it doesn't already have a slash, try adding /USDT
        if (!rawSymbol.includes('/')) {
            const suffixedSymbol = `${rawSymbol}/USDT`;
            const isCryptoSuffixed = await this.kucoinService.validateSymbol(suffixedSymbol);
            if (isCryptoSuffixed) {
                return { isValid: true, type: 'crypto', formattedSymbol: suffixedSymbol };
            }
        }

        // 3. Stock Check
        try {
            const isStock = await this.yahooService.validateSymbol(rawSymbol);
            if (isStock) {
                return { isValid: true, type: 'stock', formattedSymbol: rawSymbol };
            }
        } catch (e) {
            console.error("Yahoo validation error:", e.message);
        }




        


        // 4. Not Found
        return { isValid: false };
    }
}

module.exports = ValidationService;
