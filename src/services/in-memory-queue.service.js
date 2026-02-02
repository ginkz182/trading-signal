
class InMemoryQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  enqueue(task) {
    this.queue.push(task);
    if (!this.processing) {
      this.processQueue();
    }
  }

  async processQueue() {
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      try {
        await task();
      } catch (error) {
        console.error("Error processing queue task:", error);
      }
    }
    this.processing = false;
  }
}

module.exports = InMemoryQueue;
