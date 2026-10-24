import type { QueryClient } from '@tanstack/react-query';

import { readZoneCache, type ZoneCacheEntry } from '@/features/airspace/cache/airspaceCacheStore';
import { AIRSPACE_ZONE_CONFIGS } from '@/features/airspace/constants';
import { getAirspaceZoneQueryKey } from '@/features/airspace/queries/airspaceZoneQueryKey';
import type { AirspaceZoneConfig } from '@/features/airspace/types';

// 읽기는 데스크톱 기준 수 ms~수십 ms지만, 느린 모바일 저장소가 첫 화면을 붙잡지 않도록 상한을 둔다.
// 초과하면 캐시 없이 시작하고 기존처럼 네트워크로 받는다.
const DEFAULT_TIMEOUT_MS = 2000;

interface HydrateOptions {
  timeoutMs?: number;
  readCache?: (level: AirspaceZoneConfig['level']) => Promise<ZoneCacheEntry | null>;
}

// 첫 렌더 전에 호출한다. useQueries가 먼저 마운트되면 캐시를 보기 전에 네트워크 조회가 시작된다.
// updatedAt을 savedAt으로 주입해 staleTime(24h)·refreshStaleZones의 isStale 판단이 저장 시각 기준이 되게 한다.
// 만료된 항목도 채운다: 재조회는 staleTime이 알아서 하고, 재조회가 실패해도 기존 데이터가 남는다.
export const hydrateAirspaceCache = async (
  queryClient: QueryClient,
  { timeoutMs = DEFAULT_TIMEOUT_MS, readCache = readZoneCache }: HydrateOptions = {},
): Promise<void> => {
  const hydrateGroup = async (config: AirspaceZoneConfig) => {
    const entry = await readCache(config.level);

    if (entry === null) {
      return;
    }

    const queryKey = getAirspaceZoneQueryKey(config);

    // 타임아웃 뒤에 늦게 도착한 옛 캐시가 이미 네트워크로 받은 데이터를 덮어쓰지 않게 한다.
    if (queryClient.getQueryData(queryKey) !== undefined) {
      return;
    }

    queryClient.setQueryData(queryKey, entry.data, { updatedAt: entry.savedAt });
  };

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timeoutId = setTimeout(resolve, timeoutMs);
  });

  try {
    await Promise.race([Promise.all(AIRSPACE_ZONE_CONFIGS.map(hydrateGroup)), timeout]);
  } catch (error) {
    console.warn('[airspace] 캐시 하이드레이션 실패 (캐시 없이 시작)', error);
  } finally {
    clearTimeout(timeoutId);
  }
};
