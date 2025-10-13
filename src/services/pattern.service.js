/**
 * PatternService - Advanced chart pattern detection
 * Focus: Triangle patterns (Ascending, Descending, Symmetrical)
 */
class PatternService {
  constructor(config = {}) {
    this.config = {
      // Triangle detection parameters
      minBars: config.minBars || 20, // Minimum bars needed to form a triangle
      maxBars: config.maxBars || 100, // Maximum bars to look back
      tolerance: config.tolerance || 0.02, // 2% tolerance for trendline validation
      minTouchPoints: config.minTouchPoints || 3, // Minimum touch points per trendline
      volumeConfirmation: config.volumeConfirmation || true,
      
      // Breakout detection
      breakoutThreshold: config.breakoutThreshold || 0.015, // 1.5% breakout threshold
      volumeBreakoutMultiplier: config.volumeBreakoutMultiplier || 1.5,
    };
  }

  /**
   * Detect all triangle patterns in OHLCV data
   * @param {Array} ohlcvData - Array of [timestamp, open, high, low, close, volume]
   * @param {String} symbol - Symbol identifier
   * @returns {Object} - Pattern detection results
   */
  detectTriangles(ohlcvData, symbol) {
    if (!ohlcvData || ohlcvData.length < this.config.minBars) {
      return { pattern: null, confidence: 0, reason: 'Insufficient data' };
    }

    // Extract price and volume data
    const priceData = this._extractPriceData(ohlcvData);
    const recentData = priceData.slice(-this.config.maxBars);

    // Detect different triangle types
    const ascending = this._detectAscendingTriangle(recentData);
    const descending = this._detectDescendingTriangle(recentData);
    const symmetrical = this._detectSymmetricalTriangle(recentData);

    // Find the pattern with highest confidence
    const patterns = [ascending, descending, symmetrical].filter(p => p.pattern);
    
    if (patterns.length === 0) {
      return { pattern: null, confidence: 0, reason: 'No triangle patterns detected' };
    }

    // Return the most confident pattern
    const bestPattern = patterns.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    // Add breakout analysis
    bestPattern.breakout = this._analyzeBreakout(recentData, bestPattern);

    // Validate pattern has reasonable dimensions before generating trading plan
    if (bestPattern.breakout) {
      const { resistancePrice, supportPrice } = bestPattern.breakout;
      const triangleHeight = Math.abs(resistancePrice - supportPrice);
      const heightPercent = triangleHeight / supportPrice;

      // Reject patterns where triangle is wider than 40% of price (too risky/unreliable)
      if (heightPercent > 0.40) {
        console.log(`[PATTERN] ${symbol}: ${bestPattern.pattern} rejected - triangle too wide (${(heightPercent * 100).toFixed(1)}% height)`);
        return { pattern: null, confidence: 0, reason: 'Triangle pattern too wide for reliable trading' };
      }
    }

    bestPattern.tradingPlan = this._generateTradingPlan(bestPattern, recentData);

    console.log(`[PATTERN] ${symbol}: ${bestPattern.pattern} triangle detected (${bestPattern.confidence}% confidence)`);

    return bestPattern;
  }

  /**
   * Extract OHLC data from OHLCV array
   */
  _extractPriceData(ohlcvData) {
    return ohlcvData.map((candle, index) => ({
      index,
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5] || 0
    }));
  }

  /**
   * Detect ascending triangle pattern
   * Characteristics: Horizontal resistance, ascending support
   */
  _detectAscendingTriangle(priceData) {
    const highs = priceData.map(d => ({ index: d.index, price: d.high }));
    const lows = priceData.map(d => ({ index: d.index, price: d.low }));

    // Find horizontal resistance level
    const resistanceLevel = this._findHorizontalResistance(highs);
    if (!resistanceLevel) {
      return { pattern: null, confidence: 0 };
    }

    // Find ascending support trendline
    const supportTrendline = this._findAscendingSupport(lows, resistanceLevel.startIndex);
    if (!supportTrendline) {
      return { pattern: null, confidence: 0 };
    }

    // Calculate convergence and confidence
    const convergence = this._calculateConvergence(resistanceLevel, supportTrendline, priceData.length);
    const confidence = this._calculateTriangleConfidence('ascending', resistanceLevel, supportTrendline, priceData);

    if (confidence < 60) {
      return { pattern: null, confidence };
    }

    return {
      pattern: 'ASCENDING_TRIANGLE',
      confidence,
      resistance: resistanceLevel,
      support: supportTrendline,
      convergence,
      direction: 'BULLISH',
      reliability: confidence > 80 ? 'HIGH' : confidence > 70 ? 'MEDIUM' : 'LOW'
    };
  }

  /**
   * Detect descending triangle pattern
   * Characteristics: Descending resistance, horizontal support
   */
  _detectDescendingTriangle(priceData) {
    const highs = priceData.map(d => ({ index: d.index, price: d.high }));
    const lows = priceData.map(d => ({ index: d.index, price: d.low }));

    // Find horizontal support level
    const supportLevel = this._findHorizontalSupport(lows);
    if (!supportLevel) {
      return { pattern: null, confidence: 0 };
    }

    // Find descending resistance trendline
    const resistanceTrendline = this._findDescendingResistance(highs, supportLevel.startIndex);
    if (!resistanceTrendline) {
      return { pattern: null, confidence: 0 };
    }

    // Calculate convergence and confidence
    const convergence = this._calculateConvergence(resistanceTrendline, supportLevel, priceData.length);
    const confidence = this._calculateTriangleConfidence('descending', resistanceTrendline, supportLevel, priceData);

    if (confidence < 60) {
      return { pattern: null, confidence };
    }

    return {
      pattern: 'DESCENDING_TRIANGLE',
      confidence,
      resistance: resistanceTrendline,
      support: supportLevel,
      convergence,
      direction: 'BEARISH',
      reliability: confidence > 80 ? 'HIGH' : confidence > 70 ? 'MEDIUM' : 'LOW'
    };
  }

  /**
   * Detect symmetrical triangle pattern
   * Characteristics: Descending resistance, ascending support
   */
  _detectSymmetricalTriangle(priceData) {
    const highs = priceData.map(d => ({ index: d.index, price: d.high }));
    const lows = priceData.map(d => ({ index: d.index, price: d.low }));

    // Find descending resistance trendline
    const resistanceTrendline = this._findDescendingResistance(highs);
    if (!resistanceTrendline) {
      return { pattern: null, confidence: 0 };
    }

    // Find ascending support trendline
    const supportTrendline = this._findAscendingSupport(lows, resistanceTrendline.startIndex);
    if (!supportTrendline) {
      return { pattern: null, confidence: 0 };
    }

    // Calculate convergence and confidence
    const convergence = this._calculateConvergence(resistanceTrendline, supportTrendline, priceData.length);
    const confidence = this._calculateTriangleConfidence('symmetrical', resistanceTrendline, supportTrendline, priceData);

    if (confidence < 65) {
      return { pattern: null, confidence };
    }

    return {
      pattern: 'SYMMETRICAL_TRIANGLE',
      confidence,
      resistance: resistanceTrendline,
      support: supportTrendline,
      convergence,
      direction: 'NEUTRAL',
      reliability: confidence > 80 ? 'HIGH' : confidence > 70 ? 'MEDIUM' : 'LOW'
    };
  }

  /**
   * Find horizontal resistance level
   */
  _findHorizontalResistance(highs) {
    const peaks = this._findPeaks(highs);
    if (peaks.length < this.config.minTouchPoints) return null;

    // Group peaks by price level (within tolerance)
    const priceGroups = this._groupByPriceLevel(peaks, this.config.tolerance);
    
    // Find the group with most peaks at similar price level
    const bestGroup = priceGroups.reduce((best, group) => 
      group.length > best.length ? group : best, []
    );

    if (bestGroup.length < this.config.minTouchPoints) return null;

    return {
      type: 'horizontal',
      price: bestGroup.reduce((sum, p) => sum + p.price, 0) / bestGroup.length,
      touchPoints: bestGroup,
      startIndex: Math.min(...bestGroup.map(p => p.index)),
      endIndex: Math.max(...bestGroup.map(p => p.index))
    };
  }

  /**
   * Find horizontal support level
   */
  _findHorizontalSupport(lows) {
    const troughs = this._findTroughs(lows);
    if (troughs.length < this.config.minTouchPoints) return null;

    // Group troughs by price level (within tolerance)
    const priceGroups = this._groupByPriceLevel(troughs, this.config.tolerance);
    
    // Find the group with most troughs at similar price level
    const bestGroup = priceGroups.reduce((best, group) => 
      group.length > best.length ? group : best, []
    );

    if (bestGroup.length < this.config.minTouchPoints) return null;

    return {
      type: 'horizontal',
      price: bestGroup.reduce((sum, p) => sum + p.price, 0) / bestGroup.length,
      touchPoints: bestGroup,
      startIndex: Math.min(...bestGroup.map(p => p.index)),
      endIndex: Math.max(...bestGroup.map(p => p.index))
    };
  }

  /**
   * Find ascending support trendline
   */
  _findAscendingSupport(lows, minStartIndex = 0) {
    const troughs = this._findTroughs(lows).filter(t => t.index >= minStartIndex);
    if (troughs.length < this.config.minTouchPoints) return null;

    // Find the best ascending trendline through troughs
    return this._findBestTrendline(troughs, 'ascending');
  }

  /**
   * Find descending resistance trendline
   */
  _findDescendingResistance(highs, minStartIndex = 0) {
    const peaks = this._findPeaks(highs).filter(p => p.index >= minStartIndex);
    if (peaks.length < this.config.minTouchPoints) return null;

    // Find the best descending trendline through peaks
    return this._findBestTrendline(peaks, 'descending');
  }

  /**
   * Find peaks in price data
   */
  _findPeaks(pricePoints) {
    const peaks = [];
    const windowSize = 3;

    for (let i = windowSize; i < pricePoints.length - windowSize; i++) {
      const current = pricePoints[i];
      let isPeak = true;

      // Check if current point is highest in its window
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (j !== i && pricePoints[j].price >= current.price) {
          isPeak = false;
          break;
        }
      }

      if (isPeak) {
        peaks.push(current);
      }
    }

    return peaks;
  }

  /**
   * Find troughs in price data
   */
  _findTroughs(pricePoints) {
    const troughs = [];
    const windowSize = 3;

    for (let i = windowSize; i < pricePoints.length - windowSize; i++) {
      const current = pricePoints[i];
      let isTrough = true;

      // Check if current point is lowest in its window
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (j !== i && pricePoints[j].price <= current.price) {
          isTrough = false;
          break;
        }
      }

      if (isTrough) {
        troughs.push(current);
      }
    }

    return troughs;
  }

  /**
   * Group price points by similar price levels
   */
  _groupByPriceLevel(points, tolerance) {
    const groups = [];
    const used = new Set();

    for (const point of points) {
      if (used.has(point.index)) continue;

      const group = [point];
      used.add(point.index);

      for (const other of points) {
        if (used.has(other.index)) continue;
        
        const priceDiff = Math.abs(other.price - point.price) / point.price;
        if (priceDiff <= tolerance) {
          group.push(other);
          used.add(other.index);
        }
      }

      if (group.length >= 2) {
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Find best trendline through points
   */
  _findBestTrendline(points, direction) {
    if (points.length < this.config.minTouchPoints) return null;

    let bestTrendline = null;
    let bestScore = 0;

    // Try different combinations of points to find best trendline
    for (let i = 0; i < points.length - 1; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const p1 = points[i];
        const p2 = points[j];
        
        // Calculate slope
        const slope = (p2.price - p1.price) / (p2.index - p1.index);
        
        // Check if slope matches expected direction
        if (direction === 'ascending' && slope <= 0) continue;
        if (direction === 'descending' && slope >= 0) continue;

        // Count how many points are close to this trendline
        const touchPoints = this._findTrendlineTouches(points, p1, slope);
        
        if (touchPoints.length >= this.config.minTouchPoints) {
          const score = this._scoreTrendline(touchPoints, slope, direction);
          
          if (score > bestScore) {
            bestScore = score;
            bestTrendline = {
              type: 'trendline',
              direction,
              slope,
              startPoint: p1,
              endPoint: p2,
              touchPoints,
              score
            };
          }
        }
      }
    }

    return bestTrendline;
  }

  /**
   * Find points that touch a trendline within tolerance
   */
  _findTrendlineTouches(points, startPoint, slope) {
    const touches = [];

    for (const point of points) {
      // Calculate expected price at this index based on trendline
      const expectedPrice = startPoint.price + slope * (point.index - startPoint.index);
      const priceDiff = Math.abs(point.price - expectedPrice) / expectedPrice;

      if (priceDiff <= this.config.tolerance) {
        touches.push({
          ...point,
          expectedPrice,
          deviation: priceDiff
        });
      }
    }

    return touches;
  }

  /**
   * Score a trendline based on touch points and other factors
   */
  _scoreTrendline(touchPoints, slope, direction) {
    const touchCount = touchPoints.length;
    const avgDeviation = touchPoints.reduce((sum, p) => sum + p.deviation, 0) / touchCount;
    
    // Base score from touch count
    let score = touchCount * 20;
    
    // Bonus for low average deviation
    score += (1 - avgDeviation) * 30;
    
    // Bonus for strong slope in correct direction
    const slopeStrength = Math.abs(slope);
    score += Math.min(slopeStrength * 10, 20);
    
    return Math.round(score);
  }

  /**
   * Calculate triangle confidence score
   */
  _calculateTriangleConfidence(type, line1, line2, priceData) {
    let confidence = 50; // Base confidence

    // Touch points quality (40% of score)
    const line1TouchQuality = this._calculateTouchQuality(line1);
    const line2TouchQuality = this._calculateTouchQuality(line2);
    confidence += (line1TouchQuality + line2TouchQuality) * 0.2;

    // Convergence quality (30% of score)
    const convergence = this._calculateConvergence(line1, line2, priceData.length);
    if (convergence && convergence.distance > 0) {
      confidence += Math.min(convergence.quality * 30, 30);
    }

    // Volume pattern (20% of score)
    if (this.config.volumeConfirmation) {
      const volumeScore = this._analyzeVolumePattern(priceData);
      confidence += volumeScore * 0.2;
    }

    // Time frame appropriateness (10% of score)
    const timeScore = this._calculateTimeScore(line1, line2, priceData.length);
    confidence += timeScore * 0.1;

    return Math.round(Math.min(confidence, 95)); // Cap at 95%
  }

  /**
   * Calculate touch quality for a line
   */
  _calculateTouchQuality(line) {
    if (!line.touchPoints) return 0;

    const touchCount = line.touchPoints.length;
    const avgDeviation = line.touchPoints.reduce((sum, p) => sum + (p.deviation || 0), 0) / touchCount;
    
    // More touches = better, lower deviation = better
    return Math.min(touchCount * 15 + (1 - avgDeviation) * 20, 40);
  }

  /**
   * Calculate convergence between two lines
   */
  _calculateConvergence(line1, line2, dataLength) {
    // For horizontal lines, use average price
    const getPrice = (line, index) => {
      if (line.type === 'horizontal') return line.price;
      if (line.type === 'trendline') {
        return line.startPoint.price + line.slope * (index - line.startPoint.index);
      }
      return 0;
    };

    const currentIndex = dataLength - 1;
    const price1 = getPrice(line1, currentIndex);
    const price2 = getPrice(line2, currentIndex);
    
    const distance = Math.abs(price1 - price2);
    const avgPrice = (price1 + price2) / 2;
    const percentageDistance = distance / avgPrice;

    return {
      distance: percentageDistance,
      quality: Math.max(0, 1 - percentageDistance * 10), // Better when lines are closer
      price1,
      price2,
      avgPrice
    };
  }

  /**
   * Analyze volume pattern within triangle
   */
  _analyzeVolumePattern(priceData) {
    const volumes = priceData.map(d => d.volume).filter(v => v > 0);
    if (volumes.length < 10) return 0;

    // Check for decreasing volume trend (typical in triangles)
    const firstHalf = volumes.slice(0, Math.floor(volumes.length / 2));
    const secondHalf = volumes.slice(Math.floor(volumes.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    // Volume should decrease as triangle forms
    const volumeDecrease = (firstAvg - secondAvg) / firstAvg;
    return Math.max(0, Math.min(volumeDecrease * 100, 20));
  }

  /**
   * Calculate time score based on triangle formation period
   */
  _calculateTimeScore(line1, line2, dataLength) {
    const startIndex = Math.min(
      line1.startIndex || line1.startPoint?.index || 0,
      line2.startIndex || line2.startPoint?.index || 0
    );
    
    const formationPeriod = dataLength - startIndex;
    
    // Optimal formation period: 20-60 bars
    if (formationPeriod >= 20 && formationPeriod <= 60) return 10;
    if (formationPeriod >= 15 && formationPeriod <= 80) return 7;
    if (formationPeriod >= 10 && formationPeriod <= 100) return 4;
    return 0;
  }

  /**
   * Analyze potential breakout
   */
  _analyzeBreakout(priceData, pattern) {
    if (!pattern.convergence) return null;

    const latestPrice = priceData[priceData.length - 1];
    const latestIndex = priceData.length - 1;

    // Calculate support and resistance at the LATEST price point
    const getLinePrice = (line, index) => {
      if (line.type === 'horizontal') return line.price;
      if (line.type === 'trendline') {
        return line.startPoint.price + line.slope * (index - line.startPoint.index);
      }
      return 0;
    };

    const resistancePrice = getLinePrice(pattern.resistance, latestIndex);
    const supportPrice = getLinePrice(pattern.support, latestIndex);

    // Calculate breakout levels with threshold
    const upperBreakout = resistancePrice * (1 + this.config.breakoutThreshold);
    const lowerBreakout = supportPrice * (1 - this.config.breakoutThreshold);

    // Check current position
    let status = 'FORMING';
    let direction = null;

    if (latestPrice.close > upperBreakout) {
      status = 'BREAKOUT_UP';
      direction = 'BULLISH';
    } else if (latestPrice.close < lowerBreakout) {
      status = 'BREAKOUT_DOWN';
      direction = 'BEARISH';
    } else if (latestPrice.close > resistancePrice * 0.99) {
      status = 'APPROACHING_RESISTANCE';
    } else if (latestPrice.close < supportPrice * 1.01) {
      status = 'APPROACHING_SUPPORT';
    }

    return {
      status,
      direction,
      upperBreakout,
      lowerBreakout,
      resistancePrice,
      supportPrice,
      currentPrice: latestPrice.close,
      distanceToUpper: ((upperBreakout - latestPrice.close) / latestPrice.close) * 100,
      distanceToLower: ((latestPrice.close - lowerBreakout) / latestPrice.close) * 100
    };
  }

  /**
   * Generate trading plan for triangle pattern
   */
  _generateTradingPlan(pattern, priceData) {
    if (!pattern.breakout) return null;

    const currentPrice = priceData[priceData.length - 1].close;
    const { upperBreakout, lowerBreakout, resistancePrice, supportPrice } = pattern.breakout;

    // Calculate triangle height at current price level (tighter range)
    const triangleHeight = Math.abs(resistancePrice - supportPrice);

    // Long targets (for breakout up)
    const longTarget1 = upperBreakout + (triangleHeight * 0.618); // 61.8% Fibonacci projection
    const longTarget2 = upperBreakout + triangleHeight; // Full height projection
    const longRisk = upperBreakout - lowerBreakout;
    const longReward = longTarget1 - upperBreakout;

    // Short targets (for breakdown down)
    // For shorts, calculate percentage move to avoid negative prices
    const heightPercent = triangleHeight / lowerBreakout;

    // Conservative approach: limit target to reasonable percentage
    const target1Percent = Math.min(heightPercent * 0.618, 0.5); // Max 50% down
    const target2Percent = Math.min(heightPercent, 0.7); // Max 70% down

    const shortTarget1 = lowerBreakout * (1 - target1Percent);
    const shortTarget2 = lowerBreakout * (1 - target2Percent);
    const shortRisk = upperBreakout - lowerBreakout;
    const shortReward = lowerBreakout - shortTarget1;

    const plan = {
      entry: {
        long: {
          trigger: upperBreakout,
          stopLoss: lowerBreakout,
          target1: longTarget1,
          target2: longTarget2,
          riskReward: longReward / longRisk
        },
        short: {
          trigger: lowerBreakout,
          stopLoss: upperBreakout,
          target1: shortTarget1,
          target2: shortTarget2,
          riskReward: shortReward / shortRisk
        }
      },
      alerts: []
    };

    // Generate specific alerts based on pattern type and current position
    if (pattern.pattern === 'ASCENDING_TRIANGLE') {
      plan.alerts.push({
        type: 'BULLISH_BIAS',
        message: `${pattern.pattern} forming - Bullish bias. Watch for breakout above ${upperBreakout.toFixed(4)}`
      });
    } else if (pattern.pattern === 'DESCENDING_TRIANGLE') {
      plan.alerts.push({
        type: 'BEARISH_BIAS',
        message: `${pattern.pattern} forming - Bearish bias. Watch for breakdown below ${lowerBreakout.toFixed(4)}`
      });
    } else {
      plan.alerts.push({
        type: 'NEUTRAL_BIAS',
        message: `${pattern.pattern} forming - Neutral bias. Breakout direction will determine trend`
      });
    }

    // Add proximity alerts
    const distanceToResistance = ((upperBreakout - currentPrice) / currentPrice) * 100;
    const distanceToSupport = ((currentPrice - lowerBreakout) / currentPrice) * 100;

    if (distanceToResistance < 2) {
      plan.alerts.push({
        type: 'RESISTANCE_APPROACH',
        message: `Price approaching triangle resistance at ${upperBreakout.toFixed(4)} (${distanceToResistance.toFixed(1)}% away)`
      });
    }

    if (distanceToSupport < 2) {
      plan.alerts.push({
        type: 'SUPPORT_APPROACH',
        message: `Price approaching triangle support at ${lowerBreakout.toFixed(4)} (${distanceToSupport.toFixed(1)}% away)`
      });
    }

    return plan;
  }
}

module.exports = PatternService;