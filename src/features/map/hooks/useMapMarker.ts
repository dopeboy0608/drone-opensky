import { useCallback, useState } from 'react';

import type { MapPosition } from '@/features/map/types';

type MarkerSource = { kind: 'current' } | { kind: 'search'; position: MapPosition };

interface UseMapMarkerReturn {
  /** 지도에 그릴 마커 위치. 마커는 항상 하나뿐이라 위치 하나(또는 없음)로 표현한다. */
  markerPosition: MapPosition | null;
  showSearchMarker: (position: MapPosition) => void;
  showCurrentMarker: () => void;
}

// 마커가 두 개 그려지지 않도록 "무엇을 표시하는가"를 상태 하나로 두고, 위치는 거기서 파생한다.
export const useMapMarker = (
  currentPosition: MapPosition,
  hasLocation: boolean,
): UseMapMarkerReturn => {
  const [source, setSource] = useState<MarkerSource>({ kind: 'current' });

  const showSearchMarker = useCallback((position: MapPosition) => {
    setSource({ kind: 'search', position });
  }, []);

  const showCurrentMarker = useCallback(() => {
    setSource({ kind: 'current' });
  }, []);

  // 검색 마커를 보여주는 동안에는 내 위치가 갱신되거나 조회가 실패해도(hasLocation=false) 건드리지 않는다.
  const markerPosition =
    source.kind === 'search' ? source.position : hasLocation ? currentPosition : null;

  return { markerPosition, showSearchMarker, showCurrentMarker };
};
