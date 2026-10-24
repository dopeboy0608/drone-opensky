import type { AirspaceZoneConfig } from '@/features/airspace/types';

// 쿼리 훅과 캐시 하이드레이션이 같은 키를 쓰지 않으면 하이드레이션한 데이터를 훅이 찾지 못한다.
export const getAirspaceZoneQueryKey = (config: AirspaceZoneConfig) =>
  ['airspaceZones', config.level, config.typenames] as const;
