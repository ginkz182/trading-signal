const dayjs = require('dayjs');

function formatSignals(signals) {
  const now = dayjs().format('DD MMM YYYY');
  let message = `\n🎯 Trading Signals - ${now}\n\n`;

  if (Object.keys(signals.crypto).length > 0) {
    message += '💰 Crypto Signals:\n';
    Object.entries(signals.crypto).forEach(([symbol, data]) => {
      const emoji = data.signal === 'BUY' ? '🟢' : '🔴';
      //const formattedPrice = typeof data.price === 'number' ?
       // data.price.toFixed(data.price < 1 ? 6 : 2) : 'N/A';
      message += `${emoji} ${symbol}: ${data.signal}\n`;
    });
    message += '\n';
  }

  if (Object.keys(signals.stocks).length > 0) {
    message += '📈 Stock Signals:\n';
    Object.entries(signals.stocks).forEach(([symbol, data]) => {
      const emoji = data.signal === 'BUY' ? '🟢' : '🔴';
      //const formattedPrice = typeof data.price === 'number' ?
       // data.price.toFixed(2) : 'N/A';
      message += `${emoji} ${symbol}: ${data.signal}\n`;
    });
  }

  return message;
}

module.exports = {
  formatSignals
};
