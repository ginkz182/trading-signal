// test/services/subscriber.service.test.js
const { expect } = require("chai");
const sinon = require("sinon");
const { Pool } = require("pg");
const SubscriberService = require("../../src/services/subscriber.service");

describe("SubscriberService", () => {
  let subscriberService;
  let poolStub;
  let queryStub;

  const mockConfig = {
    databaseUrl: "postgresql://test@localhost:5432/test",
  };

  beforeEach(() => {
    // Create query stub
    queryStub = sinon.stub();

    // Create pool stub
    poolStub = {
      query: queryStub,
      end: sinon.stub(),
    };

    // Stub the Pool constructor
    sinon.stub(Pool.prototype, "query").callsFake(queryStub);
    sinon.stub(Pool.prototype, "end").callsFake(poolStub.end);

    subscriberService = new SubscriberService(mockConfig);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("constructor", () => {
    it("should initialize with database URL", () => {
      expect(subscriberService.pool).to.exist;
      expect(subscriberService.initialized).to.be.false;
    });

    it("should throw error if no database URL provided", () => {
      // Temporarily remove DATABASE_URL for this test
      const originalUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      expect(() => {
        new SubscriberService({});
      }).to.throw("DATABASE_URL is required");

      // Restore DATABASE_URL
      process.env.DATABASE_URL = originalUrl;
    });
  });

  describe("initialize()", () => {
    it("should create subscribers table and index", async () => {
      queryStub.resolves({ rows: [] });

      await subscriberService.initialize();

      expect(queryStub.callCount).to.be.at.least(3); // Connection test, table creation, index creation
      expect(subscriberService.initialized).to.be.true;

      // Check table creation query
      const tableQuery = queryStub
        .getCalls()
        .find((call) =>
          call.args[0].includes("CREATE TABLE IF NOT EXISTS subscribers")
        );
      expect(tableQuery).to.exist;

      // Check index creation query
      const indexQuery = queryStub
        .getCalls()
        .find((call) => call.args[0].includes("CREATE INDEX IF NOT EXISTS"));
      expect(indexQuery).to.exist;
    });

    it("should handle database connection errors", async () => {
      queryStub.rejects(new Error("Connection failed"));

      try {
        await subscriberService.initialize();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.equal("Connection failed");
      }
    });

    it("should not initialize twice", async () => {
      queryStub.resolves({ rows: [] });

      await subscriberService.initialize();
      await subscriberService.initialize(); // Second call

      // Should only initialize once
      expect(subscriberService.initialized).to.be.true;
    });
  });

  describe("subscribe()", () => {
    beforeEach(async () => {
      queryStub.resolves({ rows: [] });
      await subscriberService.initialize();
      queryStub.reset();
    });

    it("should subscribe a new user", async () => {
      const mockUser = {
        chat_id: "chat123",
        subscribed: true,
        username: "testuser",
        first_name: "Test",
        last_name: "User",
      };

      queryStub.resolves({ rows: [mockUser] });

      const result = await subscriberService.subscribe("chat123", {
        username: "testuser",
        first_name: "Test",
        last_name: "User",
      });

      expect(queryStub.calledOnce).to.be.true;
      expect(result).to.deep.equal(mockUser);

      // Verify the INSERT query
      const insertQuery = queryStub.firstCall.args[0];
      expect(insertQuery).to.include("INSERT INTO subscribers");
      expect(insertQuery).to.include("ON CONFLICT (chat_id)");
    });

    it("should handle database errors during subscription", async () => {
      queryStub.rejects(new Error("Database error"));

      try {
        await subscriberService.subscribe("chat123", {});
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.equal("Database error");
      }
    });
  });

  describe("unsubscribe()", () => {
    beforeEach(async () => {
      queryStub.resolves({ rows: [] });
      await subscriberService.initialize();
      queryStub.reset();
    });

    it("should unsubscribe an existing user", async () => {
      const mockUser = {
        chat_id: "chat123",
        subscribed: false,
      };

      queryStub.resolves({ rows: [mockUser] });

      const result = await subscriberService.unsubscribe("chat123");

      expect(queryStub.calledOnce).to.be.true;
      expect(result).to.deep.equal(mockUser);

      // Verify the UPDATE query
      const updateQuery = queryStub.firstCall.args[0];
      expect(updateQuery).to.include("UPDATE subscribers");
      expect(updateQuery).to.include("SET subscribed = false");
    });

    it("should return null for non-existent user", async () => {
      queryStub.resolves({ rows: [] });

      const result = await subscriberService.unsubscribe("nonexistent");

      expect(result).to.be.null;
    });
  });

  describe("getSubscriber()", () => {
    beforeEach(async () => {
      queryStub.resolves({ rows: [] });
      await subscriberService.initialize();
      queryStub.reset();
    });

    it("should return subscriber data", async () => {
      const mockUser = {
        chat_id: "chat123",
        subscribed: true,
        username: "testuser",
      };

      queryStub.resolves({ rows: [mockUser] });

      const result = await subscriberService.getSubscriber("chat123");

      expect(result).to.deep.equal(mockUser);
      expect(queryStub.calledOnce).to.be.true;
    });

    it("should return null for non-existent user", async () => {
      queryStub.resolves({ rows: [] });

      const result = await subscriberService.getSubscriber("nonexistent");

      expect(result).to.be.null;
    });
  });

  describe("getActiveSubscribers()", () => {
    beforeEach(async () => {
      queryStub.resolves({ rows: [] });
      await subscriberService.initialize();
      queryStub.reset();
    });

    it("should return all active subscribers", async () => {
      const mockUsers = [
        { chat_id: "chat1", subscribed: true },
        { chat_id: "chat2", subscribed: true },
      ];

      queryStub.resolves({ rows: mockUsers });

      const result = await subscriberService.getActiveSubscribers();

      expect(result).to.deep.equal(mockUsers);
      expect(queryStub.calledOnce).to.be.true;

      // Verify the SELECT query
      const selectQuery = queryStub.firstCall.args[0];
      expect(selectQuery).to.include("WHERE subscribed = true");
    });
  });

  describe("getActiveChatIds()", () => {
    beforeEach(async () => {
      queryStub.resolves({ rows: [] });
      await subscriberService.initialize();
      queryStub.reset();
    });

    it("should return array of active chat IDs", async () => {
      const mockUsers = [
        { chat_id: "chat1" },
        { chat_id: "chat2" },
        { chat_id: "chat3" },
      ];

      queryStub.resolves({ rows: mockUsers });

      const result = await subscriberService.getActiveChatIds();

      expect(result).to.deep.equal(["chat1", "chat2", "chat3"]);
      expect(queryStub.calledOnce).to.be.true;
    });

    it("should return empty array when no active subscribers", async () => {
      queryStub.resolves({ rows: [] });

      const result = await subscriberService.getActiveChatIds();

      expect(result).to.deep.equal([]);
    });
  });

  describe("getStats()", () => {
    beforeEach(async () => {
      queryStub.resolves({ rows: [] });
      await subscriberService.initialize();
      queryStub.reset();
    });

    it("should return subscriber statistics", async () => {
      const mockStats = {
        total: "10",
        active: "7",
        inactive: "3",
      };

      queryStub.resolves({ rows: [mockStats] });

      const result = await subscriberService.getStats();

      expect(result).to.deep.equal({
        total: 10,
        active: 7,
        inactive: 3,
      });

      // Verify the stats query
      const statsQuery = queryStub.firstCall.args[0];
      expect(statsQuery).to.include("COUNT(*) as total");
      expect(statsQuery).to.include("COUNT(*) FILTER");
    });
  });

  describe("isSubscribed()", () => {
    beforeEach(async () => {
      queryStub.resolves({ rows: [] });
      await subscriberService.initialize();
      queryStub.reset();
    });

    it("should return true for subscribed user", async () => {
      queryStub.resolves({
        rows: [{ chat_id: "chat123", subscribed: true }],
      });

      const result = await subscriberService.isSubscribed("chat123");

      expect(result).to.be.true;
    });

    it("should return false for unsubscribed user", async () => {
      queryStub.resolves({
        rows: [{ chat_id: "chat123", subscribed: false }],
      });

      const result = await subscriberService.isSubscribed("chat123");

      expect(result).to.be.false;
    });

    it("should return false for non-existent user", async () => {
      queryStub.resolves({ rows: [] });

      const result = await subscriberService.isSubscribed("nonexistent");

      expect(result).to.be.false;
    });
  });

  describe("testConnection()", () => {
    it("should return connection status", async () => {
      const mockResult = {
        rows: [
          {
            current_time: new Date(),
            postgres_version: "PostgreSQL 15.0",
          },
        ],
      };

      queryStub.resolves(mockResult);

      const result = await subscriberService.testConnection();

      expect(result.connected).to.be.true;
      expect(result.currentTime).to.exist;
      expect(result.version).to.equal("PostgreSQL 15.0");
    });

    it("should handle connection errors", async () => {
      queryStub.rejects(new Error("Connection failed"));

      const result = await subscriberService.testConnection();

      expect(result.connected).to.be.false;
      expect(result.error).to.equal("Connection failed");
    });
  });

  describe("close()", () => {
    it("should close database connection", async () => {
      await subscriberService.close();

      expect(poolStub.end.calledOnce).to.be.true;
    });
  });
});
