#!/usr/bin/env node

/**
 * Demo: Step-by-step Confidence Calculation
 * Shows exactly how pattern and combined confidence is calculated
 */

const IndicatorManager = require('./src/managers/indicator.manager');
const PatternService = require('./src/services/pattern.service');

console.log('🧮 Confidence Calculation Demo');
console.log('=============================\n');

// Create pattern service to demonstrate internal calculations
const patternService = new PatternService({
  minBars: 20,
  tolerance: 0.02,
  minTouchPoints: 3,
  volumeConfirmation: true
});

// Demo pattern confidence calculation with detailed breakdown
function demoPatternConfidence() {
  console.log('📊 Pattern Confidence Calculation Breakdown');
  console.log('==========================================\n');

  // Simulate an ascending triangle analysis
  console.log('Example: BTC/USDT Descending Triangle Analysis');
  console.log('--------------------------------------------');

  // Step 1: Base confidence
  let confidence = 50;
  console.log(`1️⃣ Base Confidence: ${confidence}%`);

  // Step 2: Touch Points Quality (40% of total possible score)
  const resistanceTouches = 5;
  const resistanceDeviation = 0.015; // 1.5% average deviation
  const supportTouches = 4; 
  const supportDeviation = 0.020; // 2.0% average deviation

  const resistanceQuality = Math.min(resistanceTouches * 15 + (1 - resistanceDeviation) * 20, 40);
  const supportQuality = Math.min(supportTouches * 15 + (1 - supportDeviation) * 20, 40);
  
  const touchQualityScore = (resistanceQuality + supportQuality) * 0.2;
  confidence += touchQualityScore;

  console.log(`2️⃣ Touch Points Analysis:`);
  console.log(`   📈 Resistance: ${resistanceTouches} touches, ${(resistanceDeviation*100).toFixed(1)}% deviation`);
  console.log(`      Quality: ${resistanceQuality.toFixed(1)}/40`);
  console.log(`   📉 Support: ${supportTouches} touches, ${(supportDeviation*100).toFixed(1)}% deviation`);
  console.log(`      Quality: ${supportQuality.toFixed(1)}/40`);
  console.log(`   🎯 Combined Touch Score: +${touchQualityScore.toFixed(1)} points`);
  console.log(`   📊 Running Confidence: ${confidence.toFixed(1)}%\n`);

  // Step 3: Convergence Quality (30% of total possible score)
  const resistancePrice = 113500;
  const supportPrice = 105000;
  const avgPrice = (resistancePrice + supportPrice) / 2;
  const distance = Math.abs(resistancePrice - supportPrice);
  const percentageDistance = distance / avgPrice;
  const convergenceQuality = Math.max(0, 1 - percentageDistance * 10);
  const convergenceScore = Math.min(convergenceQuality * 30, 30);
  
  confidence += convergenceScore;

  console.log(`3️⃣ Line Convergence Analysis:`);
  console.log(`   📍 Resistance Level: $${resistancePrice.toLocaleString()}`);
  console.log(`   📍 Support Level: $${supportPrice.toLocaleString()}`);
  console.log(`   📏 Distance: $${distance.toLocaleString()} (${(percentageDistance*100).toFixed(1)}%)`);
  console.log(`   🎯 Convergence Score: +${convergenceScore.toFixed(1)} points`);
  console.log(`   📊 Running Confidence: ${confidence.toFixed(1)}%\n`);

  // Step 4: Volume Pattern (20% of total possible score)  
  const earlyVolume = 1500;
  const recentVolume = 1200;
  const volumeDecrease = (earlyVolume - recentVolume) / earlyVolume;
  const volumeScore = Math.max(0, Math.min(volumeDecrease * 100, 20)) * 0.2;
  
  confidence += volumeScore;

  console.log(`4️⃣ Volume Pattern Analysis:`);
  console.log(`   📊 Early Formation Volume: ${earlyVolume.toLocaleString()}`);
  console.log(`   📊 Recent Formation Volume: ${recentVolume.toLocaleString()}`);
  console.log(`   📉 Volume Decrease: ${(volumeDecrease*100).toFixed(1)}% (typical for triangles)`);
  console.log(`   🎯 Volume Score: +${volumeScore.toFixed(1)} points`);
  console.log(`   📊 Running Confidence: ${confidence.toFixed(1)}%\n`);

  // Step 5: Time Frame Appropriateness (10% of total possible score)
  const formationDays = 45;
  let timeScore = 0;
  if (formationDays >= 20 && formationDays <= 60) timeScore = 10;
  else if (formationDays >= 15 && formationDays <= 80) timeScore = 7;
  else if (formationDays >= 10 && formationDays <= 100) timeScore = 4;

  const timeScoreAdjusted = timeScore * 0.1;
  confidence += timeScoreAdjusted;

  console.log(`5️⃣ Formation Time Analysis:`);
  console.log(`   ⏰ Formation Period: ${formationDays} days`);
  console.log(`   ✅ Optimal Range: 20-60 days`);
  console.log(`   🎯 Time Score: +${timeScoreAdjusted.toFixed(1)} points`);
  console.log(`   📊 Final Pattern Confidence: ${Math.min(confidence, 95).toFixed(0)}%\n`);

  return Math.min(confidence, 95);
}

// Demo signal combination confidence
function demoSignalCombination() {
  console.log('🤝 Signal Combination Confidence');
  console.log('===============================\n');

  const scenarios = [
    {
      name: 'Bullish Breakout Override',
      emaSignal: 'HOLD',
      patternType: 'ASCENDING_TRIANGLE',
      patternConfidence: 66,
      breakoutStatus: 'BREAKOUT_UP',
      patternDirection: 'BULLISH'
    },
    {
      name: 'Signal Alignment (Boost)',
      emaSignal: 'BUY', 
      patternType: 'ASCENDING_TRIANGLE',
      patternConfidence: 80,
      breakoutStatus: 'FORMING',
      patternDirection: 'BULLISH'
    },
    {
      name: 'Signal Conflict (Reduce)',
      emaSignal: 'BUY',
      patternType: 'DESCENDING_TRIANGLE', 
      patternConfidence: 75,
      breakoutStatus: 'FORMING',
      patternDirection: 'BEARISH'
    },
    {
      name: 'Neutral Pattern with HOLD',
      emaSignal: 'HOLD',
      patternType: 'SYMMETRICAL_TRIANGLE',
      patternConfidence: 70,
      breakoutStatus: 'FORMING', 
      patternDirection: 'NEUTRAL'
    }
  ];

  scenarios.forEach((scenario, index) => {
    console.log(`${index + 1}️⃣ Scenario: ${scenario.name}`);
    console.log('-'.repeat(scenario.name.length + 15));
    
    let confidence = 60; // Base EMA confidence
    let signal = scenario.emaSignal;
    let reasoning = [`EMA signal: ${scenario.emaSignal}`];

    console.log(`   📈 EMA Signal: ${scenario.emaSignal} (Base: 60%)`);
    console.log(`   🔺 Pattern: ${scenario.patternType} (${scenario.patternConfidence}%)`);
    console.log(`   🎯 Breakout: ${scenario.breakoutStatus}`);
    
    // Apply combination logic
    if (scenario.breakoutStatus === 'BREAKOUT_UP') {
      signal = 'BUY';
      confidence = Math.max(75, scenario.patternConfidence);
      reasoning.push('Bullish breakout confirmed');
      console.log(`   🚀 BREAKOUT OVERRIDE: Signal → BUY, Confidence → ${confidence}%`);
      
    } else if (scenario.patternDirection === 'BULLISH' && scenario.emaSignal === 'BUY') {
      confidence = Math.min(90, 65 + (scenario.patternConfidence * 0.3));
      reasoning.push('Pattern supports bullish EMA signal');
      console.log(`   ✅ ALIGNMENT BOOST: 65 + (${scenario.patternConfidence} × 0.3) = ${confidence.toFixed(0)}%`);
      
    } else if (scenario.patternDirection === 'BEARISH' && scenario.emaSignal === 'BUY') {
      confidence = Math.max(45, 60 - (scenario.patternConfidence * 0.2));
      reasoning.push('Pattern conflicts with EMA signal - reduced confidence');
      console.log(`   ⚠️ CONFLICT PENALTY: 60 - (${scenario.patternConfidence} × 0.2) = ${confidence.toFixed(0)}%`);
      
    } else if (scenario.patternDirection === 'NEUTRAL' && scenario.emaSignal === 'HOLD') {
      confidence = Math.min(75, 60 + (scenario.patternConfidence * 0.15));
      reasoning.push('Symmetrical triangle forming - await breakout direction');
      console.log(`   🔺 NEUTRAL BOOST: 60 + (${scenario.patternConfidence} × 0.15) = ${confidence.toFixed(0)}%`);
    }

    console.log(`   🎯 Final Signal: ${signal}`);
    console.log(`   📊 Final Confidence: ${Math.round(confidence)}%`);
    console.log(`   💭 Reasoning: ${reasoning.join(', ')}\n`);
  });
}

// Run the demos
const patternConfidence = demoPatternConfidence();
console.log('='.repeat(60) + '\n');
demoSignalCombination();

console.log('✅ Confidence Calculation Demo Complete!');
console.log('\n🎯 Key Takeaways:');
console.log('• Pattern confidence combines 4 factors: touch quality, convergence, volume, timing');
console.log('• Base EMA confidence is 60%, modified by pattern analysis');  
console.log('• Breakouts override EMA signals with 75%+ confidence');
console.log('• Signal alignment boosts confidence, conflicts reduce it');
console.log('• Final confidence ranges from 45% (conflicts) to 90% (perfect alignment)');

console.log('\n🔬 Test with real data:');
console.log('node test-pattern-only.js');