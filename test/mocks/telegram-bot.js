// test/mocks/telegram-bot.js - Mock TelegramBot module
const sinon = require("sinon");

class MockTelegramBot {
  constructor(token, options = {}) {
    this.token = token;
    this.options = options;

    // Create stubs for all methods
    this.onText = sinon.stub();
    this.sendMessage = sinon.stub().resolves({ message_id: 123 });
    this.on = sinon.stub();
    this.setWebHook = sinon.stub().resolves();
    this.deleteWebHook = sinon.stub().resolves();
    this.stopPolling = sinon.stub().resolves();
    this.startPolling = sinon.stub().resolves();

    // Don't actually start polling or make API calls
    if (options.polling) {
      // Simulate polling without actually doing it
      setTimeout(() => {
        // Do nothing - just prevent real polling
      }, 0);
    }
  }
}

module.exports = MockTelegramBot;
