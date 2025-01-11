const technicalindicators = require('technicalindicators');

class TechnicalService {
  calculateMACD(prices) {
    return technicalindicators.MACD.calculate({
      values: prices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });
  }

  checkZeroCross(macdValues) {
    if (macdValues.length < 2) return 'HOLD';

    const current = macdValues[macdValues.length - 1].MACD;
    const previous = macdValues[macdValues.length - 2].MACD;

    if (previous < 0 && current > 0) return 'BUY';
    if (previous > 0 && current < 0) return 'SELL';
    return 'HOLD';
  }
}

module.exports = TechnicalService;
