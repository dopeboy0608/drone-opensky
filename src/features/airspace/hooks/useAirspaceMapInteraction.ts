import { useCallback, useEffect, useMemo } from 'react';

import { useSelectedZone } from '@/features/airspace/hooks/useSelectedZone';
import { useZoneClick } from '@/features/airspace/hooks/useZoneClick';
import type { AirspaceRenderMode } from '@/features/airspace/store/airspaceRenderModeStore';
import type { SelectedZone } from '@/features/airspace/types';
import { getVisibleZoneTypes } from '@/features/airspace/utils/getVisibleZoneTypes';

import { ALL_ZONE_TYPENAMES } from '@/features/airspace/constants';

// 참조가 고정된 빈 Set. 렌더마다 새로 만들면 레이어/선택 해제 이펙트가 매번 다시 돈다.
const NO_VISIBLE_ZONE_TYPES: ReadonlySet<string> = new Set();

interface UseAirspaceMapInteractionParams {
  renderMode: AirspaceRenderMode;
  visibility: Record<string, boolean>;
}

// 범례 필터와 표시 방식에서 "무엇이 보이는가", "어떤 구역 안내가 열려 있는가", "지도 클릭을 어떻게 처리하는가"를
// 한 곳에서 정한다. 지도 화면(MapView)이 airspace의 이 세 가지 세부를 직접 조립하지 않게 하려는 것이다.
export const useAirspaceMapInteraction = ({
  renderMode,
  visibility,
}: UseAirspaceMapInteractionParams) => {
  const filteredZoneTypes = useMemo(() => getVisibleZoneTypes(visibility), [visibility]);
  // WMS 모드의 숨김은 언마운트가 아니라 가시성 전환으로 한다. 폴리곤 복귀 시 Polygon 재생성 비용을
  // 피하기 위함이다(#47).
  const visibleZoneTypes = renderMode === 'wms' ? NO_VISIBLE_ZONE_TYPES : filteredZoneTypes;

  const {
    selectedZone: resolvedZone,
    selectZone,
    clearZone: clearResolvedZone,
  } = useSelectedZone();
  // 두 모드 모두 같은 좌표 조회로 안내한다. 조회 대상은 범례 필터와 무관하게 전체다(#27).
  const {
    onMapClick: handlePointClick,
    pendingPosition,
    cancelPending,
  } = useZoneClick({
    enabled: true,
    resetKey: renderMode,
    typenames: ALL_ZONE_TYPENAMES,
    selectZone,
    clearZone: clearResolvedZone,
  });

  // 닫기는 확정된 카드뿐 아니라 조회 중인 대기 카드도 닫아야 하고, 이때 진행 중인 조회도 끊는다.
  const clearZone = useCallback(() => {
    cancelPending();
    clearResolvedZone();
  }, [cancelPending, clearResolvedZone]);

  // 조회가 끝나기 전에도 클릭 지점에 카드를 바로 연다. 구역은 아직 모르므로 대기 카드(isPending)로 두고,
  // 확정되면 resolvedZone이 이를 대신한다(#114). 새 클릭이 오면 이전 카드보다 새 위치의 대기 카드를 우선한다.
  const selectedZone = useMemo<SelectedZone | null>(
    () =>
      pendingPosition
        ? { position: pendingPosition, zoneType: null, isPending: true }
        : resolvedZone,
    [pendingPosition, resolvedZone],
  );

  // 범례에서 꺼서 지도에 보이지 않는 구역이면 카드에 그 사실을 알린다.
  const isSelectedZoneHidden =
    resolvedZone?.zoneType != null && !filteredZoneTypes.has(resolvedZone.zoneType);

  // 모드를 바꾸면 이전 모드에서 열린 안내는 의미가 없어 닫는다(예전에는 빈 Set 전달로 닫혔다).
  // renderMode는 값이 아니라 "바뀐 시점"을 알리는 트리거로만 쓴다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: renderMode 변경 자체가 실행 조건이다.
  useEffect(() => {
    clearZone();
  }, [renderMode, clearZone]);

  return {
    visibleZoneTypes,
    selectedZone,
    isSelectedZoneHidden,
    clearZone,
    handlePointClick,
  };
};
