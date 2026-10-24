import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from '@/test/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
