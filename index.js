require('dotenv').config();
const schedule = require('node-schedule');
const SignalCalculator = require('./src/SignalCalculator');
const config = require('./src/config');

const scanner = new SignalCalculator(config);

console.log('All environment variables:', process.env);


// Run once
scanner.scan();

// Schedule daily run
schedule.scheduleJob('55 23 * * *', () => {
  scanner.scan();
});
