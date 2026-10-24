import { useQueries } from '@tanstack/react-query';
import { App as AntdApp } from 'antd';
import { useEffect, useRef } from 'react';

import { fetchAirspaceZones } from '@/features/airspace/api/fetchAirspaceZones';
import { AIRSPACE_ZONE_CONFIGS, AIRSPACE_ZONE_LABELS } from '@/features/airspace/constants';
import { getAirspaceZoneQueryKey } from '@/features/airspace/queries/airspaceZoneQueryKey';
import type { AirspaceZoneConfig, VWorldFeatureCollection } from '@/features/airspace/types';
import { tagFeatureZoneType } from '@/features/airspace/utils/tagFeatureZoneType';

// 전국 공역 데이터(~50MB)를 그룹당 하루 한 번 이상 재다운로드하지 않도록 staleTime을 넉넉히 잡는다 (이슈 #37).
const STALE_TIME_MS = 24 * 60 * 60 * 1000;
const ERROR_TOAST_DURATION_SECONDS = 3;
const INFO_TOAST_DURATION_SECONDS = 2;

interface AirspaceZoneQueryResult {
  config: AirspaceZoneConfig;
  data: VWorldFeatureCollection | undefined;
  isLoading: boolean;
  isError: boolean;
}

interface UseAirspaceZoneQueriesReturn {
  results: AirspaceZoneQueryResult[];
  refreshStaleZones: () => void;
}

const fetchZoneGroup = async (typenames: string[]): Promise<VWorldFeatureCollection> => {
  const collections = await Promise.all(
    typenames.map(async (typename) => {
      const collection = await fetchAirspaceZones(typename);
      return tagFeatureZoneType(collection.features, typename);
    }),
  );
  return {
    type: 'FeatureCollection',
    features: collections.flat(),
  };
};

export const useAirspaceZoneQueries = (): UseAirspaceZoneQueriesReturn => {
  const { message } = AntdApp.useApp();

  const results = useQueries({
    queries: AIRSPACE_ZONE_CONFIGS.map((config) => ({
      queryKey: getAirspaceZoneQueryKey(config),
      queryFn: () => fetchZoneGroup(config.typenames),
      staleTime: STALE_TIME_MS,
      refetchOnWindowFocus: false,
    })),
  });

  // 구역(level)별로 같은 에러를 중복 토스트하지 않도록 마지막으로 안내한 에러 발생 시각을 기억한다.
  const toastedErrorAtRef = useRef<Partial<Record<AirspaceZoneConfig['level'], number>>>({});

  useEffect(() => {
    results.forEach((result, index) => {
      const config = AIRSPACE_ZONE_CONFIGS[index];

      if (result.isError && toastedErrorAtRef.current[config.level] !== result.errorUpdatedAt) {
        toastedErrorAtRef.current[config.level] = result.errorUpdatedAt;
        console.error(`[airspace] ${config.level} 구역 조회 실패`, result.error);
        message.error(
          `${AIRSPACE_ZONE_LABELS[config.level]} 구역 정보를 불러오지 못했습니다.`,
          ERROR_TOAST_DURATION_SECONDS,
        );
      }
    });
  });

  return {
    results: results.map((result, index) => ({
      config: AIRSPACE_ZONE_CONFIGS[index],
      data: result.data,
      isLoading: result.isLoading,
      isError: result.isError,
    })),
    // "공역 새로고침" 버튼용: staleTime(24시간)이 지난 그룹만 개별적으로 재패칭한다.
    // 모두 신선하면 네트워크 요청 없이 안내 토스트만 띄운다 (이슈 #37, 모바일 데이터 절감).
    refreshStaleZones: () => {
      const staleResults = results.filter((result) => result.isStale);

      if (staleResults.length === 0) {
        message.info('최신 상태입니다.', INFO_TOAST_DURATION_SECONDS);
        return;
      }

      staleResults.forEach((result) => {
        result.refetch();
      });
    },
  };
};
