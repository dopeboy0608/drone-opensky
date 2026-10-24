import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { IDBFactory } from 'fake-indexeddb';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { writeZoneCache } from '@/features/airspace/cache/airspaceCacheStore';
import { hydrateAirspaceCache } from '@/features/airspace/cache/hydrateAirspaceCache';
import { useAirspaceZoneQueries } from '@/features/airspace/queries/useAirspaceZoneQueries';
import { server } from '@/test/mocks/server';

const WFS_URL = 'https://server-eosin-five-92.vercel.app/api/vworld-api/wfs';
const HOUR_MS = 60 * 60 * 1000;

const makeFeatureCollection = () => ({
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      geometry: { type: 'MultiPolygon' as const, coordinates: [] },
      properties: {},
      zoneType: '캐시',
    },
  ],
});

const renderQueries = (queryClient: QueryClient) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AntdApp>{children}</AntdApp>
    </QueryClientProvider>
  );
  return renderHook(() => useAirspaceZoneQueries(), { wrapper });
};

describe('useAirspaceZoneQueries + IndexedDB 캐시', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('모든 그룹의 캐시가 24시간 이내면 네트워크 요청 없이 캐시 데이터를 쓴다', async () => {
    let requestCount = 0;
    server.use(
      http.get(WFS_URL, () => {
        requestCount += 1;
        return HttpResponse.json({ type: 'FeatureCollection', features: [] });
      }),
    );
    for (const level of ['prohibited', 'restricted', 'available'] as const) {
      await writeZoneCache(level, makeFeatureCollection(), Date.now() - HOUR_MS);
    }
    const queryClient = new QueryClient();
    await hydrateAirspaceCache(queryClient);

    const { result } = renderQueries(queryClient);

    await waitFor(() => {
      expect(result.current.results.every((zone) => zone.data !== undefined)).toBe(true);
    });
    expect(requestCount).toBe(0);
  });

  it('만료된 그룹은 캐시 데이터를 먼저 보여주고 재조회한다', async () => {
    let requestCount = 0;
    server.use(
      http.get(WFS_URL, () => {
        requestCount += 1;
        return HttpResponse.json({ type: 'FeatureCollection', features: [] });
      }),
    );
    await writeZoneCache('prohibited', makeFeatureCollection(), Date.now() - 25 * HOUR_MS);
    const queryClient = new QueryClient();
    await hydrateAirspaceCache(queryClient);

    const { result } = renderQueries(queryClient);

    // 재조회가 끝나기 전에도 캐시된 데이터가 있어 로딩 상태가 아니다.
    expect(result.current.results[0].data).toBeDefined();
    expect(result.current.results[0].isLoading).toBe(false);
    await waitFor(() => expect(requestCount).toBeGreaterThan(0));
  });
});
