import { QueryClient } from '@tanstack/react-query';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { writeZoneCache } from '@/features/airspace/cache/airspaceCacheStore';
import { hydrateAirspaceCache } from '@/features/airspace/cache/hydrateAirspaceCache';
import { AIRSPACE_ZONE_CONFIGS } from '@/features/airspace/constants';
import { getAirspaceZoneQueryKey } from '@/features/airspace/queries/airspaceZoneQueryKey';
import type { VWorldFeatureCollection } from '@/features/airspace/types';

const STALE_TIME_MS = 24 * 60 * 60 * 1000;

const makeCollection = (zoneType: string): VWorldFeatureCollection => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: [] },
      properties: {},
      zoneType,
    },
  ],
});

const [prohibitedConfig, restrictedConfig, availableConfig] = AIRSPACE_ZONE_CONFIGS;

describe('hydrateAirspaceCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    queryClient = new QueryClient();
  });

  it('저장된 그룹을 쿼리 캐시에 채우고 dataUpdatedAt을 savedAt으로 맞춘다', async () => {
    const data = makeCollection('비행금지구역');
    await writeZoneCache('prohibited', data, 123_456);

    await hydrateAirspaceCache(queryClient);

    const key = getAirspaceZoneQueryKey(prohibitedConfig);
    expect(queryClient.getQueryData(key)).toEqual(data);
    expect(queryClient.getQueryState(key)?.dataUpdatedAt).toBe(123_456);
  });

  it('24시간 이내 캐시는 fresh, 그보다 오래된 캐시는 stale로 판단된다', async () => {
    await writeZoneCache('prohibited', makeCollection('a'), Date.now() - 60 * 60 * 1000);
    await writeZoneCache('restricted', makeCollection('b'), Date.now() - 25 * 60 * 60 * 1000);

    await hydrateAirspaceCache(queryClient);

    const cache = queryClient.getQueryCache();
    const prohibited = cache.find({ queryKey: getAirspaceZoneQueryKey(prohibitedConfig) });
    const restricted = cache.find({ queryKey: getAirspaceZoneQueryKey(restrictedConfig) });
    expect(prohibited?.isStaleByTime(STALE_TIME_MS)).toBe(false);
    expect(restricted?.isStaleByTime(STALE_TIME_MS)).toBe(true);
  });

  it('만료된 캐시도 데이터는 채운다 (재조회 실패 시 기존 데이터를 보여주기 위해)', async () => {
    const data = makeCollection('관제권');
    await writeZoneCache('restricted', data, 1);

    await hydrateAirspaceCache(queryClient);

    expect(queryClient.getQueryData(getAirspaceZoneQueryKey(restrictedConfig))).toEqual(data);
  });

  it('저장된 그룹만 채우고 나머지는 비워 둔다', async () => {
    await writeZoneCache('available', makeCollection('드론시범사업구역'), 1);

    await hydrateAirspaceCache(queryClient);

    expect(queryClient.getQueryData(getAirspaceZoneQueryKey(availableConfig))).toBeDefined();
    expect(queryClient.getQueryData(getAirspaceZoneQueryKey(prohibitedConfig))).toBeUndefined();
    expect(queryClient.getQueryData(getAirspaceZoneQueryKey(restrictedConfig))).toBeUndefined();
  });

  it('저장소가 비어 있으면 아무것도 채우지 않는다', async () => {
    await hydrateAirspaceCache(queryClient);

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('IndexedDB를 쓸 수 없어도 예외 없이 끝난다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('indexedDB', undefined);

    await expect(hydrateAirspaceCache(queryClient)).resolves.toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

    vi.unstubAllGlobals();
  });

  describe('타임아웃', () => {
    it('읽기가 오래 걸리면 기다리지 않고 끝낸다', async () => {
      vi.useFakeTimers();
      const neverResolves = () => new Promise<never>(() => {});

      const done = hydrateAirspaceCache(queryClient, { readCache: neverResolves, timeoutMs: 500 });
      await vi.advanceTimersByTimeAsync(500);

      await expect(done).resolves.toBeUndefined();
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
      vi.useRealTimers();
    });

    it('타임아웃 뒤에 늦게 도착한 캐시가 이미 받은 최신 데이터를 덮어쓰지 않는다', async () => {
      vi.useFakeTimers();
      let resolveLate: (value: {
        savedAt: number;
        data: VWorldFeatureCollection;
      }) => void = () => {};
      const lateRead = () =>
        new Promise<{ savedAt: number; data: VWorldFeatureCollection }>((resolve) => {
          resolveLate = resolve;
        });

      const done = hydrateAirspaceCache(queryClient, { readCache: lateRead, timeoutMs: 500 });
      await vi.advanceTimersByTimeAsync(500);
      await done;

      const fresh = makeCollection('네트워크로 받은 최신');
      queryClient.setQueryData(getAirspaceZoneQueryKey(prohibitedConfig), fresh);

      resolveLate({ savedAt: 1, data: makeCollection('늦게 도착한 옛 캐시') });
      await vi.advanceTimersByTimeAsync(0);

      expect(queryClient.getQueryData(getAirspaceZoneQueryKey(prohibitedConfig))).toEqual(fresh);
      vi.useRealTimers();
    });
  });
});
