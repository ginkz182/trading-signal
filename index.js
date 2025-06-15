require("dotenv").config();
const schedule = require("node-schedule");
const SignalCalculator = require("./src/core/SignalCalculator");
const config = require("./src/config");

const scanner = new SignalCalculator(config);

// Run once
scanner.scan({ usePreviousDay: true });

// // Schedule daily run
// schedule.scheduleJob('55 23 * * *', () => {
//   scanner.scan();
// });
