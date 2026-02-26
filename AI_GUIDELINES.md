# AI Agent & Contribution Guidelines

This document serves as the standard for all development work on this project. All AI agents and developers must adhere to these principles.

## 1. Clean Code & Architecture
- **Separation of Concerns**: Follow a clear layered architecture.
  - **Controllers/Handlers**: Parse input, call services. No business logic.
  - **Services**: Pure business logic. Receive dependencies via constructor (Dependency Injection).
  - **Data Access**: Encapsulate SQL queries and API calls.
- **Dependency Injection**: Always inject dependencies (e.g., database pool, config) into classes/functions via the constructor. This is critical for testability.
- **Naming**: Use descriptive, meaningful names. Avoid vague terms like `data` or `item`.
- **Single Responsibility**: Classes and functions should do one thing well.

## 2. Mandatory Testing
- **New Feature = New Test**: No feature is complete without a unit test.
- **Logic Change = Updated Test**: When modifying business logic, existing tests MUST be updated to reflect the new behavior. Do not simply delete failing tests.
- **Business Value**: Tests must verify business requirements (e.g., "User is downgraded after expiration"), not just implementation details involved.
- **Passing Tests**: The entire test suite (`npm test`) must pass before a task is considered complete.

## 3. Testability First
- Build code to be testable from the start.
- Mock external dependencies (Database, APIs, Time) in tests.
- Avoid global state or hardcoded dependencies inside functions.

## 4. Workflow
1. **Plan**: Understand requirements and update the implementation plan.
2. **Add Tests**: Create or update tests for the new logic.
3. **Implement**: Write the code to pass the tests.
4. **Refactor**: Clean up the code while keeping tests green.
