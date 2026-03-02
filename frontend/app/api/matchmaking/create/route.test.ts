import { test, expect, mock, describe } from 'bun:test';

// Mock Next.js and Supabase
mock.module('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({
      json: async () => body,
      status: init?.status || 200,
    }),
  },
}));

mock.module('@/utils/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: null } }),
    },
  }),
}));

mock.module('@/utils/supabase/admin', () => ({
  createAdminClient: () => ({}),
}));

// Import from absolute path to see if it helps
import { POST } from './route';

describe('POST /api/matchmaking/create', () => {
  const createRequest = (body: any) => {
    return {
      json: async () => body,
    } as any;
  };

  test('returns 400 for non-numeric betAmount', async () => {
    const req = createRequest({ betAmount: '100', type: 'public' });
    const res: any = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Monto inválido.');
  });

  test('returns 400 for negative betAmount', async () => {
    const req = createRequest({ betAmount: -10, type: 'public' });
    const res: any = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Monto inválido.');
  });

  test('returns 400 for zero betAmount', async () => {
    const req = createRequest({ betAmount: 0, type: 'public' });
    const res: any = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Monto inválido.');
  });

  test('returns 400 for missing betAmount', async () => {
    const req = createRequest({ type: 'public' });
    const res: any = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Monto inválido.');
  });

  test('proceeds to auth check if validation passes (returns 401 when unauthenticated)', async () => {
    const req = createRequest({ betAmount: 100, type: 'public' });
    const res: any = await POST(req);

    expect(res.status).toBe(401);
  });
});
