const dayjs = require("dayjs");

/**
 * Formatters for signal outputs with CDC Action Zone support
 */

/**
 * Symbol display name mapping for better readability
 */
const SYMBOL_DISPLAY_NAMES = {
  'GC=F': 'GOLD',
  // Add more mappings as needed
};

/**
 * Get display name for a symbol
 * @param {string} symbol - Original symbol
 * @returns {string} - Display name or original symbol
 */
function getSymbolDisplayName(symbol) {
  return SYMBOL_DISPLAY_NAMES[symbol] || symbol;
}

/**
 * Format signals into a readable message
 * @param {Object} signals - Signal data organized by market type
 * @param {Object} options - Formatting options
 * @param {string} options.signalSource - Source of signals (e.g., "CURRENT", "PREVIOUS DAY")
 * @returns {string} - Formatted message
 */
function formatSignals(signals, options = {}) {
  const { signalSource = "CURRENT" } = options;

  let message = `🔔<b> CDC ACTION ZONE ALERT</b> 🔔\n🗓️ ${dayjs().format(
    "D MMM"
  )}\n`;

  // Add signal source indicator if provided
  if (signalSource !== "CURRENT") {
    message += `((${signalSource} signals))\n`.toLowerCase();
  }

  // Format crypto signals
  if (Object.keys(signals.crypto).length > 0) {
    message += "\n💰<b> CRYPTO</b>\n";

    for (const [symbol, data] of Object.entries(signals.crypto)) {
      const price = formatPrice(data.price, "crypto");
      const displayName = getSymbolDisplayName(symbol);
      message += `${formatSignalEmoji(data.signal)} ${displayName}: ${
        data.signal
      } @ ${price}`;

      // Add pattern information if available
      if (data.pattern && data.pattern.pattern) {
        const patternEmoji = getPatternEmoji(data.pattern.pattern);
        const confidenceEmoji = getConfidenceEmoji(data.pattern.confidence);
        message += `\n  ${patternEmoji} ${formatPatternName(data.pattern.pattern)} (${data.pattern.confidence}%${confidenceEmoji})`;
        
        // Add breakout status if available
        if (data.pattern.breakout && data.pattern.breakout.status !== 'FORMING') {
          const breakoutEmoji = getBreakoutEmoji(data.pattern.breakout.status);
          message += `\n  ${breakoutEmoji} ${formatBreakoutStatus(data.pattern.breakout.status)}`;
        }

        // Add trading plan alerts if available
        if (data.pattern.tradingPlan && data.pattern.tradingPlan.alerts) {
          for (const alert of data.pattern.tradingPlan.alerts.slice(0, 1)) { // Show only the first alert to keep message concise
            message += `\n  💡 ${alert.message}`;
          }
        }
      }

      // Add combined signal confidence if available
      if (data.details && data.details.combined && data.details.combined.confidence) {
        const confidence = data.details.combined.confidence;
        if (confidence !== 60) { // Show only if different from base confidence
          const confidenceEmoji = getConfidenceEmoji(confidence);
          message += `\n  🎯 Confidence: ${confidence}%${confidenceEmoji}`;
        }
      }

      message += `\n`;

      /**
      message += `  Price: ${data.price.toFixed(3)}\n`;

      // Add CDC Action Zone information
      if (data.zone) {
        message += `  Zone: ${formatZoneEmoji(data.zone)} ${data.zone}\n`;
      }

      // Add EMA values if available
      if (data.fastEMA) {
        message += `  EMA12: ${data.fastEMA.toFixed(3)}\n`;
      }
      if (data.slowEMA) {
        message += `  EMA26: ${data.slowEMA.toFixed(3)}\n`;
      }

      if (data.previousDayPrice) {
        const change =
          ((data.price - data.previousDayPrice) / data.previousDayPrice) * 100;
        message += `  Change from signal: ${change.toFixed(
          2
        )}% (from ${data.previousDayPrice.toFixed(3)})\n`;
      }

      message += `  MACD: ${data.macd.toFixed(5)}\n`;
      */
    }
  }

  // Format stock signals
  if (Object.keys(signals.stocks).length > 0) {
    message += "\n<b>📈 STOCKS</b>\n";

    for (const [symbol, data] of Object.entries(signals.stocks)) {
      const price = formatPrice(data.price, "stock");
      const displayName = getSymbolDisplayName(symbol);
      message += `${formatSignalEmoji(data.signal)} ${displayName}: ${
        data.signal
      } @ ${price}`;

      // Add pattern information if available
      if (data.pattern && data.pattern.pattern) {
        const patternEmoji = getPatternEmoji(data.pattern.pattern);
        const confidenceEmoji = getConfidenceEmoji(data.pattern.confidence);
        message += `\n  ${patternEmoji} ${formatPatternName(data.pattern.pattern)} (${data.pattern.confidence}%${confidenceEmoji})`;
        
        // Add breakout status if available
        if (data.pattern.breakout && data.pattern.breakout.status !== 'FORMING') {
          const breakoutEmoji = getBreakoutEmoji(data.pattern.breakout.status);
          message += `\n  ${breakoutEmoji} ${formatBreakoutStatus(data.pattern.breakout.status)}`;
        }

        // Add trading plan alerts if available
        if (data.pattern.tradingPlan && data.pattern.tradingPlan.alerts) {
          for (const alert of data.pattern.tradingPlan.alerts.slice(0, 1)) { // Show only the first alert to keep message concise
            message += `\n  💡 ${alert.message}`;
          }
        }
      }

      // Add combined signal confidence if available
      if (data.details && data.details.combined && data.details.combined.confidence) {
        const confidence = data.details.combined.confidence;
        if (confidence !== 60) { // Show only if different from base confidence
          const confidenceEmoji = getConfidenceEmoji(confidence);
          message += `\n  🎯 Confidence: ${confidence}%${confidenceEmoji}`;
        }
      }

      message += `\n`;

      /**
      message += `  Price: ${data.price.toFixed(2)}\n`;

      // Add CDC Action Zone information
      if (data.zone) {
        message += `  Zone: ${formatZoneEmoji(data.zone)} ${data.zone}\n`;
      }

      // Add EMA values if available
      if (data.fastEMA) {
        message += `  EMA12: ${data.fastEMA.toFixed(2)}\n`;
      }
      if (data.slowEMA) {
        message += `  EMA26: ${data.slowEMA.toFixed(2)}\n`;
      }

      if (data.previousDayPrice) {
        const change =
          ((data.price - data.previousDayPrice) / data.previousDayPrice) * 100;
        message += `  Change from signal: ${change.toFixed(
          2
        )}% (from ${data.previousDayPrice.toFixed(2)})\n`;
      }

      message += `  MACD: ${data.macd.toFixed(5)}\n`;
      */
    }
  }

  return message;
}

/**
 * Format price based on asset type
 * @param {number} price - Price value
 * @param {string} assetType - 'crypto' or 'stock'
 * @returns {string} - Formatted price
 */
function formatPrice(price, assetType = "crypto") {
  if (!price || isNaN(price)) return "N/A";

  const numPrice = parseFloat(price);

  if (assetType === "crypto") {
    // Crypto prices - smart formatting
    if (numPrice >= 1000) {
      return `$${numPrice.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })}`;
    } else if (numPrice >= 1) {
      return `$${numPrice.toFixed(4)}`;
    } else if (numPrice >= 0.01) {
      return `$${numPrice.toFixed(6)}`;
    } else {
      return `$${numPrice.toFixed(8)}`;
    }
  } else {
    // Stock prices - 2 decimal places
    return `$${numPrice.toFixed(2)}`;
  }
}

/**
 * Get emoji based on signal type
 * @param {string} signal - Signal type
 * @returns {string} - Corresponding emoji
 */
function formatSignalEmoji(signal) {
  switch (signal) {
    case "BUY":
      return "🟢";
    case "SELL":
      return "🔴";
    case "WATCH":
      return "👀";
    default:
      return "⚪";
  }
}

/**
 * Get emoji based on CDC Action Zone color
 * @param {string} zone - CDC Action Zone color
 * @returns {string} - Corresponding emoji
 */
function formatZoneEmoji(zone) {
  switch (zone) {
    case "GREEN":
      return "🟢"; // Buy
    case "BLUE":
      return "🔵"; // Pre Buy 2
    case "LIGHT_BLUE":
      return "🔹"; // Pre Buy 1
    case "RED":
      return "🔴"; // Sell
    case "ORANGE":
      return "🟠"; // Pre Sell 2
    case "YELLOW":
      return "🟡"; // Pre Sell 1
    default:
      return "⚪";
  }
}

/**
 * Format technical data for debugging
 * @param {Object} data - Technical indicator data
 * @returns {string} - Formatted technical data string
 */
function formatTechnicalData(data) {
  if (!data) return "No technical data available";

  let result = "Technical Data:\n";

  if (data.cdc) {
    result += "CDC Action Zone:\n";
    result += `  Buy Condition: ${data.cdc.buyCond}\n`;
    result += `  Sell Condition: ${data.cdc.sellCond}\n`;
    result += `  Is Green: ${data.cdc.isGreen}\n`;
    result += `  Was Green: ${data.cdc.wasGreen}\n`;
    result += `  Is Red: ${data.cdc.isRed}\n`;
    result += `  Was Red: ${data.cdc.wasRed}\n`;
  }

  if (data.macd) {
    result += "MACD:\n";
    result += `  Signal: ${data.macd.signal}\n`;
    result += `  Value: ${data.macd.macd}\n`;
  }

  return result;
}

/**
 * Get emoji for triangle pattern type
 * @param {string} pattern - Pattern type
 * @returns {string} - Pattern emoji
 */
function getPatternEmoji(pattern) {
  switch (pattern) {
    case 'ASCENDING_TRIANGLE':
      return '📈'; // Bullish pattern
    case 'DESCENDING_TRIANGLE':
      return '📉'; // Bearish pattern
    case 'SYMMETRICAL_TRIANGLE':
      return '🔺'; // Neutral pattern
    default:
      return '📊'; // Generic pattern
  }
}

/**
 * Format pattern name for display
 * @param {string} pattern - Pattern type
 * @returns {string} - Formatted pattern name
 */
function formatPatternName(pattern) {
  switch (pattern) {
    case 'ASCENDING_TRIANGLE':
      return 'Ascending Triangle';
    case 'DESCENDING_TRIANGLE':
      return 'Descending Triangle';
    case 'SYMMETRICAL_TRIANGLE':
      return 'Symmetrical Triangle';
    default:
      return pattern.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }
}

/**
 * Get emoji for confidence level
 * @param {number} confidence - Confidence percentage
 * @returns {string} - Confidence emoji
 */
function getConfidenceEmoji(confidence) {
  if (confidence >= 85) return ' 🔥'; // Very high confidence
  if (confidence >= 75) return ' ✨'; // High confidence
  if (confidence >= 65) return ' ⭐'; // Good confidence
  if (confidence >= 50) return ' 🌟'; // Medium confidence
  return ' ⚠️'; // Low confidence
}

/**
 * Get emoji for breakout status
 * @param {string} status - Breakout status
 * @returns {string} - Breakout emoji
 */
function getBreakoutEmoji(status) {
  switch (status) {
    case 'BREAKOUT_UP':
      return '🚀'; // Bullish breakout
    case 'BREAKOUT_DOWN':
      return '💥'; // Bearish breakout
    case 'APPROACHING_RESISTANCE':
      return '⬆️'; // Approaching resistance
    case 'APPROACHING_SUPPORT':
      return '⬇️'; // Approaching support
    default:
      return '🔍'; // Generic status
  }
}

/**
 * Format breakout status for display
 * @param {string} status - Breakout status
 * @returns {string} - Formatted status
 */
function formatBreakoutStatus(status) {
  switch (status) {
    case 'BREAKOUT_UP':
      return 'Bullish Breakout';
    case 'BREAKOUT_DOWN':
      return 'Bearish Breakout';
    case 'APPROACHING_RESISTANCE':
      return 'Approaching Resistance';
    case 'APPROACHING_SUPPORT':
      return 'Approaching Support';
    default:
      return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }
}

module.exports = {
  formatSignals,
  formatSignalEmoji,
  formatZoneEmoji,
  formatTechnicalData,
  formatPrice,
  getPatternEmoji,
  formatPatternName,
  getConfidenceEmoji,
  getBreakoutEmoji,
  formatBreakoutStatus,
};
