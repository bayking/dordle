# Project Guidelines

## Testing

- Use TDD (Test-Driven Development): write tests first, then implement
- Run tests with `bun run test`

### Unit Testing Best Practices

- Mock dependencies (repository/DB layer), not the system under test
- Test public user-facing methods, not implementation details
- Ensure test isolation: all test files should mock at the same level to prevent module caching conflicts

### bun:test Patterns

```typescript
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// Create mocks before mock.module()
const mockFn = mock(() => Promise.resolve([]));

// Mock modules BEFORE importing the code under test
mock.module('@/features/module/repository', () => ({
  someFunction: mockFn,
}));

// Dynamic import AFTER mock.module()
const { serviceFunction } = await import('@/features/module/service');

// Reset mocks in beforeEach
beforeEach(() => {
  mockFn.mockClear();
});
```
