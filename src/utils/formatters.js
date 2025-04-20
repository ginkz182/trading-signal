const dayjs = require("dayjs");

/**
 * Formatters for signal outputs with CDC Action Zone support
 */

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
    message += `((${signalSource} SIGNALS))\n`.toLowerCase();
  }

  // Format crypto signals
  if (Object.keys(signals.crypto).length > 0) {
    message += "\n💰<b> CRYPTO</b>\n";

    for (const [symbol, data] of Object.entries(signals.crypto)) {
      message += `${formatSignalEmoji(data.signal)} ${symbol}: ${
        data.signal
      }\n`;

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
      message += `${formatSignalEmoji(data.signal)} ${symbol}: ${
        data.signal
      }\n`;

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

module.exports = {
  formatSignals,
  formatSignalEmoji,
  formatZoneEmoji,
  formatTechnicalData,
};
